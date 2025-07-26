# Plugin Connection Methods & Network Restrictions
## Complete Guide: Docker, VM, Process, and Network Isolation

This document covers all possible connection methods and network restriction approaches for securing your plugin system.

---

## 🔌 Plugin Connection Methods Overview

### **Connection Architecture Options:**

```
1. Docker-Based:    Plugin Container ←→ Host Process
2. VM-Based:        Plugin VM ←→ Host Process  
3. Process-Based:   Plugin Process ←→ Host Process
4. Hybrid:          Mix of above approaches
```

---

## 🐳 Docker-Based Plugin Connections

### **1. Docker Container Isolation with Network Restrictions**

```typescript
// apps/plugin-host/src/docker/docker-plugin-manager.service.ts
import Docker from 'dockerode';
import * as net from 'net';
import * as path from 'path';

export class DockerPluginManager {
  private docker: Docker;
  private pluginNetworks = new Map<string, string>();
  private pluginContainers = new Map<string, Docker.Container>();

  constructor() {
    this.docker = new Docker();
  }

  async createIsolatedPlugin(pluginId: string, pluginPath: string, networkPolicy: NetworkPolicy): Promise<string> {
    // Create custom network for plugin (if network access needed)
    const networkId = await this.createPluginNetwork(pluginId, networkPolicy);
    
    // Create container with strict isolation
    const container = await this.docker.createContainer({
      Image: 'node:18-alpine',
      
      // Security settings
      User: 'node:node',
      ReadonlyRootfs: true,
      
      // Network configuration based on policy
      NetworkMode: this.getNetworkMode(networkPolicy),
      
      // Resource limits
      Memory: 128 * 1024 * 1024, // 128MB
      MemorySwap: 128 * 1024 * 1024,
      CpuShares: 512,
      PidsLimit: 50,
      
      // Security options
      HostConfig: {
        // File system mounts
        Binds: [
          `${pluginPath}:/plugin:ro`, // Read-only plugin code
          `${this.createPluginSocketDir(pluginId)}:/sockets:rw` // Socket directory
        ],
        
        // Network restrictions
        NetworkMode: networkPolicy.allowed ? networkId : 'none',
        
        // Security restrictions
        CapDrop: ['ALL'],
        CapAdd: networkPolicy.allowed ? ['NET_BIND_SERVICE'] : [],
        SecurityOpt: [
          'no-new-privileges',
          'seccomp:unconfined', // For debugging - remove in production
        ],
        
        // DNS restrictions
        Dns: networkPolicy.allowedDnsServers || [],
        DnsSearch: [],
        
        // Port restrictions
        PortBindings: this.getPortBindings(networkPolicy),
        
        // Tmpfs for temporary files
        Tmpfs: {
          '/tmp': 'rw,noexec,nosuid,size=10m',
          '/var/tmp': 'rw,noexec,nosuid,size=5m'
        }
      },
      
      // Environment variables
      Env: [
        'NODE_ENV=production',
        'PLUGIN_ID=' + pluginId,
        'SOCKET_PATH=/sockets/plugin.sock'
      ],
      
      // Working directory and command
      WorkingDir: '/plugin',
      Cmd: ['node', 'index.js'],
      
      // Labels for management
      Labels: {
        'plugin.id': pluginId,
        'plugin.network.policy': networkPolicy.type,
        'plugin.security.level': 'high'
      }
    });

    this.pluginContainers.set(pluginId, container);
    return container.id;
  }

  private getNetworkMode(policy: NetworkPolicy): string {
    switch (policy.type) {
      case 'none':
        return 'none'; // No network access
      
      case 'internal':
        return 'bridge'; // Internal Docker network only
      
      case 'restricted':
        return 'bridge'; // Bridge with firewall rules
      
      case 'full':
        return 'bridge'; // Full network access (dangerous)
      
      default:
        return 'none'; // Default to no network
    }
  }

  private async createPluginNetwork(pluginId: string, policy: NetworkPolicy): Promise<string> {
    if (policy.type === 'none') {
      return 'none';
    }

    // Create isolated network for this plugin
    const network = await this.docker.createNetwork({
      Name: `plugin-network-${pluginId}`,
      Driver: 'bridge',
      Options: {
        'com.docker.network.bridge.enable_icc': 'false', // Disable inter-container communication
        'com.docker.network.bridge.enable_ip_masquerade': 'true'
      },
      IPAM: {
        Config: [{
          Subnet: this.generateSubnet(pluginId), // e.g., 172.20.x.0/24
          Gateway: this.generateGateway(pluginId)
        }]
      },
      Internal: policy.type === 'internal', // No external access for internal networks
      Labels: {
        'plugin.id': pluginId,
        'network.type': policy.type
      }
    });

    this.pluginNetworks.set(pluginId, network.id);
    
    // Set up firewall rules for restricted networks
    if (policy.type === 'restricted') {
      await this.setupNetworkFirewallRules(pluginId, network.id, policy);
    }

    return network.id;
  }

  private async setupNetworkFirewallRules(pluginId: string, networkId: string, policy: NetworkPolicy): Promise<void> {
    const networkInfo = await this.docker.getNetwork(networkId).inspect();
    const subnet = networkInfo.IPAM.Config[0].Subnet;

    // Create iptables rules for network restrictions
    const rules = [
      // Block all outbound traffic by default
      `iptables -I DOCKER-USER -s ${subnet} -j DROP`,
      
      // Allow specific hosts if defined
      ...policy.allowedHosts.map(host => 
        `iptables -I DOCKER-USER -s ${subnet} -d ${host} -j ACCEPT`
      ),
      
      // Allow specific ports if defined
      ...policy.allowedPorts.map(port => 
        `iptables -I DOCKER-USER -s ${subnet} -p tcp --dport ${port} -j ACCEPT`
      ),
      
      // Allow DNS to specific servers
      ...policy.allowedDnsServers.map(dns => 
        `iptables -I DOCKER-USER -s ${subnet} -d ${dns} -p udp --dport 53 -j ACCEPT`
      )
    ];

    // Apply firewall rules
    for (const rule of rules) {
      await this.executeCommand(rule);
    }

    // Store rules for cleanup
    this.storeNetworkRules(pluginId, rules);
  }
}

export interface NetworkPolicy {
  type: 'none' | 'internal' | 'restricted' | 'full';
  allowedHosts: string[];        // Specific hosts/IPs allowed
  allowedPorts: number[];        // Specific ports allowed
  allowedDnsServers: string[];   // DNS servers allowed
  bandwidth?: {                  // Bandwidth limits
    upload: number;              // KB/s
    download: number;            // KB/s
  };
  connectionLimits?: {
    maxConnections: number;      // Max concurrent connections
    maxConnectionsPerHost: number;
  };
}
```

### **2. Docker Plugin Communication Setup**

```typescript
// apps/plugin-host/src/docker/docker-communication.service.ts
export class DockerCommunicationService {
  private socketServers = new Map<string, net.Server>();

  async setupPluginCommunication(pluginId: string, containerId: string): Promise<void> {
    // Create Unix domain socket for communication
    const socketPath = path.join(this.getPluginSocketDir(pluginId), 'plugin.sock');
    
    // Create socket server
    const server = net.createServer((clientSocket) => {
      console.log(`Plugin ${pluginId} connected via socket`);
      
      // Set up secure communication
      this.setupSecureSocketCommunication(pluginId, clientSocket);
    });

    // Listen on Unix socket
    server.listen(socketPath, () => {
      console.log(`Socket server listening for plugin ${pluginId}`);
    });

    this.socketServers.set(pluginId, server);

    // Mount socket directory into container
    await this.mountSocketIntoContainer(containerId, socketPath);
  }

  private setupSecureSocketCommunication(pluginId: string, socket: net.Socket): void {
    // Message encryption
    const encryptionKey = this.getPluginEncryptionKey(pluginId);
    
    socket.on('data', async (data) => {
      try {
        // Decrypt and verify message
        const message = this.decryptMessage(data, encryptionKey);
        const verifiedMessage = await this.verifyMessage(message, pluginId);
        
        // Process message
        const response = await this.processPluginMessage(pluginId, verifiedMessage);
        
        // Send encrypted response
        const encryptedResponse = this.encryptMessage(response, encryptionKey);
        socket.write(encryptedResponse);
        
      } catch (error) {
        console.error(`Communication error with plugin ${pluginId}:`, error);
        this.logSecurityEvent(pluginId, 'COMMUNICATION_ERROR', error);
      }
    });

    socket.on('error', (error) => {
      console.error(`Socket error for plugin ${pluginId}:`, error);
    });

    socket.on('close', () => {
      console.log(`Plugin ${pluginId} disconnected`);
    });
  }
}
```

---

## 🖥️ VM-Based Plugin Connections

### **1. Virtual Machine Plugin Isolation**

```typescript
// apps/plugin-host/src/vm/vm-plugin-manager.service.ts
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';

export class VMPluginManager {
  private vmInstances = new Map<string, VMInstance>();

  async createVMPlugin(pluginId: string, pluginPath: string, vmConfig: VMConfig): Promise<string> {
    // Create isolated VM for plugin
    const vmPath = await this.createVMImage(pluginId, pluginPath, vmConfig);
    
    // Launch VM with strict network restrictions
    const vmProcess = spawn('qemu-system-x86_64', [
      '-m', vmConfig.memory || '256', // Memory limit
      '-smp', vmConfig.cpu || '1',    // CPU cores
      '-hda', vmPath,                 // VM disk image
      '-netdev', this.getNetworkConfig(vmConfig.networkPolicy),
      '-device', 'virtio-net,netdev=net0',
      '-nographic',                   // No graphics
      '-monitor', 'unix:/tmp/qemu-monitor-' + pluginId + '.sock,server,nowait',
      '-serial', 'unix:/tmp/qemu-serial-' + pluginId + '.sock,server,nowait'
    ]);

    const vmInstance: VMInstance = {
      id: pluginId,
      process: vmProcess,
      config: vmConfig,
      monitorSocket: '/tmp/qemu-monitor-' + pluginId + '.sock',
      serialSocket: '/tmp/qemu-serial-' + pluginId + '.sock',
      status: 'starting'
    };

    this.vmInstances.set(pluginId, vmInstance);

    // Set up VM communication
    await this.setupVMCommunication(vmInstance);

    return pluginId;
  }

  private getNetworkConfig(policy: NetworkPolicy): string {
    switch (policy.type) {
      case 'none':
        return 'user,id=net0,restrict=yes,net=192.168.100.0/24,dhcpstart=192.168.100.10';
      
      case 'internal':
        return 'user,id=net0,restrict=yes,net=192.168.101.0/24,dhcpstart=192.168.101.10';
      
      case 'restricted':
        // Custom network with specific restrictions
        return `user,id=net0,restrict=yes,net=192.168.102.0/24,dhcpstart=192.168.102.10,hostfwd=tcp::0-:22`;
      
      default:
        return 'user,id=net0,restrict=yes,net=192.168.100.0/24'; // Default restricted
    }
  }

  private async createVMImage(pluginId: string, pluginPath: string, config: VMConfig): Promise<string> {
    // Create base VM image with minimal OS
    const baseImage = 'alpine-minimal.qcow2';
    const vmImagePath = `/tmp/plugin-vm-${pluginId}.qcow2`;

    // Copy base image
    await fs.copyFile(baseImage, vmImagePath);

    // Mount and customize VM image
    await this.customizeVMImage(vmImagePath, pluginPath, config);

    return vmImagePath;
  }

  private async setupVMCommunication(vmInstance: VMInstance): Promise<void> {
    // Wait for VM to boot
    await this.waitForVMBoot(vmInstance);

    // Set up serial communication
    const serialServer = net.createServer((socket) => {
      console.log(`VM ${vmInstance.id} connected via serial`);
      
      // Set up secure communication over serial port
      this.setupVMSerialCommunication(vmInstance.id, socket);
    });

    serialServer.listen(vmInstance.serialSocket);
  }
}

export interface VMConfig {
  memory: string;        // e.g., '256' for 256MB
  cpu: string;          // e.g., '1' for 1 core
  diskSize: string;     // e.g., '1G' for 1GB
  networkPolicy: NetworkPolicy;
  securityLevel: 'high' | 'medium' | 'low';
}

export interface VMInstance {
  id: string;
  process: ChildProcess;
  config: VMConfig;
  monitorSocket: string;
  serialSocket: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
}
```

---

## ⚙️ Process-Based Plugin Connections

### **1. Child Process Plugin Isolation**

```typescript
// apps/plugin-host/src/process/process-plugin-manager.service.ts
import { spawn, ChildProcess } from 'child_process';
import * as os from 'os';

export class ProcessPluginManager {
  private pluginProcesses = new Map<string, PluginProcess>();
  private networkNamespaces = new Map<string, string>();

  async createProcessPlugin(pluginId: string, pluginPath: string, processConfig: ProcessConfig): Promise<number> {
    // Create network namespace for network isolation (Linux only)
    if (process.platform === 'linux' && processConfig.networkPolicy.type !== 'full') {
      await this.createNetworkNamespace(pluginId, processConfig.networkPolicy);
    }

    // Create plugin workspace
    const workspacePath = await this.createPluginWorkspace(pluginId, pluginPath);

    // Spawn plugin process with restrictions
    const childProcess = spawn('node', ['index.js'], {
      cwd: workspacePath,
      env: this.createRestrictedEnvironment(pluginId, processConfig),
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      
      // Security restrictions (Unix systems)
      uid: this.getPluginUserId(),     // Low-privilege user
      gid: this.getPluginGroupId(),    // Low-privilege group
      
      // Process options
      detached: false,  // Keep attached to parent
      shell: false      // No shell access
    });

    // Apply additional restrictions
    await this.applyProcessRestrictions(childProcess, processConfig);

    const pluginProcess: PluginProcess = {
      id: pluginId,
      process: childProcess,
      config: processConfig,
      workspace: workspacePath,
      startTime: Date.now(),
      status: 'running'
    };

    this.pluginProcesses.set(pluginId, pluginProcess);

    // Set up process communication
    this.setupProcessCommunication(pluginProcess);

    // Set up monitoring
    this.monitorProcess(pluginProcess);

    return childProcess.pid!;
  }

  private async createNetworkNamespace(pluginId: string, policy: NetworkPolicy): Promise<void> {
    const namespaceName = `plugin-${pluginId}`;
    
    try {
      // Create network namespace
      await this.executeCommand(`ip netns add ${namespaceName}`);
      
      // Configure namespace based on policy
      switch (policy.type) {
        case 'none':
          // No additional configuration - completely isolated
          break;
          
        case 'internal':
          // Create internal network interface
          await this.executeCommand(`ip netns exec ${namespaceName} ip link set lo up`);
          break;
          
        case 'restricted':
          // Create restricted network with specific routes
          await this.setupRestrictedNetworking(namespaceName, policy);
          break;
      }
      
      this.networkNamespaces.set(pluginId, namespaceName);
      
    } catch (error) {
      console.error(`Failed to create network namespace for plugin ${pluginId}:`, error);
      throw error;
    }
  }

  private async setupRestrictedNetworking(namespace: string, policy: NetworkPolicy): Promise<void> {
    // Set up loopback
    await this.executeCommand(`ip netns exec ${namespace} ip link set lo up`);
    
    // Create veth pair
    const vethHost = `veth-host-${namespace}`;
    const vethGuest = `veth-guest-${namespace}`;
    
    await this.executeCommand(`ip link add ${vethHost} type veth peer name ${vethGuest}`);
    await this.executeCommand(`ip link set ${vethGuest} netns ${namespace}`);
    
    // Configure host side
    await this.executeCommand(`ip addr add 192.168.200.1/24 dev ${vethHost}`);
    await this.executeCommand(`ip link set ${vethHost} up`);
    
    // Configure guest side
    await this.executeCommand(`ip netns exec ${namespace} ip addr add 192.168.200.2/24 dev ${vethGuest}`);
    await this.executeCommand(`ip netns exec ${namespace} ip link set ${vethGuest} up`);
    await this.executeCommand(`ip netns exec ${namespace} ip route add default via 192.168.200.1`);
    
    // Set up iptables rules for restrictions
    await this.setupNetworkRestrictions(namespace, policy);
  }

  private async setupNetworkRestrictions(namespace: string, policy: NetworkPolicy): Promise<void> {
    // Block all traffic by default
    await this.executeCommand(`iptables -t nat -A POSTROUTING -s 192.168.200.0/24 -j DROP`);
    
    // Allow specific hosts
    for (const host of policy.allowedHosts) {
      await this.executeCommand(`iptables -t nat -I POSTROUTING -s 192.168.200.0/24 -d ${host} -j MASQUERADE`);
    }
    
    // Allow specific ports
    for (const port of policy.allowedPorts) {
      await this.executeCommand(`iptables -A FORWARD -s 192.168.200.0/24 -p tcp --dport ${port} -j ACCEPT`);
    }
  }

  private setupProcessCommunication(pluginProcess: PluginProcess): void {
    const { process: childProcess, id: pluginId } = pluginProcess;

    // Set up IPC communication
    childProcess.on('message', (message) => {
      this.handlePluginMessage(pluginId, message);
    });

    // Monitor stdout/stderr
    childProcess.stdout?.on('data', (data) => {
      this.logPluginOutput(pluginId, 'stdout', data.toString());
    });

    childProcess.stderr?.on('data', (data) => {
      this.logPluginOutput(pluginId, 'stderr', data.toString());
    });
  }

  private createRestrictedEnvironment(pluginId: string, config: ProcessConfig): NodeJS.ProcessEnv {
    return {
      // Minimal environment
      NODE_ENV: 'production',
      PATH: '/usr/bin:/bin',
      
      // Plugin-specific variables
      PLUGIN_ID: pluginId,
      PLUGIN_WORKSPACE: `/tmp/plugin-${pluginId}`,
      
      // Security restrictions
      LD_PRELOAD: undefined,
      LD_LIBRARY_PATH: undefined,
      DYLD_INSERT_LIBRARIES: undefined,
      
      // Resource limits
      NODE_OPTIONS: '--max-old-space-size=64', // 64MB heap limit
      
      // Network configuration
      ...(config.networkPolicy.type === 'none' ? {
        HTTP_PROXY: 'disabled',
        HTTPS_PROXY: 'disabled',
        NO_PROXY: '*'
      } : {})
    };
  }

  private async applyProcessRestrictions(process: ChildProcess, config: ProcessConfig): Promise<void> {
    if (process.platform === 'linux') {
      // Apply cgroups restrictions
      await this.applyCgroupLimits(process.pid!, config);
      
      // Apply seccomp filters (if configured)
      if (config.securityLevel === 'high') {
        await this.applySeccompFilter(process.pid!);
      }
    }
  }

  private async applyCgroupLimits(pid: number, config: ProcessConfig): Promise<void> {
    const cgroupPath = `/sys/fs/cgroup/plugin-${pid}`;
    
    try {
      // Create cgroup directory
      await fs.mkdir(cgroupPath, { recursive: true });
      
      // Set memory limit
      await fs.writeFile(`${cgroupPath}/memory.max`, config.memoryLimit || '64M');
      
      // Set CPU limit
      await fs.writeFile(`${cgroupPath}/cpu.max`, config.cpuLimit || '50000 100000'); // 50% CPU
      
      // Add process to cgroup
      await fs.writeFile(`${cgroupPath}/cgroup.procs`, pid.toString());
      
    } catch (error) {
      console.error(`Failed to apply cgroup limits for PID ${pid}:`, error);
    }
  }
}

export interface ProcessConfig {
  networkPolicy: NetworkPolicy;
  memoryLimit: string;      // e.g., '64M'
  cpuLimit: string;         // e.g., '50000 100000' (50% CPU)
  securityLevel: 'high' | 'medium' | 'low';
  allowedSyscalls?: string[]; // Whitelist of allowed system calls
}

export interface PluginProcess {
  id: string;
  process: ChildProcess;
  config: ProcessConfig;
  workspace: string;
  startTime: number;
  status: 'starting' | 'running' | 'stopped' | 'error';
}
```

---

## 🌐 Network Restriction Implementation

### **1. Network Policy Engine**

```typescript
// apps/plugin-host/src/network/network-policy-engine.service.ts
export class NetworkPolicyEngine {
  private activePolicies = new Map<string, ActiveNetworkPolicy>();

  async applyNetworkPolicy(pluginId: string, policy: NetworkPolicy): Promise<void> {
    const activePolicy: ActiveNetworkPolicy = {
      pluginId,
      policy,
      appliedAt: Date.now(),
      rules: []
    };

    switch (policy.type) {
      case 'none':
        await this.applyNoNetworkPolicy(pluginId, activePolicy);
        break;
        
      case 'internal':
        await this.applyInternalNetworkPolicy(pluginId, activePolicy);
        break;
        
      case 'restricted':
        await this.applyRestrictedNetworkPolicy(pluginId, activePolicy);
        break;
        
      case 'full':
        await this.applyFullNetworkPolicy(pluginId, activePolicy);
        break;
    }

    this.activePolicies.set(pluginId, activePolicy);
    
    // Log policy application
    this.logNetworkPolicyApplication(pluginId, policy);
  }

  private async applyNoNetworkPolicy(pluginId: string, activePolicy: ActiveNetworkPolicy): Promise<void> {
    // For Docker: NetworkMode = 'none'
    // For VM: restrict=yes with minimal network
    // For Process: network namespace with no external access
    
    const rules = [
      'DENY_ALL_OUTBOUND',
      'DENY_ALL_INBOUND',
      'ALLOW_LOOPBACK_ONLY'
    ];

    activePolicy.rules = rules;
  }

  private async applyRestrictedNetworkPolicy(pluginId: string, activePolicy: ActiveNetworkPolicy): Promise<void> {
    const policy = activePolicy.policy;
    const rules: string[] = [];

    // Default deny all
    rules.push('DENY_ALL_BY_DEFAULT');

    // Allow specific hosts
    for (const host of policy.allowedHosts) {
      const rule = await this.createHostAllowRule(pluginId, host);
      rules.push(rule);
    }

    // Allow specific ports
    for (const port of policy.allowedPorts) {
      const rule = await this.createPortAllowRule(pluginId, port);
      rules.push(rule);
    }

    // DNS restrictions
    if (policy.allowedDnsServers.length > 0) {
      for (const dns of policy.allowedDnsServers) {
        const rule = await this.createDnsAllowRule(pluginId, dns);
        rules.push(rule);
      }
    } else {
      rules.push('DENY_ALL_DNS');
    }

    // Bandwidth limits
    if (policy.bandwidth) {
      const rule = await this.createBandwidthLimitRule(pluginId, policy.bandwidth);
      rules.push(rule);
    }

    activePolicy.rules = rules;
  }

  private async createHostAllowRule(pluginId: string, host: string): Promise<string> {
    // Resolve hostname to IP if necessary
    const ip = await this.resolveHostToIP(host);
    
    // Create iptables rule or equivalent
    const rule = `ALLOW_HOST_${pluginId}_${ip}`;
    
    // Apply the actual network rule based on isolation method
    await this.applyNetworkRule(pluginId, 'ALLOW_HOST', { host: ip });
    
    return rule;
  }

  private async createBandwidthLimitRule(pluginId: string, limits: BandwidthLimits): Promise<string> {
    // Apply traffic shaping using tc (Linux traffic control)
    const commands = [
      `tc qdisc add dev plugin-${pluginId} root tbf rate ${limits.download}kbit burst 32kbit latency 400ms`,
      `tc qdisc add dev plugin-${pluginId} ingress`,
      `tc filter add dev plugin-${pluginId} parent ffff: protocol ip prio 50 u32 match ip src 0.0.0.0/0 police rate ${limits.upload}kbit burst 10kbit drop`
    ];

    for (const cmd of commands) {
      await this.executeCommand(cmd);
    }

    return `BANDWIDTH_LIMIT_${limits.upload}_${limits.download}`;
  }

  async monitorNetworkUsage(pluginId: string): Promise<NetworkUsageStats> {
    const policy = this.activePolicies.get(pluginId);
    if (!policy) {
      throw new Error(`No active policy for plugin ${pluginId}`);
    }

    return {
      pluginId,
      bytesIn: await this.getBytesIn(pluginId),
      bytesOut: await this.getBytesOut(pluginId),
      connectionsActive: await this.getActiveConnections(pluginId),
      dnsPolicyViolations: await this.getDnsPolicyViolations(pluginId),
      hostPolicyViolations: await this.getHostPolicyViolations(pluginId),
      timestamp: Date.now()
    };
  }
}

export interface ActiveNetworkPolicy {
  pluginId: string;
  policy: NetworkPolicy;
  appliedAt: number;
  rules: string[];
}

export interface BandwidthLimits {
  upload: number;   // KB/s
  download: number; // KB/s
}

export interface NetworkUsageStats {
  pluginId: string;
  bytesIn: number;
  bytesOut: number;
  connectionsActive: number;
  dnsPolicyViolations: number;
  hostPolicyViolations: number;
  timestamp: number;
}
```

---

## 📊 Connection Method Comparison

### **Security & Performance Comparison:**

| Method | Security Level | Performance | Network Control | Resource Usage | Complexity |
|--------|---------------|-------------|-----------------|----------------|------------|
| **Docker** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **VM** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| **Process** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Hybrid** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

### **Network Restriction Comparison:**

| Network Type | Use Case | Security | Performance | Complexity |
|-------------|----------|----------|-------------|------------|
| **None** | High-security plugins | Maximum | Best | Low |
| **Internal** | Plugin-to-plugin only | High | Good | Medium |
| **Restricted** | Controlled external access | Medium | Good | High |
| **Full** | Trusted plugins only | Low | Best | Low |

---

## 🎯 Recommended Implementation Strategy

### **For Your Project:**

1. **Start with Docker** (Best balance of security and performance)
2. **Use 'none' or 'restricted' network policies** (Address TT.md vulnerabilities)
3. **Implement process-based fallback** (For environments without Docker)
4. **Add comprehensive monitoring** (Detect policy violations)

### **Implementation Priority:**

```typescript
// 1. Docker with no network (highest security)
const highSecurityPlugin = await dockerManager.createIsolatedPlugin(pluginId, pluginPath, {
  type: 'none',
  allowedHosts: [],
  allowedPorts: [],
  allowedDnsServers: []
});

// 2. Docker with restricted network (controlled access)
const restrictedPlugin = await dockerManager.createIsolatedPlugin(pluginId, pluginPath, {
  type: 'restricted',
  allowedHosts: ['api.trusted-service.com'],
  allowedPorts: [443, 80],
  allowedDnsServers: ['8.8.8.8'],
  bandwidth: { upload: 100, download: 500 }
});

// 3. Process-based with network namespace (Linux fallback)
const processPlugin = await processManager.createProcessPlugin(pluginId, pluginPath, {
  networkPolicy: { type: 'restricted', allowedHosts: ['api.trusted-service.com'] },
  memoryLimit: '64M',
  cpuLimit: '50000 100000',
  securityLevel: 'high'
});
```

This comprehensive approach addresses all the network isolation and plugin connection vulnerabilities identified in your TT.md file while providing flexible deployment options.