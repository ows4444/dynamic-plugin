# Plugin System Security Best Practices

## Executive Summary

This document provides comprehensive security best practices for building secure plugin systems, based on the security vulnerabilities identified in the current codebase. These guidelines are essential for any plugin architecture to prevent system compromise, data breaches, and unauthorized access.

---

## 🔒 Core Security Principles

### 1. **Zero Trust Architecture**
- Assume all plugins are potentially malicious
- Verify every plugin operation and resource access
- Implement strict permission boundaries
- Never trust plugin-provided data without validation

### 2. **Defense in Depth**
- Multiple security layers (process, network, file system, application)
- Fail-safe defaults (deny by default, explicit allow)
- Redundant security controls
- Comprehensive monitoring and alerting

### 3. **Principle of Least Privilege**
- Plugins receive minimum necessary permissions
- Time-limited access tokens
- Granular capability-based permissions
- Regular permission audits and reviews

---

## 🏗️ Secure Plugin Architecture

### **Process Isolation (Critical)**

#### ✅ **Recommended Approaches:**
```typescript
// Use separate processes for each plugin
const pluginProcess = spawn('node', ['--security-sandbox', pluginPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  uid: PLUGIN_USER_ID,  // Dedicated low-privilege user
  gid: PLUGIN_GROUP_ID,
  cwd: pluginSandboxDir,
  env: sanitizedEnvironment
});

// Use containers for maximum isolation
const dockerContainer = await docker.createContainer({
  Image: 'secure-plugin-runtime:latest',
  WorkingDir: '/plugin',
  User: 'plugin:plugin',
  Memory: 128 * 1024 * 1024, // 128MB limit
  CpuShares: 512,
  NetworkMode: 'none', // No network access by default
  ReadonlyRootfs: true,
  Volumes: {
    '/plugin': {}
  }
});
```

#### ❌ **Avoid:**
- VM-based sandboxing (too many escape vectors)
- Same-process execution with globals
- Shared memory between plugins and host

### **Secure Communication Channels**

#### ✅ **Best Practices:**
```typescript
// Use structured IPC with validation
interface PluginMessage {
  type: 'request' | 'response' | 'event';
  id: string;
  payload: unknown;
  signature: string; // HMAC signature
}

class SecurePluginCommunication {
  private readonly secretKey: Buffer;
  
  validateMessage(message: PluginMessage): boolean {
    // Verify HMAC signature
    const expectedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(JSON.stringify({ type: message.type, id: message.id, payload: message.payload }))
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(message.signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }
  
  sanitizePayload(payload: unknown): unknown {
    // Remove prototype pollution attempts
    return JSON.parse(JSON.stringify(payload, (key, value) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return undefined;
      }
      return value;
    }));
  }
}
```

---

## 🛡️ Input Validation & Sanitization

### **File Path Security**

#### ✅ **Secure Path Handling:**
```typescript
import path from 'path';
import { promises as fs } from 'fs';

class SecurePathValidator {
  private readonly allowedBasePaths: string[];
  
  constructor(basePaths: string[]) {
    this.allowedBasePaths = basePaths.map(p => path.resolve(p));
  }
  
  async validatePath(userPath: string): Promise<string> {
    // Resolve to absolute path
    const resolvedPath = path.resolve(userPath);
    
    // Check if within allowed directories
    const isAllowed = this.allowedBasePaths.some(basePath => 
      resolvedPath.startsWith(basePath + path.sep) || resolvedPath === basePath
    );
    
    if (!isAllowed) {
      throw new Error('Path outside allowed directories');
    }
    
    // Verify path exists and get real path (resolves symlinks)
    const realPath = await fs.realpath(resolvedPath);
    
    // Double-check after symlink resolution
    const stillAllowed = this.allowedBasePaths.some(basePath => 
      realPath.startsWith(basePath + path.sep) || realPath === basePath
    );
    
    if (!stillAllowed) {
      throw new Error('Symlink points outside allowed directories');
    }
    
    return realPath;
  }
}
```

### **Dynamic Import Security**

#### ✅ **Safe Module Loading:**
```typescript
class SecureModuleLoader {
  private readonly allowedModules = new Set([
    // Explicitly whitelist allowed modules
    'crypto', 'util', 'events'
  ]);
  
  async loadPlugin(pluginPath: string): Promise<any> {
    // Validate plugin path
    const validatedPath = await this.validatePluginPath(pluginPath);
    
    // Static analysis of plugin code
    await this.analyzePluginSecurity(validatedPath);
    
    // Load in restricted context
    const vm = require('vm');
    const sandbox = this.createSecureSandbox();
    
    const pluginCode = await fs.readFile(validatedPath, 'utf8');
    const wrappedCode = this.wrapPluginCode(pluginCode);
    
    return vm.runInNewContext(wrappedCode, sandbox, {
      filename: validatedPath,
      timeout: 5000,
      displayErrors: false
    });
  }
  
  private createSecureSandbox(): any {
    return {
      // Only provide safe globals
      Buffer: undefined, // Remove Buffer to prevent escapes
      process: {
        env: {}, // Empty environment
        version: process.version,
        platform: process.platform
      },
      require: this.createSecureRequire(),
      console: this.createSecureConsole(),
      setTimeout: this.createSecureTimeout(),
      setInterval: undefined, // Disable intervals
      global: undefined,
      __dirname: undefined,
      __filename: undefined
    };
  }
}
```

---

## 🔐 Authentication & Authorization

### **Plugin Authentication**

#### ✅ **Secure Token Management:**
```typescript
class PluginAuthenticationService {
  private readonly tokenStore: Map<string, PluginToken> = new Map();
  private readonly revokedTokens: Set<string> = new Set();
  
  async generatePluginToken(pluginId: string, permissions: string[]): Promise<string> {
    const token: PluginToken = {
      id: crypto.randomBytes(32).toString('hex'),
      pluginId,
      permissions: new Set(permissions),
      issuedAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      rateLimit: {
        requests: 0,
        windowStart: Date.now(),
        maxRequests: 1000
      }
    };
    
    this.tokenStore.set(token.id, token);
    
    // Return signed JWT
    return jwt.sign(
      { pluginId, permissions, tokenId: token.id },
      process.env.JWT_SECRET!,
      { expiresIn: '24h', algorithm: 'HS256' }
    );
  }
  
  async validateToken(tokenString: string): Promise<PluginToken | null> {
    try {
      const payload = jwt.verify(tokenString, process.env.JWT_SECRET!) as any;
      
      if (this.revokedTokens.has(payload.tokenId)) {
        return null;
      }
      
      const token = this.tokenStore.get(payload.tokenId);
      if (!token || token.expiresAt < Date.now()) {
        return null;
      }
      
      // Rate limiting
      if (!this.checkRateLimit(token)) {
        throw new Error('Rate limit exceeded');
      }
      
      return token;
    } catch (error) {
      return null;
    }
  }
}
```

### **Permission System**

#### ✅ **Capability-Based Security:**
```typescript
enum PluginCapability {
  READ_FILES = 'read_files',
  WRITE_FILES = 'write_files',
  NETWORK_ACCESS = 'network_access',
  DATABASE_READ = 'database_read',
  DATABASE_WRITE = 'database_write',
  SYSTEM_INFO = 'system_info'
}

class PluginPermissionManager {
  private readonly pluginPermissions = new Map<string, Set<PluginCapability>>();
  
  async checkPermission(pluginId: string, capability: PluginCapability): Promise<boolean> {
    const permissions = this.pluginPermissions.get(pluginId);
    if (!permissions) {
      return false;
    }
    
    return permissions.has(capability);
  }
  
  async enforcePermission(pluginId: string, capability: PluginCapability): Promise<void> {
    if (!await this.checkPermission(pluginId, capability)) {
      throw new Error(`Plugin ${pluginId} lacks permission: ${capability}`);
    }
  }
  
  // Decorator for automatic permission checking
  requiresPermission(capability: PluginCapability) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
      const method = descriptor.value;
      
      descriptor.value = async function (...args: any[]) {
        const pluginId = this.getCurrentPluginId();
        await this.permissionManager.enforcePermission(pluginId, capability);
        return method.apply(this, args);
      };
    };
  }
}
```

---

## 📁 Secure File Operations

### **Safe Archive Extraction**

#### ✅ **Zip-Slip Prevention:**
```typescript
import * as tar from 'tar';
import * as path from 'path';

class SecureArchiveExtractor {
  async extractTarSafely(archivePath: string, extractDir: string): Promise<void> {
    const maxSize = 100 * 1024 * 1024; // 100MB limit
    const maxFiles = 1000;
    let totalSize = 0;
    let fileCount = 0;
    
    return new Promise((resolve, reject) => {
      const extract = tar.extract({
        cwd: extractDir,
        strict: true,
        filter: (path: string, entry: any) => {
          // Increment counters
          fileCount++;
          totalSize += entry.size || 0;
          
          // Check limits
          if (fileCount > maxFiles) {
            reject(new Error('Too many files in archive'));
            return false;
          }
          
          if (totalSize > maxSize) {
            reject(new Error('Archive too large'));
            return false;
          }
          
          // Validate path
          const normalizedPath = path.normalize(path.join(extractDir, path));
          if (!normalizedPath.startsWith(extractDir)) {
            reject(new Error(`Path traversal attempt: ${path}`));
            return false;
          }
          
          // Check for dangerous file names
          if (this.isDangerousFileName(path)) {
            reject(new Error(`Dangerous file name: ${path}`));
            return false;
          }
          
          return true;
        }
      });
      
      extract.on('end', resolve);
      extract.on('error', reject);
      
      fs.createReadStream(archivePath).pipe(extract);
    });
  }
  
  private isDangerousFileName(filename: string): boolean {
    const dangerous = [
      /\.\./, // Path traversal
      /^\//, // Absolute paths
      /\x00/, // Null bytes
      /[<>:"|?*]/, // Windows reserved chars
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Windows reserved names
    ];
    
    return dangerous.some(pattern => pattern.test(filename));
  }
}
```

### **Secure File Type Validation**

#### ✅ **Magic Number Validation:**
```typescript
class FileTypeValidator {
  private readonly allowedTypes = new Map([
    ['application/javascript', [0x2F, 0x2F]], // JS files often start with //
    ['application/json', [0x7B]], // JSON starts with {
    ['application/gzip', [0x1F, 0x8B]], // GZIP magic number
    ['application/x-tar', [0x75, 0x73, 0x74, 0x61, 0x72]] // tar format
  ]);
  
  async validateFileType(filePath: string, expectedMimeType: string): Promise<boolean> {
    const buffer = await fs.readFile(filePath);
    const actualMimeType = await this.detectMimeType(buffer);
    
    if (actualMimeType !== expectedMimeType) {
      return false;
    }
    
    // Additional validation for executable content
    if (this.containsExecutableContent(buffer)) {
      return false;
    }
    
    return true;
  }
  
  private async detectMimeType(buffer: Buffer): Promise<string> {
    // Use file-type library or custom magic number detection
    const { fileTypeFromBuffer } = await import('file-type');
    const type = await fileTypeFromBuffer(buffer);
    return type?.mime || 'application/octet-stream';
  }
  
  private containsExecutableContent(buffer: Buffer): boolean {
    // Check for common executable signatures
    const executableSignatures = [
      Buffer.from([0x4D, 0x5A]), // PE/MZ header
      Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF header
      Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]), // Mach-O
      Buffer.from([0xFE, 0xED, 0xFA]), // Mach-O variants
    ];
    
    return executableSignatures.some(sig => 
      buffer.subarray(0, sig.length).equals(sig)
    );
  }
}
```

---

## 🌐 Network Security

### **Secure HTTP Client**

#### ✅ **SSRF Prevention:**
```typescript
class SecureHttpClient {
  private readonly allowedHosts = new Set(['api.trusted-service.com']);
  private readonly blockedHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
  private readonly blockedPorts = new Set([22, 3306, 5432, 6379, 27017]);
  
  async makeRequest(url: string, options: RequestOptions = {}): Promise<any> {
    const parsedUrl = new URL(url);
    
    // Validate protocol
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Only HTTP/HTTPS protocols allowed');
    }
    
    // Check host allowlist
    if (!this.allowedHosts.has(parsedUrl.hostname)) {
      throw new Error('Host not in allowlist');
    }
    
    // Block internal/private IPs
    if (await this.isPrivateIP(parsedUrl.hostname)) {
      throw new Error('Private IP addresses not allowed');
    }
    
    // Block dangerous ports
    const port = parseInt(parsedUrl.port) || (parsedUrl.protocol === 'https:' ? 443 : 80);
    if (this.blockedPorts.has(port)) {
      throw new Error('Port not allowed');
    }
    
    // Set security headers and limits
    const secureOptions: RequestOptions = {
      ...options,
      timeout: 10000, // 10 second timeout
      maxRedirects: 3,
      headers: {
        'User-Agent': 'SecurePluginSystem/1.0',
        ...options.headers
      }
    };
    
    return this.executeRequest(url, secureOptions);
  }
  
  private async isPrivateIP(hostname: string): Promise<boolean> {
    try {
      const { address } = await dns.lookup(hostname);
      const ip = ipaddr.process(address);
      
      return ip.range() !== 'unicast';
    } catch {
      return true; // Assume private if can't resolve
    }
  }
}
```

---

## 🔍 Security Monitoring

### **Comprehensive Audit Logging**

#### ✅ **Security Event Logging:**
```typescript
class SecurityAuditLogger {
  private readonly sensitiveFields = new Set(['password', 'token', 'secret', 'key']);
  
  logSecurityEvent(event: SecurityEvent): void {
    const sanitizedEvent = this.sanitizeEvent(event);
    
    const auditLog = {
      timestamp: new Date().toISOString(),
      eventId: crypto.randomUUID(),
      severity: event.severity,
      category: event.category,
      pluginId: event.pluginId,
      userId: event.userId,
      action: event.action,
      resource: event.resource,
      result: event.result,
      clientIP: this.hashIP(event.clientIP),
      userAgent: event.userAgent,
      metadata: sanitizedEvent.metadata,
      stackTrace: event.severity === 'CRITICAL' ? event.stackTrace : undefined
    };
    
    // Write to secure audit log
    this.writeAuditLog(auditLog);
    
    // Alert on critical events
    if (event.severity === 'CRITICAL') {
      this.triggerSecurityAlert(auditLog);
    }
  }
  
  private sanitizeEvent(event: SecurityEvent): SecurityEvent {
    const sanitized = { ...event };
    
    if (sanitized.metadata) {
      sanitized.metadata = this.removeSensitiveData(sanitized.metadata);
    }
    
    return sanitized;
  }
  
  private removeSensitiveData(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (this.sensitiveFields.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        sanitized[key] = this.removeSensitiveData(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
  
  private hashIP(ip: string): string {
    return crypto.createHash('sha256').update(ip + process.env.IP_SALT!).digest('hex');
  }
}
```

### **Runtime Security Monitoring**

#### ✅ **Anomaly Detection:**
```typescript
class PluginSecurityMonitor {
  private readonly behaviorBaseline = new Map<string, PluginBehavior>();
  
  monitorPluginBehavior(pluginId: string, activity: PluginActivity): void {
    const baseline = this.behaviorBaseline.get(pluginId);
    
    if (baseline) {
      this.checkForAnomalies(pluginId, activity, baseline);
    } else {
      this.establishBaseline(pluginId, activity);
    }
    
    this.updateBehaviorProfile(pluginId, activity);
  }
  
  private checkForAnomalies(pluginId: string, activity: PluginActivity, baseline: PluginBehavior): void {
    // Check for unusual file access patterns
    if (activity.fileOperations > baseline.avgFileOperations * 10) {
      this.triggerAlert('UNUSUAL_FILE_ACCESS', pluginId, {
        current: activity.fileOperations,
        baseline: baseline.avgFileOperations
      });
    }
    
    // Check for unusual network activity
    if (activity.networkRequests > baseline.avgNetworkRequests * 5) {
      this.triggerAlert('UNUSUAL_NETWORK_ACTIVITY', pluginId, {
        current: activity.networkRequests,
        baseline: baseline.avgNetworkRequests
      });
    }
    
    // Check for process spawning (should be zero)
    if (activity.processSpawns > 0) {
      this.triggerAlert('UNAUTHORIZED_PROCESS_SPAWN', pluginId, {
        processCount: activity.processSpawns
      });
    }
    
    // Check for memory usage spikes
    if (activity.memoryUsage > baseline.maxMemoryUsage * 2) {
      this.triggerAlert('MEMORY_ABUSE', pluginId, {
        current: activity.memoryUsage,
        baseline: baseline.maxMemoryUsage
      });
    }
  }
}
```

---

## 🧪 Security Testing

### **Automated Security Testing**

#### ✅ **Plugin Security Scanner:**
```typescript
class PluginSecurityScanner {
  async scanPlugin(pluginPath: string): Promise<SecurityScanResult> {
    const results: SecurityIssue[] = [];
    
    // Static code analysis
    results.push(...await this.performStaticAnalysis(pluginPath));
    
    // Dependency analysis
    results.push(...await this.scanDependencies(pluginPath));
    
    // Behavioral analysis in sandbox
    results.push(...await this.performBehavioralAnalysis(pluginPath));
    
    // Check for known malware signatures
    results.push(...await this.scanForMalware(pluginPath));
    
    return {
      pluginPath,
      scanDate: new Date(),
      issues: results,
      riskScore: this.calculateRiskScore(results),
      approved: results.every(issue => issue.severity !== 'CRITICAL')
    };
  }
  
  private async performStaticAnalysis(pluginPath: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    const code = await fs.readFile(pluginPath, 'utf8');
    
    // Check for dangerous function calls
    const dangerousPatterns = [
      { pattern: /eval\s*\(/, issue: 'Code uses eval() - potential code injection' },
      { pattern: /Function\s*\(/, issue: 'Code uses Function constructor - potential code injection' },
      { pattern: /require\s*\(\s*['"]child_process['"]/, issue: 'Code imports child_process - potential command execution' },
      { pattern: /require\s*\(\s*['"]fs['"]/, issue: 'Code imports fs - file system access' },
      { pattern: /require\s*\(\s*['"]net['"]/, issue: 'Code imports net - network access' },
      { pattern: /process\.env/, issue: 'Code accesses environment variables' },
      { pattern: /Buffer\.from\s*\(/, issue: 'Code uses Buffer.from - potential memory manipulation' }
    ];
    
    for (const { pattern, issue } of dangerousPatterns) {
      if (pattern.test(code)) {
        issues.push({
          type: 'STATIC_ANALYSIS',
          severity: 'HIGH',
          description: issue,
          line: this.findLineNumber(code, pattern)
        });
      }
    }
    
    return issues;
  }
}
```

---

## 📋 Security Checklist

### **Pre-Deployment Security Checklist**

- [ ] **Process Isolation**
  - [ ] Plugins run in separate processes/containers
  - [ ] Limited system resources (CPU, memory, disk)
  - [ ] Network isolation by default
  - [ ] Dedicated low-privilege user accounts

- [ ] **Input Validation**
  - [ ] All user inputs validated and sanitized
  - [ ] Path traversal prevention implemented
  - [ ] File type validation using magic numbers
  - [ ] Archive extraction with zip-slip protection

- [ ] **Authentication & Authorization**
  - [ ] Strong plugin authentication system
  - [ ] Capability-based permission model
  - [ ] Token expiration and revocation
  - [ ] Rate limiting on all endpoints

- [ ] **Code Security**
  - [ ] No dynamic code execution (eval, Function)
  - [ ] Secure module loading with whitelist
  - [ ] Static code analysis for all plugins
  - [ ] Dependency vulnerability scanning

- [ ] **Network Security**
  - [ ] SSRF prevention with host allowlists
  - [ ] TLS certificate validation
  - [ ] Request size and timeout limits
  - [ ] Private IP address blocking

- [ ] **Monitoring & Logging**
  - [ ] Comprehensive security event logging
  - [ ] Real-time anomaly detection
  - [ ] Security alert system
  - [ ] Regular security audits

- [ ] **Error Handling**
  - [ ] No sensitive information in error messages
  - [ ] Proper exception handling everywhere
  - [ ] Secure error logging
  - [ ] Fail-safe defaults

---

## 🚨 Critical Security Reminders

1. **Never Trust Plugin Code**: Assume all plugins are potentially malicious
2. **Defense in Depth**: Multiple security layers are essential
3. **Regular Updates**: Keep all dependencies and security measures current
4. **Security Reviews**: Regular professional security audits
5. **Incident Response**: Have a plan for security breaches
6. **Compliance**: Follow relevant security standards (OWASP, NIST)

---

## 📚 Additional Resources

- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Container Security Best Practices](https://snyk.io/blog/10-docker-image-security-best-practices/)

Remember: Security is not a feature to be added later—it must be built into the architecture from the ground up.