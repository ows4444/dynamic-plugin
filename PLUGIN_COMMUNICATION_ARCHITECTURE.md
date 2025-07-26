# Secure Plugin Communication Architecture
## Inter-Plugin & Host Communication Design

This document outlines how plugins communicate securely with each other and the host system while maintaining isolation and security boundaries.

---

## 🏗️ Communication Architecture Overview

### **Security Principles:**
1. **Zero Direct Communication** - Plugins never communicate directly
2. **Host-Mediated Communication** - All communication goes through the host
3. **Message Authentication** - All messages are signed and verified
4. **Permission-Based Access** - Communication requires explicit permissions
5. **Audit Trail** - All communications are logged for security monitoring

### **Communication Flow:**
```
Plugin A ←→ Host Message Broker ←→ Plugin B
    ↓              ↓                   ↓
Container A    Host Process       Container B
```

---

## 🔄 Communication Patterns

### **1. Plugin-to-Host Communication**

Every plugin communicates with the host via a secure message broker:

```typescript
// apps/plugin-host/src/communication/message-broker.service.ts
import * as crypto from 'crypto';
import { EventEmitter } from 'events';

export interface PluginMessage {
  id: string;
  from: string;          // Plugin ID
  to: string;            // 'host' or target plugin ID
  type: 'request' | 'response' | 'event' | 'broadcast';
  action: string;        // Specific action/method
  payload: any;          // Message data
  timestamp: number;     // Message timestamp
  signature?: string;    // HMAC signature
  permissions?: string[]; // Required permissions
}

export class SecureMessageBroker extends EventEmitter {
  private pluginConnections = new Map<string, PluginConnection>();
  private messageQueue = new Map<string, PluginMessage[]>();
  private signingKeys = new Map<string, Buffer>();
  private routingTable = new Map<string, string[]>(); // Plugin -> allowed targets

  constructor(
    private permissionService: PluginPermissionService,
    private auditLogger: SecurityAuditLogger
  ) {
    super();
    this.setupMessageHandling();
  }

  // Register plugin connection
  async registerPlugin(pluginId: string, connectionInfo: PluginConnection): Promise<void> {
    // Generate unique signing key for this plugin
    const signingKey = crypto.randomBytes(32);
    this.signingKeys.set(pluginId, signingKey);
    
    // Set up communication channel
    this.pluginConnections.set(pluginId, connectionInfo);
    
    // Initialize message queue
    this.messageQueue.set(pluginId, []);
    
    // Set up connection monitoring
    this.monitorConnection(pluginId, connectionInfo);
    
    // Send signing key to plugin (secure channel)
    await this.sendSigningKey(pluginId, signingKey);
    
    this.auditLogger.logSecurityEvent({
      type: 'PLUGIN_REGISTERED',
      pluginId,
      timestamp: Date.now(),
      severity: 'INFO'
    });
  }

  // Send message from plugin to host or another plugin
  async routeMessage(message: PluginMessage): Promise<any> {
    try {
      // Validate message signature
      if (!this.verifyMessageSignature(message)) {
        throw new Error('Invalid message signature');
      }

      // Check message age (prevent replay attacks)
      if (Date.now() - message.timestamp > 30000) { // 30 seconds
        throw new Error('Message expired');
      }

      // Validate permissions
      await this.validateMessagePermissions(message);

      // Log communication attempt
      this.auditLogger.logSecurityEvent({
        type: 'PLUGIN_COMMUNICATION',
        pluginId: message.from,
        targetId: message.to,
        action: message.action,
        timestamp: Date.now(),
        severity: 'INFO'
      });

      // Route message based on target
      if (message.to === 'host') {
        return await this.handleHostMessage(message);
      } else {
        return await this.routePluginMessage(message);
      }

    } catch (error) {
      this.auditLogger.logSecurityEvent({
        type: 'COMMUNICATION_ERROR',
        pluginId: message.from,
        error: error.message,
        timestamp: Date.now(),
        severity: 'WARNING'
      });
      throw error;
    }
  }

  private async handleHostMessage(message: PluginMessage): Promise<any> {
    switch (message.action) {
      case 'get_config':
        return await this.handleGetConfig(message);
      
      case 'store_data':
        return await this.handleStoreData(message);
      
      case 'get_data':
        return await this.handleGetData(message);
      
      case 'send_to_plugin':
        return await this.handleSendToPlugin(message);
      
      case 'broadcast':
        return await this.handleBroadcast(message);
      
      case 'request_permission':
        return await this.handlePermissionRequest(message);
      
      default:
        throw new Error(`Unknown host action: ${message.action}`);
    }
  }

  private async routePluginMessage(message: PluginMessage): Promise<any> {
    const targetPluginId = message.to;
    
    // Check if target plugin exists and is active
    if (!this.pluginConnections.has(targetPluginId)) {
      throw new Error(`Target plugin not found: ${targetPluginId}`);
    }

    // Check communication permissions
    if (!await this.canCommunicate(message.from, targetPluginId)) {
      throw new Error(`Communication not allowed: ${message.from} -> ${targetPluginId}`);
    }

    // Forward message to target plugin
    const targetConnection = this.pluginConnections.get(targetPluginId)!;
    return await this.forwardMessage(targetConnection, message);
  }

  private verifyMessageSignature(message: PluginMessage): boolean {
    const signingKey = this.signingKeys.get(message.from);
    if (!signingKey) {
      return false;
    }

    const messageData = JSON.stringify({
      id: message.id,
      from: message.from,
      to: message.to,
      type: message.type,
      action: message.action,
      payload: message.payload,
      timestamp: message.timestamp
    });

    const expectedSignature = crypto
      .createHmac('sha256', signingKey)
      .update(messageData)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(message.signature || '', 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  private async validateMessagePermissions(message: PluginMessage): Promise<void> {
    const requiredPermissions = this.getRequiredPermissions(message.action);
    
    for (const permission of requiredPermissions) {
      if (!await this.permissionService.hasPermission(message.from, permission)) {
        throw new Error(`Missing permission: ${permission}`);
      }
    }
  }

  private getRequiredPermissions(action: string): string[] {
    const permissionMap: Record<string, string[]> = {
      'store_data': ['STORAGE_WRITE'],
      'get_data': ['STORAGE_READ'],
      'send_to_plugin': ['PLUGIN_COMMUNICATION'],
      'broadcast': ['PLUGIN_BROADCAST'],
      'request_permission': ['PERMISSION_REQUEST'],
      'get_config': ['CONFIG_READ']
    };

    return permissionMap[action] || [];
  }
}
```

### **2. Plugin-to-Plugin Communication**

Plugins communicate indirectly through the host message broker:

```typescript
// apps/plugin-host/src/communication/plugin-communication.service.ts
export class PluginCommunicationService {
  constructor(private messageBroker: SecureMessageBroker) {}

  // Send message from one plugin to another
  async sendToPlugin(fromPluginId: string, toPluginId: string, action: string, payload: any): Promise<any> {
    // Check communication rules
    const rules = await this.getCommunicationRules(fromPluginId, toPluginId);
    if (!rules.allowed) {
      throw new Error(`Communication blocked: ${rules.reason}`);
    }

    // Create secure message
    const message: PluginMessage = {
      id: crypto.randomUUID(),
      from: fromPluginId,
      to: toPluginId,
      type: 'request',
      action,
      payload: this.sanitizePayload(payload),
      timestamp: Date.now()
    };

    // Route through message broker
    return await this.messageBroker.routeMessage(message);
  }

  // Broadcast message to multiple plugins
  async broadcast(fromPluginId: string, action: string, payload: any, targets?: string[]): Promise<void> {
    // Check broadcast permissions
    if (!await this.permissionService.hasPermission(fromPluginId, 'PLUGIN_BROADCAST')) {
      throw new Error('Broadcast permission required');
    }

    const allowedTargets = targets || await this.getAllowedBroadcastTargets(fromPluginId);
    
    const broadcastPromises = allowedTargets.map(async (targetId) => {
      try {
        await this.sendToPlugin(fromPluginId, targetId, action, payload);
      } catch (error) {
        // Log error but don't fail entire broadcast
        console.error(`Broadcast failed to ${targetId}:`, error);
      }
    });

    await Promise.allSettled(broadcastPromises);
  }

  // Set up communication rules between plugins
  async setCommunicationRules(fromPluginId: string, toPluginId: string, rules: CommunicationRules): Promise<void> {
    // Only admin or the plugins themselves can set rules
    if (!await this.canModifyRules(fromPluginId, toPluginId)) {
      throw new Error('Insufficient permissions to modify communication rules');
    }

    await this.storeCommunicationRules(fromPluginId, toPluginId, rules);
  }

  private async getCommunicationRules(fromPluginId: string, toPluginId: string): Promise<CommunicationRules> {
    // Check plugin-specific rules
    const specificRules = await this.getStoredRules(fromPluginId, toPluginId);
    if (specificRules) {
      return specificRules;
    }

    // Apply default rules based on plugin types and permissions
    return await this.getDefaultCommunicationRules(fromPluginId, toPluginId);
  }

  private sanitizePayload(payload: any): any {
    // Remove potentially dangerous properties
    if (typeof payload === 'object' && payload !== null) {
      const sanitized = { ...payload };
      
      // Remove prototype pollution attempts
      delete sanitized.__proto__;
      delete sanitized.constructor;
      delete sanitized.prototype;
      
      // Recursively sanitize nested objects
      Object.keys(sanitized).forEach(key => {
        if (typeof sanitized[key] === 'object') {
          sanitized[key] = this.sanitizePayload(sanitized[key]);
        }
      });
      
      return sanitized;
    }
    
    return payload;
  }
}
```

### **3. Communication Channels Implementation**

Different types of secure communication channels:

```typescript
// apps/plugin-host/src/communication/communication-channels.service.ts
export class CommunicationChannelsService {
  private channels = new Map<string, CommunicationChannel>();

  // Docker-based communication via Unix sockets
  async createDockerChannel(pluginId: string, containerId: string): Promise<DockerChannel> {
    const socketPath = `/tmp/plugin-${pluginId}.sock`;
    
    const channel = new DockerChannel({
      pluginId,
      containerId,
      socketPath,
      encryption: true,
      maxMessageSize: 1024 * 1024, // 1MB limit
      timeout: 30000 // 30 second timeout
    });

    await channel.initialize();
    this.channels.set(pluginId, channel);
    
    return channel;
  }

  // Process-based communication via IPC
  async createProcessChannel(pluginId: string, childProcess: ChildProcess): Promise<ProcessChannel> {
    const channel = new ProcessChannel({
      pluginId,
      process: childProcess,
      encryption: true,
      maxMessageSize: 512 * 1024, // 512KB limit
      timeout: 15000 // 15 second timeout
    });

    await channel.initialize();
    this.channels.set(pluginId, channel);
    
    return channel;
  }

  // WebSocket-based communication (for web-based plugins)
  async createWebSocketChannel(pluginId: string, websocket: WebSocket): Promise<WebSocketChannel> {
    const channel = new WebSocketChannel({
      pluginId,
      websocket,
      encryption: true,
      maxMessageSize: 256 * 1024, // 256KB limit
      timeout: 10000 // 10 second timeout
    });

    await channel.initialize();
    this.channels.set(pluginId, channel);
    
    return channel;
  }
}

// Base communication channel
abstract class CommunicationChannel {
  protected encryptionKey: Buffer;
  protected messageQueue: PluginMessage[] = [];
  protected isActive = false;

  constructor(protected config: ChannelConfig) {
    this.encryptionKey = crypto.randomBytes(32);
  }

  abstract async initialize(): Promise<void>;
  abstract async sendMessage(message: PluginMessage): Promise<any>;
  abstract async close(): Promise<void>;

  protected encryptMessage(message: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    cipher.setAAD(Buffer.from('plugin-communication'));
    
    let encrypted = cipher.update(message, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      iv: iv.toString('hex'),
      encrypted,
      authTag: authTag.toString('hex')
    });
  }

  protected decryptMessage(encryptedData: string): string {
    const { iv, encrypted, authTag } = JSON.parse(encryptedData);
    
    const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
    decipher.setAAD(Buffer.from('plugin-communication'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// Docker-specific channel implementation
class DockerChannel extends CommunicationChannel {
  private server?: net.Server;
  private socket?: net.Socket;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.socket = socket;
        this.isActive = true;
        
        socket.on('data', (data) => {
          this.handleIncomingMessage(data);
        });
        
        socket.on('error', (error) => {
          this.handleConnectionError(error);
        });
        
        socket.on('close', () => {
          this.isActive = false;
        });
        
        resolve();
      });
      
      this.server.listen(this.config.socketPath, (error) => {
        if (error) reject(error);
      });
    });
  }

  async sendMessage(message: PluginMessage): Promise<any> {
    if (!this.socket || !this.isActive) {
      throw new Error('Channel not active');
    }

    const encryptedMessage = this.encryptMessage(JSON.stringify(message));
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, this.config.timeout);

      this.socket!.write(encryptedMessage, (error) => {
        clearTimeout(timeout);
        if (error) {
          reject(error);
        } else {
          resolve(true);
        }
      });
    });
  }

  private handleIncomingMessage(data: Buffer): void {
    try {
      const decryptedData = this.decryptMessage(data.toString());
      const message = JSON.parse(decryptedData) as PluginMessage;
      
      // Emit message event for processing
      this.emit('message', message);
    } catch (error) {
      this.emit('error', new Error('Failed to process incoming message'));
    }
  }
}
```

---

## 🔐 Security Controls

### **1. Permission-Based Communication**

```typescript
// apps/plugin-host/src/security/communication-permissions.service.ts
export class CommunicationPermissionsService {
  private permissionMatrix = new Map<string, Map<string, CommunicationPermission>>();

  // Define what actions one plugin can perform with another
  async setPluginCommunicationPermissions(
    fromPluginId: string, 
    toPluginId: string, 
    permissions: CommunicationPermission
  ): Promise<void> {
    if (!this.permissionMatrix.has(fromPluginId)) {
      this.permissionMatrix.set(fromPluginId, new Map());
    }
    
    this.permissionMatrix.get(fromPluginId)!.set(toPluginId, permissions);
  }

  // Check if plugin A can communicate with plugin B
  async canCommunicate(fromPluginId: string, toPluginId: string, action: string): Promise<boolean> {
    const pluginPermissions = this.permissionMatrix.get(fromPluginId);
    if (!pluginPermissions) {
      return false;
    }

    const targetPermissions = pluginPermissions.get(toPluginId);
    if (!targetPermissions) {
      return false;
    }

    return targetPermissions.allowedActions.includes(action) || 
           targetPermissions.allowedActions.includes('*');
  }

  // Get communication policy for plugin pairs
  async getCommunicationPolicy(fromPluginId: string, toPluginId: string): Promise<CommunicationPolicy> {
    const fromPlugin = await this.getPluginInfo(fromPluginId);
    const toPlugin = await this.getPluginInfo(toPluginId);

    // Define policies based on plugin types and trust levels
    return {
      allowed: this.isPolicyAllowed(fromPlugin, toPlugin),
      restrictions: this.getPolicyRestrictions(fromPlugin, toPlugin),
      rateLimits: this.getRateLimits(fromPlugin, toPlugin),
      auditLevel: this.getAuditLevel(fromPlugin, toPlugin)
    };
  }

  private isPolicyAllowed(fromPlugin: PluginInfo, toPlugin: PluginInfo): boolean {
    // System plugins can communicate with any plugin
    if (fromPlugin.type === 'system') {
      return true;
    }

    // Third-party plugins can only communicate with explicitly allowed plugins
    if (fromPlugin.type === 'third-party') {
      return fromPlugin.allowedTargets?.includes(toPlugin.id) || false;
    }

    // Default: allow same-vendor communications
    return fromPlugin.vendor === toPlugin.vendor;
  }
}

export interface CommunicationPermission {
  allowedActions: string[];        // Specific actions allowed
  rateLimitPerMinute: number;      // Rate limiting
  maxMessageSize: number;          // Message size limits
  allowBroadcast: boolean;         // Can broadcast to this plugin
  requireEncryption: boolean;      // Require encrypted communication
  auditLevel: 'none' | 'basic' | 'full'; // Audit logging level
}

export interface CommunicationPolicy {
  allowed: boolean;
  restrictions: string[];
  rateLimits: {
    messagesPerMinute: number;
    maxConcurrentConnections: number;
  };
  auditLevel: 'none' | 'basic' | 'full';
}
```

### **2. Message Rate Limiting**

```typescript
// apps/plugin-host/src/security/rate-limiter.service.ts
export class CommunicationRateLimiter {
  private rateLimits = new Map<string, RateLimitTracker>();

  async checkRateLimit(fromPluginId: string, toPluginId: string): Promise<boolean> {
    const limitKey = `${fromPluginId}->${toPluginId}`;
    let tracker = this.rateLimits.get(limitKey);
    
    if (!tracker) {
      const limits = await this.getRateLimits(fromPluginId, toPluginId);
      tracker = new RateLimitTracker(limits);
      this.rateLimits.set(limitKey, tracker);
    }

    return tracker.canSendMessage();
  }

  async recordMessage(fromPluginId: string, toPluginId: string, messageSize: number): Promise<void> {
    const limitKey = `${fromPluginId}->${toPluginId}`;
    const tracker = this.rateLimits.get(limitKey);
    
    if (tracker) {
      tracker.recordMessage(messageSize);
    }
  }
}

class RateLimitTracker {
  private messageCount = 0;
  private totalBytes = 0;
  private windowStart = Date.now();

  constructor(private limits: RateLimits) {}

  canSendMessage(): boolean {
    this.resetWindowIfNeeded();
    
    return this.messageCount < this.limits.maxMessagesPerMinute &&
           this.totalBytes < this.limits.maxBytesPerMinute;
  }

  recordMessage(size: number): void {
    this.messageCount++;
    this.totalBytes += size;
  }

  private resetWindowIfNeeded(): void {
    const now = Date.now();
    if (now - this.windowStart > 60000) { // 1 minute window
      this.messageCount = 0;
      this.totalBytes = 0;
      this.windowStart = now;
    }
  }
}
```

---

## 📊 Communication Patterns Examples

### **Example 1: Payment Plugin → Database Plugin**
```typescript
// Payment plugin needs to store transaction data
const paymentPlugin = new PluginClient('payment-plugin-v1');

// Request permission to communicate with database plugin
await paymentPlugin.requestCommunication('database-plugin', ['store_transaction', 'query_transaction']);

// Send transaction data
const result = await paymentPlugin.sendToPlugin('database-plugin', 'store_transaction', {
  transactionId: 'tx_123',
  amount: 100.00,
  currency: 'USD',
  timestamp: Date.now()
});
```

### **Example 2: Analytics Plugin → Multiple Data Sources**
```typescript
// Analytics plugin broadcasts data collection request
const analyticsPlugin = new PluginClient('analytics-plugin-v1');

// Broadcast to all plugins that can provide analytics data
await analyticsPlugin.broadcast('collect_analytics_data', {
  timeRange: { start: startDate, end: endDate },
  metrics: ['page_views', 'user_interactions', 'performance']
});

// Listen for responses
analyticsPlugin.on('analytics_data_response', (data) => {
  console.log('Received analytics data from:', data.source);
});
```

### **Example 3: Authentication Plugin → All Plugins**
```typescript
// Authentication plugin notifies all plugins of user login
const authPlugin = new PluginClient('auth-plugin-v1');

// Broadcast authentication event
await authPlugin.broadcast('user_authenticated', {
  userId: 'user_123',
  permissions: ['read', 'write'],
  sessionId: 'session_abc'
});
```

---

## 🔍 Monitoring and Debugging

### **Communication Monitoring Dashboard**

```typescript
// apps/plugin-host/src/monitoring/communication-monitor.service.ts
export class CommunicationMonitorService {
  private communicationStats = new Map<string, CommunicationStats>();

  monitorCommunication(): void {
    // Track message volume
    this.trackMessageVolume();
    
    // Monitor communication patterns
    this.analyzePatterns();
    
    // Detect anomalies
    this.detectAnomalies();
    
    // Generate alerts
    this.checkAlertConditions();
  }

  private trackMessageVolume(): void {
    setInterval(() => {
      const stats = this.calculateCurrentStats();
      
      // Alert on unusual message volume
      if (stats.messagesPerSecond > 100) {
        this.triggerAlert('HIGH_MESSAGE_VOLUME', stats);
      }
      
      // Alert on failed communications
      if (stats.failureRate > 0.1) { // 10% failure rate
        this.triggerAlert('HIGH_FAILURE_RATE', stats);
      }
    }, 1000);
  }

  generateCommunicationReport(): CommunicationReport {
    return {
      totalMessages: this.getTotalMessages(),
      activeChannels: this.getActiveChannels(),
      topCommunicators: this.getTopCommunicators(),
      errorRate: this.getErrorRate(),
      averageLatency: this.getAverageLatency(),
      securityEvents: this.getSecurityEvents()
    };
  }
}
```

---

## 📋 Implementation Checklist

### **Phase 1: Core Communication Infrastructure**
- [ ] Implement SecureMessageBroker
- [ ] Create CommunicationChannelsService
- [ ] Set up Docker/Process communication channels
- [ ] Implement message signing and verification

### **Phase 2: Security Controls**
- [ ] Implement permission-based communication
- [ ] Add rate limiting for messages
- [ ] Create communication policies
- [ ] Set up audit logging

### **Phase 3: Advanced Features**
- [ ] Implement plugin discovery service
- [ ] Add broadcast messaging
- [ ] Create communication monitoring
- [ ] Set up anomaly detection

### **Phase 4: Testing and Validation**
- [ ] Test inter-plugin communication
- [ ] Validate security controls
- [ ] Test rate limiting
- [ ] Verify audit logging

---

## 🚨 Security Considerations

1. **Never Allow Direct Communication** - All communication must go through the host
2. **Sign All Messages** - Prevent message tampering and replay attacks
3. **Enforce Rate Limits** - Prevent communication-based DoS attacks
4. **Log Everything** - Maintain audit trail for security analysis
5. **Validate Permissions** - Check permissions for every communication attempt
6. **Encrypt Sensitive Data** - Use encryption for sensitive communication
7. **Monitor Patterns** - Watch for unusual communication patterns
8. **Fail Securely** - Default to blocking communication on errors

This architecture ensures that plugins can communicate securely while maintaining isolation and preventing the security vulnerabilities identified in your current system.