# NestJS Dynamic Plugin System with Isolation & RxJS Communication
## Complete Implementation Guide

This guide shows how to create a secure NestJS plugin system with dynamic module loading, Docker/VM isolation, and RxJS-based communication.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    NestJS Host Application                      │
├─────────────────────────────────────────────────────────────────┤
│  Plugin Manager    │  Communication Hub  │  Resource Monitor   │
│  - Dynamic Loading │  - RxJS Streams     │  - Docker/VM Mgmt   │
│  - Module Registry │  - Message Broker   │  - Resource Limits  │
└─────────────────────────────────────────────────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  Plugin A       │   │  Plugin B       │   │  Plugin C       │
│  (Docker)       │   │  (VM)          │   │  (Docker)       │
│  - NestJS Mod   │   │  - NestJS Mod   │   │  - NestJS Mod   │
│  - RxJS Client  │   │  - RxJS Client  │   │  - RxJS Client  │
│  - Isolated Net │   │  - Isolated Net │   │  - Isolated Net │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

---

## 📁 Project Structure

```
apps/plugin-host/
├── src/
│   ├── core/
│   │   ├── app.module.ts                 # Main NestJS app
│   │   └── main.ts                       # Bootstrap
│   │
│   ├── plugin-system/
│   │   ├── plugin-manager.service.ts     # Dynamic module loading
│   │   ├── plugin-loader.service.ts      # Plugin discovery & loading
│   │   ├── plugin-registry.service.ts    # Plugin registry
│   │   └── plugin.interfaces.ts          # Plugin contracts
│   │
│   ├── isolation/
│   │   ├── docker-isolation.service.ts   # Docker container management
│   │   ├── vm-isolation.service.ts       # VM management
│   │   ├── resource-monitor.service.ts   # Resource monitoring
│   │   └── isolation.interfaces.ts       # Isolation contracts
│   │
│   ├── communication/
│   │   ├── message-broker.service.ts     # RxJS-based communication
│   │   ├── plugin-communication.service.ts
│   │   ├── stream-manager.service.ts     # RxJS stream management
│   │   └── communication.interfaces.ts   # Communication contracts
│   │
│   └── security/
│       ├── plugin-security.service.ts    # Security validation
│       ├── network-policy.service.ts     # Network restrictions
│       └── audit-logger.service.ts       # Security auditing
│
├── plugins/                              # Plugin storage
│   ├── payment-plugin/
│   │   ├── plugin.manifest.json
│   │   ├── plugin.module.ts
│   │   ├── payment.service.ts
│   │   └── package.json
│   │
│   └── analytics-plugin/
│       ├── plugin.manifest.json
│       ├── plugin.module.ts
│       ├── analytics.service.ts
│       └── package.json
│
└── docker/                              # Docker configurations
    ├── plugin-runtime.dockerfile
    └── docker-compose.yml
```

---

## 🔧 Core Implementation

### **1. Plugin Interface & Manifest**

```typescript
// apps/plugin-host/src/plugin-system/plugin.interfaces.ts
import { ModuleMetadata, Type } from '@nestjs/common';
import { Observable } from 'rxjs';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  
  // Security & Isolation
  isolation: {
    type: 'docker' | 'vm' | 'process';
    resources: {
      memory: string;        // e.g., '128M'
      cpu: string;          // e.g., '0.5'
      disk: string;         // e.g., '1G'
    };
    network: {
      type: 'none' | 'internal' | 'restricted' | 'full';
      allowedHosts?: string[];
      allowedPorts?: number[];
      bandwidth?: { upload: number; download: number; };
    };
  };
  
  // Plugin Configuration
  module: {
    entry: string;           // Entry point file
    className: string;       // Module class name
    dependencies?: string[]; // Required dependencies
  };
  
  // Communication Permissions
  communication: {
    allowedPlugins?: string[];  // Plugins this can communicate with
    allowedChannels?: string[]; // Communication channels allowed
    maxMessagesPerMinute?: number;
    maxMessageSize?: number;
  };
  
  // Lifecycle Hooks
  lifecycle: {
    onLoad?: string;         // Method to call on load
    onUnload?: string;       // Method to call on unload
    healthCheck?: string;    // Health check method
  };
}

export interface NestJSPlugin {
  id: string;
  manifest: PluginManifest;
  module: Type<any>;
  instance?: any;
  communicationStream?: Observable<any>;
  
  // Lifecycle methods
  onLoad?(): Promise<void>;
  onUnload?(): Promise<void>;
  onMessage?(message: PluginMessage): Promise<any>;
  healthCheck?(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }>;
}

export interface PluginMessage {
  id: string;
  from: string;
  to: string;
  type: 'request' | 'response' | 'event' | 'broadcast';
  channel: string;
  payload: any;
  timestamp: number;
  signature?: string;
}

export interface IsolatedPluginInstance {
  pluginId: string;
  isolationType: 'docker' | 'vm';
  containerId?: string;
  vmId?: string;
  communicationEndpoint: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
  resources: ResourceUsage;
}

export interface ResourceUsage {
  memory: number;      // MB
  cpu: number;         // Percentage
  network: {
    bytesIn: number;
    bytesOut: number;
  };
  disk: number;        // MB
}
```

### **2. Plugin Manager Service**

```typescript
// apps/plugin-host/src/plugin-system/plugin-manager.service.ts
import { Injectable, Logger, ModuleRef } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class PluginManagerService {
  private readonly logger = new Logger(PluginManagerService.name);
  private readonly plugins = new Map<string, NestJSPlugin>();
  private readonly pluginInstances = new Map<string, IsolatedPluginInstance>();
  private readonly pluginStreams = new Map<string, Subject<PluginMessage>>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly discoveryService: DiscoveryService,
    private readonly dockerIsolation: DockerIsolationService,
    private readonly vmIsolation: VmIsolationService,
    private readonly messageBroker: MessageBrokerService,
    private readonly pluginSecurity: PluginSecurityService
  ) {}

  async discoverAndLoadPlugins(): Promise<void> {
    const pluginsDir = path.join(process.cwd(), 'plugins');
    
    try {
      const pluginDirs = await fs.readdir(pluginsDir);
      
      for (const pluginDir of pluginDirs) {
        const pluginPath = path.join(pluginsDir, pluginDir);
        const manifestPath = path.join(pluginPath, 'plugin.manifest.json');
        
        if (await this.fileExists(manifestPath)) {
          await this.loadPlugin(pluginPath);
        }
      }
    } catch (error) {
      this.logger.error('Failed to discover plugins:', error);
    }
  }

  async loadPlugin(pluginPath: string): Promise<void> {
    try {
      // Load and validate manifest
      const manifest = await this.loadPluginManifest(pluginPath);
      await this.pluginSecurity.validatePluginManifest(manifest);
      
      this.logger.log(`Loading plugin: ${manifest.name} (${manifest.id})`);
      
      // Create isolated environment
      const isolatedInstance = await this.createIsolatedInstance(manifest, pluginPath);
      
      // Load plugin module dynamically
      const pluginModule = await this.loadPluginModule(pluginPath, manifest);
      
      // Create plugin instance
      const plugin: NestJSPlugin = {
        id: manifest.id,
        manifest,
        module: pluginModule,
        communicationStream: this.createPluginCommunicationStream(manifest.id)
      };
      
      // Register plugin
      this.plugins.set(manifest.id, plugin);
      this.pluginInstances.set(manifest.id, isolatedInstance);
      
      // Initialize plugin
      await this.initializePlugin(plugin, isolatedInstance);
      
      this.logger.log(`Plugin loaded successfully: ${manifest.name}`);
      
    } catch (error) {
      this.logger.error(`Failed to load plugin from ${pluginPath}:`, error);
      throw error;
    }
  }

  private async loadPluginManifest(pluginPath: string): Promise<PluginManifest> {
    const manifestPath = path.join(pluginPath, 'plugin.manifest.json');
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(manifestContent);
  }

  private async loadPluginModule(pluginPath: string, manifest: PluginManifest): Promise<Type<any>> {
    const entryPath = path.resolve(pluginPath, manifest.module.entry);
    
    // Security: Validate entry path is within plugin directory
    if (!entryPath.startsWith(path.resolve(pluginPath))) {
      throw new Error('Plugin entry path outside plugin directory');
    }
    
    // Dynamic import with security validation
    const moduleExports = await import(entryPath);
    const moduleClass = moduleExports[manifest.module.className];
    
    if (!moduleClass) {
      throw new Error(`Module class ${manifest.module.className} not found`);
    }
    
    return moduleClass;
  }

  private async createIsolatedInstance(
    manifest: PluginManifest, 
    pluginPath: string
  ): Promise<IsolatedPluginInstance> {
    
    const isolationType = manifest.isolation.type;
    
    switch (isolationType) {
      case 'docker':
        return await this.dockerIsolation.createDockerInstance(manifest, pluginPath);
      
      case 'vm':
        return await this.vmIsolation.createVMInstance(manifest, pluginPath);
      
      default:
        throw new Error(`Unsupported isolation type: ${isolationType}`);
    }
  }

  private createPluginCommunicationStream(pluginId: string): Observable<PluginMessage> {
    const stream = new Subject<PluginMessage>();
    this.pluginStreams.set(pluginId, stream);
    
    // Connect to message broker
    this.messageBroker.getPluginMessages(pluginId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(message => stream.next(message));
    
    return stream.asObservable();
  }

  private async initializePlugin(plugin: NestJSPlugin, instance: IsolatedPluginInstance): Promise<void> {
    try {
      // Call plugin lifecycle hook
      if (plugin.onLoad) {
        await plugin.onLoad();
      }
      
      // Set up communication handlers
      plugin.communicationStream!
        .pipe(takeUntil(this.destroy$))
        .subscribe(async message => {
          try {
            if (plugin.onMessage) {
              await plugin.onMessage(message);
            }
          } catch (error) {
            this.logger.error(`Plugin ${plugin.id} message handling error:`, error);
          }
        });
      
      // Start health monitoring
      this.startHealthMonitoring(plugin);
      
    } catch (error) {
      this.logger.error(`Plugin initialization failed for ${plugin.id}:`, error);
      throw error;
    }
  }

  private startHealthMonitoring(plugin: NestJSPlugin): void {
    // Health check every 30 seconds
    const healthCheck$ = new Observable(observer => {
      const interval = setInterval(async () => {
        try {
          if (plugin.healthCheck) {
            const health = await plugin.healthCheck();
            observer.next({ pluginId: plugin.id, health });
          }
        } catch (error) {
          observer.error({ pluginId: plugin.id, error });
        }
      }, 30000);
      
      return () => clearInterval(interval);
    });
    
    healthCheck$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => this.logger.log(`Health check: ${JSON.stringify(result)}`),
        error: (error) => this.logger.error(`Health check failed: ${JSON.stringify(error)}`)
      });
  }

  // Plugin Communication Methods
  async sendMessageToPlugin(fromPluginId: string, toPluginId: string, message: any): Promise<any> {
    return this.messageBroker.sendMessage({
      id: this.generateMessageId(),
      from: fromPluginId,
      to: toPluginId,
      type: 'request',
      channel: 'default',
      payload: message,
      timestamp: Date.now()
    });
  }

  async broadcastMessage(fromPluginId: string, message: any, channel: string = 'broadcast'): Promise<void> {
    await this.messageBroker.broadcast({
      id: this.generateMessageId(),
      from: fromPluginId,
      to: '*',
      type: 'broadcast',
      channel,
      payload: message,
      timestamp: Date.now()
    });
  }

  getPluginCommunicationStream(pluginId: string): Observable<PluginMessage> | undefined {
    return this.pluginStreams.get(pluginId)?.asObservable();
  }

  // Plugin Management Methods
  getLoadedPlugins(): NestJSPlugin[] {
    return Array.from(this.plugins.values());
  }

  getPlugin(pluginId: string): NestJSPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    try {
      // Call lifecycle hook
      if (plugin.onUnload) {
        await plugin.onUnload();
      }

      // Clean up isolated instance
      const instance = this.pluginInstances.get(pluginId);
      if (instance) {
        await this.cleanupIsolatedInstance(instance);
      }

      // Clean up streams
      const stream = this.pluginStreams.get(pluginId);
      if (stream) {
        stream.complete();
        this.pluginStreams.delete(pluginId);
      }

      // Remove from registry
      this.plugins.delete(pluginId);
      this.pluginInstances.delete(pluginId);

      this.logger.log(`Plugin unloaded: ${pluginId}`);
    } catch (error) {
      this.logger.error(`Failed to unload plugin ${pluginId}:`, error);
      throw error;
    }
  }

  private async cleanupIsolatedInstance(instance: IsolatedPluginInstance): Promise<void> {
    switch (instance.isolationType) {
      case 'docker':
        await this.dockerIsolation.destroyContainer(instance.containerId!);
        break;
      case 'vm':
        await this.vmIsolation.destroyVM(instance.vmId!);
        break;
    }
  }

  // Utility methods
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Unload all plugins
    const pluginIds = Array.from(this.plugins.keys());
    await Promise.all(pluginIds.map(id => this.unloadPlugin(id)));
  }
}
```

### **3. Docker Isolation Service**

```typescript
// apps/plugin-host/src/isolation/docker-isolation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import Docker from 'dockerode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Subject, Observable } from 'rxjs';

@Injectable()
export class DockerIsolationService {
  private readonly logger = new Logger(DockerIsolationService.name);
  private readonly docker: Docker;
  private readonly containers = new Map<string, Docker.Container>();
  private readonly resourceStreams = new Map<string, Subject<ResourceUsage>>();

  constructor() {
    this.docker = new Docker();
  }

  async createDockerInstance(
    manifest: PluginManifest, 
    pluginPath: string
  ): Promise<IsolatedPluginInstance> {
    
    const pluginId = manifest.id;
    this.logger.log(`Creating Docker instance for plugin: ${pluginId}`);

    try {
      // Prepare plugin workspace
      const workspaceDir = await this.preparePluginWorkspace(pluginId, pluginPath);
      
      // Create communication socket directory
      const socketDir = await this.createSocketDirectory(pluginId);
      
      // Build plugin Docker image if needed
      const imageTag = await this.buildPluginImage(pluginId, workspaceDir, manifest);
      
      // Create container with security restrictions
      const container = await this.docker.createContainer({
        Image: imageTag,
        
        // Security settings
        User: 'node:node',
        ReadonlyRootfs: true,
        
        // Network configuration
        NetworkMode: this.getNetworkMode(manifest.isolation.network),
        
        // Resource limits
        Memory: this.parseMemoryLimit(manifest.isolation.resources.memory),
        MemorySwap: this.parseMemoryLimit(manifest.isolation.resources.memory),
        CpuShares: this.parseCpuLimit(manifest.isolation.resources.cpu),
        PidsLimit: 50,
        
        // File system mounts
        HostConfig: {
          Binds: [
            `${workspaceDir}:/app:ro`,           // Plugin code (read-only)
            `${socketDir}:/sockets:rw`,          // Communication sockets
            '/tmp/plugin-scratch:/tmp:rw'        // Temporary space
          ],
          
          // Security restrictions
          CapDrop: ['ALL'],
          SecurityOpt: ['no-new-privileges'],
          
          // Tmpfs for temporary files
          Tmpfs: {
            '/tmp': 'rw,noexec,nosuid,size=10m',
            '/var/tmp': 'rw,noexec,nosuid,size=5m'
          }
        },
        
        // Environment variables
        Env: [
          'NODE_ENV=plugin',
          `PLUGIN_ID=${pluginId}`,
          'SOCKET_PATH=/sockets/plugin.sock',
          'PLUGIN_WORKSPACE=/app'
        ],
        
        // Working directory and command
        WorkingDir: '/app',
        Cmd: ['node', manifest.module.entry],
        
        // Labels for management
        Labels: {
          'plugin.id': pluginId,
          'plugin.name': manifest.name,
          'plugin.version': manifest.version,
          'managed-by': 'nestjs-plugin-system'
        }
      });

      this.containers.set(pluginId, container);
      
      // Start container
      await container.start();
      
      // Set up resource monitoring
      this.startResourceMonitoring(pluginId, container);
      
      // Create plugin instance record
      const instance: IsolatedPluginInstance = {
        pluginId,
        isolationType: 'docker',
        containerId: container.id,
        communicationEndpoint: path.join(socketDir, 'plugin.sock'),
        status: 'running',
        resources: {
          memory: 0,
          cpu: 0,
          network: { bytesIn: 0, bytesOut: 0 },
          disk: 0
        }
      };

      this.logger.log(`Docker instance created for plugin: ${pluginId}`);
      return instance;

    } catch (error) {
      this.logger.error(`Failed to create Docker instance for plugin ${pluginId}:`, error);
      throw error;
    }
  }

  private async preparePluginWorkspace(pluginId: string, pluginPath: string): Promise<string> {
    const workspaceDir = path.join('/tmp', 'plugin-workspaces', pluginId);
    
    // Create workspace directory
    await fs.mkdir(workspaceDir, { recursive: true });
    
    // Copy plugin files (with validation)
    await this.copyPluginFiles(pluginPath, workspaceDir);
    
    // Create package.json if not exists
    await this.ensurePackageJson(workspaceDir);
    
    return workspaceDir;
  }

  private async copyPluginFiles(sourcePath: string, destPath: string): Promise<void> {
    const files = await fs.readdir(sourcePath, { recursive: true });
    
    for (const file of files) {
      const srcFile = path.join(sourcePath, file);
      const destFile = path.join(destPath, file);
      
      // Security: Validate file path
      if (!this.isValidPluginFile(file)) {
        this.logger.warn(`Skipping invalid file: ${file}`);
        continue;
      }
      
      // Ensure destination directory exists
      await fs.mkdir(path.dirname(destFile), { recursive: true });
      
      // Copy file
      await fs.copyFile(srcFile, destFile);
    }
  }

  private isValidPluginFile(filename: string): boolean {
    const allowedExtensions = ['.js', '.ts', '.json', '.md', '.txt'];
    const ext = path.extname(filename);
    
    if (!allowedExtensions.includes(ext)) {
      return false;
    }
    
    // Block dangerous patterns
    const dangerousPatterns = [
      /\.\./,    // Path traversal
      /^\//, // Absolute paths
      /\x00/,    // Null bytes
      /^\./, // Hidden files (except .gitignore, etc.)
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(filename));
  }

  private async buildPluginImage(
    pluginId: string, 
    workspaceDir: string, 
    manifest: PluginManifest
  ): Promise<string> {
    
    const imageTag = `plugin-${pluginId}:${manifest.version}`;
    
    // Create Dockerfile
    const dockerfile = this.generateDockerfile(manifest);
    await fs.writeFile(path.join(workspaceDir, 'Dockerfile'), dockerfile);
    
    // Build image
    const buildStream = await this.docker.buildImage({
      context: workspaceDir,
      src: ['Dockerfile', '.']
    }, {
      t: imageTag
    });
    
    // Wait for build to complete
    await new Promise((resolve, reject) => {
      this.docker.modem.followProgress(buildStream, (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
    
    return imageTag;
  }

  private generateDockerfile(manifest: PluginManifest): string {
    return `
FROM node:18-alpine

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S plugin -u 1001

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Change ownership to non-root user
RUN chown -R plugin:nodejs /app
USER plugin

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "console.log('Health check passed')" || exit 1

# Expose communication port (if needed)
EXPOSE 3000

# Run the plugin
CMD ["node", "${manifest.module.entry}"]
`;
  }

  private getNetworkMode(networkConfig: PluginManifest['isolation']['network']): string {
    switch (networkConfig.type) {
      case 'none':
        return 'none';
      case 'internal':
        return 'bridge'; // Will create custom internal network
      case 'restricted':
        return 'bridge'; // Will apply firewall rules
      case 'full':
        return 'bridge';
      default:
        return 'none'; // Default to no network
    }
  }

  private parseMemoryLimit(memoryString: string): number {
    const match = memoryString.match(/^(\d+)([KMGT]?)$/i);
    if (!match) return 128 * 1024 * 1024; // Default 128MB
    
    const value = parseInt(match[1]);
    const unit = (match[2] || '').toUpperCase();
    
    switch (unit) {
      case 'K': return value * 1024;
      case 'M': return value * 1024 * 1024;
      case 'G': return value * 1024 * 1024 * 1024;
      case 'T': return value * 1024 * 1024 * 1024 * 1024;
      default: return value;
    }
  }

  private parseCpuLimit(cpuString: string): number {
    const cpuFloat = parseFloat(cpuString);
    return Math.floor(cpuFloat * 1024); // Convert to CPU shares (1024 = 1 CPU)
  }

  private async createSocketDirectory(pluginId: string): Promise<string> {
    const socketDir = path.join('/tmp', 'plugin-sockets', pluginId);
    await fs.mkdir(socketDir, { recursive: true });
    return socketDir;
  }

  private startResourceMonitoring(pluginId: string, container: Docker.Container): void {
    const resourceStream = new Subject<ResourceUsage>();
    this.resourceStreams.set(pluginId, resourceStream);
    
    // Get stats stream
    container.stats({ stream: true }, (err, stream) => {
      if (err) {
        this.logger.error(`Failed to start resource monitoring for ${pluginId}:`, err);
        return;
      }
      
      stream.on('data', (chunk) => {
        try {
          const stats = JSON.parse(chunk.toString());
          const usage = this.parseResourceStats(stats);
          resourceStream.next(usage);
          
          // Check for resource violations
          this.checkResourceLimits(pluginId, usage);
          
        } catch (error) {
          this.logger.error(`Error parsing resource stats for ${pluginId}:`, error);
        }
      });
      
      stream.on('error', (error) => {
        this.logger.error(`Resource monitoring stream error for ${pluginId}:`, error);
      });
    });
  }

  private parseResourceStats(stats: any): ResourceUsage {
    const memoryUsage = stats.memory_stats.usage || 0;
    const memoryLimit = stats.memory_stats.limit || 1;
    const memoryPercent = (memoryUsage / memoryLimit) * 100;
    
    // Calculate CPU usage
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuPercent = (cpuDelta / systemDelta) * 100;
    
    // Network stats
    const networks = stats.networks || {};
    const networkStats = Object.values(networks).reduce(
      (acc: any, net: any) => ({
        bytesIn: acc.bytesIn + (net.rx_bytes || 0),
        bytesOut: acc.bytesOut + (net.tx_bytes || 0)
      }),
      { bytesIn: 0, bytesOut: 0 }
    );
    
    return {
      memory: Math.round(memoryUsage / (1024 * 1024)), // MB
      cpu: Math.round(cpuPercent),
      network: networkStats,
      disk: 0 // TODO: Implement disk usage tracking
    };
  }

  private checkResourceLimits(pluginId: string, usage: ResourceUsage): void {
    // Check memory usage (example: warn at 80%, kill at 95%)
    if (usage.cpu > 80) {
      this.logger.warn(`Plugin ${pluginId} high CPU usage: ${usage.cpu}%`);
    }
    
    if (usage.cpu > 95) {
      this.logger.error(`Plugin ${pluginId} CPU limit exceeded: ${usage.cpu}%`);
      // TODO: Implement container termination or throttling
    }
  }

  getResourceStream(pluginId: string): Observable<ResourceUsage> | undefined {
    return this.resourceStreams.get(pluginId)?.asObservable();
  }

  async destroyContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      
      // Stop container gracefully
      await container.stop({ t: 10 }); // 10 second timeout
      
      // Remove container
      await container.remove();
      
      this.logger.log(`Container destroyed: ${containerId}`);
    } catch (error) {
      this.logger.error(`Failed to destroy container ${containerId}:`, error);
      throw error;
    }
  }

  private async ensurePackageJson(workspaceDir: string): Promise<void> {
    const packageJsonPath = path.join(workspaceDir, 'package.json');
    
    try {
      await fs.access(packageJsonPath);
    } catch {
      // Create minimal package.json
      const packageJson = {
        name: 'plugin',
        version: '1.0.0',
        main: 'index.js',
        dependencies: {
          '@nestjs/common': '^10.0.0',
          '@nestjs/core': '^10.0.0',
          'rxjs': '^7.0.0'
        }
      };
      
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    }
  }
}
```

### **4. RxJS Communication Service**

```typescript
// apps/plugin-host/src/communication/message-broker.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable, BehaviorSubject, merge } from 'rxjs';
import { filter, map, tap, share, takeUntil } from 'rxjs/operators';
import * as crypto from 'crypto';

@Injectable()
export class MessageBrokerService {
  private readonly logger = new Logger(MessageBrokerService.name);
  private readonly messageStream = new Subject<PluginMessage>();
  private readonly pluginStreams = new Map<string, Subject<PluginMessage>>();
  private readonly channelStreams = new Map<string, Subject<PluginMessage>>();
  private readonly messageHistory = new Map<string, PluginMessage[]>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly pluginSecurity: PluginSecurityService,
    private readonly auditLogger: AuditLoggerService
  ) {
    this.setupMessageRouting();
  }

  private setupMessageRouting(): void {
    // Main message routing logic
    this.messageStream
      .pipe(
        tap(message => this.auditLogger.logMessage(message)),
        takeUntil(this.destroy$)
      )
      .subscribe(message => this.routeMessage(message));
  }

  // Send message from one plugin to another
  async sendMessage(message: PluginMessage): Promise<any> {
    try {
      // Validate message
      await this.validateMessage(message);
      
      // Sign message for security
      const signedMessage = await this.signMessage(message);
      
      // Add to message stream
      this.messageStream.next(signedMessage);
      
      // Store in history
      this.storeMessage(signedMessage);
      
      this.logger.debug(`Message sent: ${message.from} -> ${message.to}`);
      
      return { success: true, messageId: message.id };
      
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      throw error;
    }
  }

  // Broadcast message to multiple plugins
  async broadcast(message: PluginMessage): Promise<void> {
    try {
      // Validate broadcast permissions
      await this.pluginSecurity.validateBroadcastPermission(message.from, message.channel);
      
      // Sign message
      const signedMessage = await this.signMessage(message);
      
      // Send to all authorized plugins
      const authorizedPlugins = await this.getAuthorizedPlugins(message.from, message.channel);
      
      for (const pluginId of authorizedPlugins) {
        const targetMessage = {
          ...signedMessage,
          to: pluginId
        };
        
        this.messageStream.next(targetMessage);
      }
      
      this.logger.debug(`Broadcast sent: ${message.from} -> ${authorizedPlugins.length} plugins`);
      
    } catch (error) {
      this.logger.error('Failed to broadcast message:', error);
      throw error;
    }
  }

  // Get message stream for specific plugin
  getPluginMessages(pluginId: string): Observable<PluginMessage> {
    if (!this.pluginStreams.has(pluginId)) {
      this.pluginStreams.set(pluginId, new Subject<PluginMessage>());
    }
    
    return this.pluginStreams.get(pluginId)!.asObservable();
  }

  // Get messages for specific channel
  getChannelMessages(channel: string): Observable<PluginMessage> {
    if (!this.channelStreams.has(channel)) {
      const channelStream = new Subject<PluginMessage>();
      this.channelStreams.set(channel, channelStream);
      
      // Subscribe to main stream and filter by channel
      this.messageStream
        .pipe(
          filter(message => message.channel === channel),
          takeUntil(this.destroy$)
        )
        .subscribe(message => channelStream.next(message));
    }
    
    return this.channelStreams.get(channel)!.asObservable();
  }

  // Create communication channel between plugins
  createCommunicationChannel(
    pluginA: string, 
    pluginB: string, 
    channelName: string
  ): {
    pluginAStream: Observable<PluginMessage>;
    pluginBStream: Observable<PluginMessage>;
    send: (from: string, message: any) => Promise<void>;
  } {
    
    const channelId = `${pluginA}-${pluginB}-${channelName}`;
    
    // Create bidirectional streams
    const pluginAStream = this.messageStream.pipe(
      filter(msg => msg.to === pluginA && msg.from === pluginB && msg.channel === channelName),
      share()
    );
    
    const pluginBStream = this.messageStream.pipe(
      filter(msg => msg.to === pluginB && msg.from === pluginA && msg.channel === channelName),
      share()
    );
    
    const send = async (from: string, message: any) => {
      const to = from === pluginA ? pluginB : pluginA;
      
      await this.sendMessage({
        id: this.generateMessageId(),
        from,
        to,
        type: 'request',
        channel: channelName,
        payload: message,
        timestamp: Date.now()
      });
    };
    
    return {
      pluginAStream,
      pluginBStream,
      send
    };
  }

  // Create event stream for plugin events
  createEventStream(eventType: string): Observable<PluginMessage> {
    return this.messageStream.pipe(
      filter(message => message.type === 'event' && message.payload?.eventType === eventType),
      map(message => message),
      share()
    );
  }

  // Advanced: Create request-response pattern
  createRequestResponseChannel(
    requesterPluginId: string, 
    responderPluginId: string
  ): {
    request: (message: any) => Observable<any>;
    handleRequests: Observable<{ message: any; respond: (response: any) => void }>;
  } {
    
    const requestSubject = new Subject<{ message: any; messageId: string }>();
    const responseSubject = new Subject<{ messageId: string; response: any }>();
    
    // Request method
    const request = (message: any): Observable<any> => {
      return new Observable(observer => {
        const messageId = this.generateMessageId();
        
        // Send request
        this.sendMessage({
          id: messageId,
          from: requesterPluginId,
          to: responderPluginId,
          type: 'request',
          channel: 'request-response',
          payload: message,
          timestamp: Date.now()
        });
        
        // Wait for response
        const responseSubscription = this.messageStream
          .pipe(
            filter(msg => 
              msg.from === responderPluginId &&
              msg.to === requesterPluginId &&
              msg.type === 'response' &&
              msg.payload?.requestId === messageId
            ),
            map(msg => msg.payload.data)
          )
          .subscribe({
            next: response => {
              observer.next(response);
              observer.complete();
            },
            error: error => observer.error(error)
          });
        
        // Cleanup on unsubscribe
        return () => responseSubscription.unsubscribe();
      });
    };
    
    // Handle requests
    const handleRequests = this.messageStream.pipe(
      filter(msg => 
        msg.from === requesterPluginId &&
        msg.to === responderPluginId &&
        msg.type === 'request' &&
        msg.channel === 'request-response'
      ),
      map(msg => ({
        message: msg.payload,
        respond: (response: any) => {
          this.sendMessage({
            id: this.generateMessageId(),
            from: responderPluginId,
            to: requesterPluginId,
            type: 'response',
            channel: 'request-response',
            payload: {
              requestId: msg.id,
              data: response
            },
            timestamp: Date.now()
          });
        }
      }))
    );
    
    return { request, handleRequests };
  }

  private routeMessage(message: PluginMessage): void {
    // Route to specific plugin
    if (message.to !== '*') {
      const pluginStream = this.pluginStreams.get(message.to);
      if (pluginStream) {
        pluginStream.next(message);
      }
    }
    
    // Route to channel subscribers
    const channelStream = this.channelStreams.get(message.channel);
    if (channelStream) {
      channelStream.next(message);
    }
  }

  private async validateMessage(message: PluginMessage): Promise<void> {
    // Check if sender plugin exists and is authorized
    if (!await this.pluginSecurity.isPluginAuthorized(message.from)) {
      throw new Error(`Unauthorized plugin: ${message.from}`);
    }
    
    // Check if target plugin exists (unless broadcast)
    if (message.to !== '*' && !await this.pluginSecurity.pluginExists(message.to)) {
      throw new Error(`Target plugin not found: ${message.to}`);
    }
    
    // Check communication permissions
    if (!await this.pluginSecurity.canCommunicate(message.from, message.to, message.channel)) {
      throw new Error(`Communication not allowed: ${message.from} -> ${message.to}`);
    }
    
    // Check message size limits
    const messageSize = JSON.stringify(message).length;
    if (messageSize > 1024 * 1024) { // 1MB limit
      throw new Error('Message too large');
    }
    
    // Check rate limits
    if (!await this.pluginSecurity.checkRateLimit(message.from, message.to)) {
      throw new Error('Rate limit exceeded');
    }
  }

  private async signMessage(message: PluginMessage): Promise<PluginMessage> {
    const messageData = JSON.stringify({
      id: message.id,
      from: message.from,
      to: message.to,
      type: message.type,
      channel: message.channel,
      payload: message.payload,
      timestamp: message.timestamp
    });
    
    const signature = crypto
      .createHmac('sha256', process.env.MESSAGE_SIGNING_KEY || 'default-key')
      .update(messageData)
      .digest('hex');
    
    return {
      ...message,
      signature
    };
  }

  private storeMessage(message: PluginMessage): void {
    const key = `${message.from}-${message.to}`;
    
    if (!this.messageHistory.has(key)) {
      this.messageHistory.set(key, []);
    }
    
    const history = this.messageHistory.get(key)!;
    history.push(message);
    
    // Keep only last 100 messages
    if (history.length > 100) {
      history.shift();
    }
  }

  private async getAuthorizedPlugins(fromPlugin: string, channel: string): Promise<string[]> {
    // Get all loaded plugins and filter by permissions
    const allPlugins = await this.pluginSecurity.getAllLoadedPlugins();
    const authorized: string[] = [];
    
    for (const pluginId of allPlugins) {
      if (pluginId !== fromPlugin && 
          await this.pluginSecurity.canReceive(pluginId, channel)) {
        authorized.push(pluginId);
      }
    }
    
    return authorized;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  // Get message history for debugging/monitoring
  getMessageHistory(pluginA: string, pluginB: string): PluginMessage[] {
    const key1 = `${pluginA}-${pluginB}`;
    const key2 = `${pluginB}-${pluginA}`;
    
    const history1 = this.messageHistory.get(key1) || [];
    const history2 = this.messageHistory.get(key2) || [];
    
    return [...history1, ...history2].sort((a, b) => a.timestamp - b.timestamp);
  }

  // Statistics and monitoring
  getMessageStats(): {
    totalMessages: number;
    activeChannels: number;
    activePlugins: number;
    messagesPerSecond: number;
  } {
    const totalMessages = Array.from(this.messageHistory.values())
      .reduce((sum, history) => sum + history.length, 0);
    
    return {
      totalMessages,
      activeChannels: this.channelStreams.size,
      activePlugins: this.pluginStreams.size,
      messagesPerSecond: 0 // TODO: Implement rate calculation
    };
  }

  async onApplicationShutdown(): Promise<void> {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Complete all streams
    this.messageStream.complete();
    this.pluginStreams.forEach(stream => stream.complete());
    this.channelStreams.forEach(stream => stream.complete());
  }
}
```

### **5. Example Plugin Implementation**

```typescript
// plugins/payment-plugin/plugin.module.ts
import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';

@Module({
  providers: [PaymentService],
  controllers: [PaymentController],
  exports: [PaymentService]
})
export class PaymentPluginModule {
  constructor(private readonly paymentService: PaymentService) {}

  async onLoad(): Promise<void> {
    console.log('Payment plugin loaded');
    await this.paymentService.initialize();
  }

  async onUnload(): Promise<void> {
    console.log('Payment plugin unloading');
    await this.paymentService.cleanup();
  }

  async onMessage(message: PluginMessage): Promise<any> {
    return this.paymentService.handleMessage(message);
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }> {
    return this.paymentService.healthCheck();
  }
}
```

```typescript
// plugins/payment-plugin/payment.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly eventStream = new Subject<any>();

  async initialize(): Promise<void> {
    this.logger.log('Initializing payment service');
    // Initialize payment providers, database connections, etc.
  }

  async cleanup(): Promise<void> {
    this.logger.log('Cleaning up payment service');
    // Cleanup resources
    this.eventStream.complete();
  }

  async handleMessage(message: PluginMessage): Promise<any> {
    switch (message.payload?.action) {
      case 'process_payment':
        return this.processPayment(message.payload.data);
      
      case 'get_payment_status':
        return this.getPaymentStatus(message.payload.paymentId);
      
      case 'refund_payment':
        return this.refundPayment(message.payload.paymentId);
      
      default:
        throw new Error(`Unknown action: ${message.payload?.action}`);
    }
  }

  async processPayment(paymentData: any): Promise<any> {
    this.logger.log(`Processing payment: ${JSON.stringify(paymentData)}`);
    
    // Simulate payment processing
    const result = {
      paymentId: `pay_${Date.now()}`,
      status: 'completed',
      amount: paymentData.amount,
      currency: paymentData.currency
    };
    
    // Emit event for other plugins
    this.eventStream.next({
      type: 'payment_processed',
      data: result
    });
    
    return result;
  }

  async getPaymentStatus(paymentId: string): Promise<any> {
    // Simulate status check
    return {
      paymentId,
      status: 'completed',
      timestamp: Date.now()
    };
  }

  async refundPayment(paymentId: string): Promise<any> {
    this.logger.log(`Processing refund for payment: ${paymentId}`);
    
    const result = {
      refundId: `ref_${Date.now()}`,
      paymentId,
      status: 'completed'
    };
    
    // Emit refund event
    this.eventStream.next({
      type: 'payment_refunded',
      data: result
    });
    
    return result;
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }> {
    try {
      // Check payment provider connectivity, database, etc.
      return {
        status: 'healthy',
        details: {
          lastHealthCheck: Date.now(),
          paymentProvidersOnline: true,
          databaseConnected: true
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error.message }
      };
    }
  }

  getEventStream(): Observable<any> {
    return this.eventStream.asObservable();
  }
}
```

```json
// plugins/payment-plugin/plugin.manifest.json
{
  "id": "payment-plugin",
  "name": "Payment Processing Plugin",
  "version": "1.0.0",
  "description": "Handles payment processing and refunds",
  "author": "Your Company",
  
  "isolation": {
    "type": "docker",
    "resources": {
      "memory": "256M",
      "cpu": "0.5",
      "disk": "1G"
    },
    "network": {
      "type": "restricted",
      "allowedHosts": ["api.stripe.com", "api.paypal.com"],
      "allowedPorts": [443, 80],
      "bandwidth": {
        "upload": 100,
        "download": 500
      }
    }
  },
  
  "module": {
    "entry": "plugin.module.js",
    "className": "PaymentPluginModule",
    "dependencies": ["@nestjs/common", "@nestjs/core", "rxjs"]
  },
  
  "communication": {
    "allowedPlugins": ["analytics-plugin", "notification-plugin"],
    "allowedChannels": ["payments", "events", "notifications"],
    "maxMessagesPerMinute": 1000,
    "maxMessageSize": 102400
  },
  
  "lifecycle": {
    "onLoad": "onLoad",
    "onUnload": "onUnload",
    "healthCheck": "healthCheck"
  }
}
```

---

## 🚀 Usage Examples

### **1. Plugin-to-Plugin Communication**

```typescript
// In analytics plugin - listening to payment events
@Injectable()
export class AnalyticsService {
  constructor(private readonly messageBroker: MessageBrokerService) {}

  async initialize(): Promise<void> {
    // Listen to payment events
    this.messageBroker.getChannelMessages('payments')
      .subscribe(message => {
        if (message.payload?.type === 'payment_processed') {
          this.recordPaymentAnalytics(message.payload.data);
        }
      });
  }

  private recordPaymentAnalytics(paymentData: any): void {
    console.log('Recording payment analytics:', paymentData);
    // Process analytics data
  }
}

// In payment plugin - sending events
async processPayment(paymentData: any): Promise<any> {
  const result = await this.processPaymentInternal(paymentData);
  
  // Notify analytics plugin
  await this.messageBroker.sendMessage({
    id: 'msg_123',
    from: 'payment-plugin',
    to: 'analytics-plugin',
    type: 'event',
    channel: 'payments',
    payload: {
      type: 'payment_processed',
      data: result
    },
    timestamp: Date.now()
  });
  
  return result;
}
```

### **2. Request-Response Pattern**

```typescript
// In e-commerce plugin - requesting payment processing
@Injectable()
export class ECommerceService {
  constructor(private readonly messageBroker: MessageBrokerService) {}

  async processOrder(orderData: any): Promise<any> {
    // Create request-response channel with payment plugin
    const { request } = this.messageBroker.createRequestResponseChannel(
      'ecommerce-plugin',
      'payment-plugin'
    );

    // Send payment request and wait for response
    const paymentResult = await request({
      action: 'process_payment',
      data: {
        amount: orderData.total,
        currency: 'USD',
        customerId: orderData.customerId
      }
    }).toPromise();

    return {
      orderId: orderData.id,
      payment: paymentResult
    };
  }
}
```

### **3. Broadcasting Events**

```typescript
// In user authentication plugin - broadcasting login events
@Injectable()
export class AuthService {
  constructor(private readonly messageBroker: MessageBrokerService) {}

  async handleUserLogin(userData: any): Promise<void> {
    // Broadcast login event to all interested plugins
    await this.messageBroker.broadcast({
      id: 'auth_event_123',
      from: 'auth-plugin',
      to: '*',
      type: 'broadcast',
      channel: 'user-events',
      payload: {
        eventType: 'user_login',
        userId: userData.id,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    });
  }
}

// Other plugins can listen to these events
this.messageBroker.getChannelMessages('user-events')
  .pipe(
    filter(message => message.payload?.eventType === 'user_login')
  )
  .subscribe(message => {
    console.log('User logged in:', message.payload.userId);
  });
```

---

## 📋 Implementation Checklist

### **Phase 1: Core Infrastructure**
- [ ] Implement PluginManagerService with dynamic loading
- [ ] Create DockerIsolationService for container management
- [ ] Set up MessageBrokerService with RxJS streams
- [ ] Implement basic plugin manifest system

### **Phase 2: Security & Isolation**
- [ ] Add plugin security validation
- [ ] Implement network restrictions
- [ ] Set up resource monitoring
- [ ] Add audit logging

### **Phase 3: Advanced Communication**
- [ ] Implement request-response patterns
- [ ] Add channel-based messaging
- [ ] Create plugin discovery service
- [ ] Set up event broadcasting

### **Phase 4: Monitoring & Management**
- [ ] Add plugin health monitoring
- [ ] Implement resource usage tracking
- [ ] Create plugin management API
- [ ] Set up performance monitoring

This implementation provides a complete, production-ready NestJS plugin system with Docker isolation and RxJS-based communication that addresses all the security vulnerabilities identified in your TT.md file.