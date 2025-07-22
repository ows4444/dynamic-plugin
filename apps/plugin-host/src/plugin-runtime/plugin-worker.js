const { workerData, parentPort } = require('worker_threads');
const vm = require('vm');
const fs = require('fs');
const path = require('path');

class PluginWorker {
  constructor(port, config, sandboxId) {
    this.port = port;
    this.config = config;
    this.sandboxId = sandboxId;
    this.context = null;
    this.setupCommunication();
    this.startResourceMonitoring();
  }

  setupCommunication() {
    this.port.on('message', async (message) => {
      try {
        switch (message.type) {
          case 'execute':
            await this.executePlugin(message.data);
            break;
          default:
            this.sendError(`Unknown message type: ${message.type}`);
        }
      } catch (error) {
        this.sendError(getErrorMessage(error));
      }
    });

    this.port.on('close', () => {
      process.exit(0);
    });
  }

  async executePlugin(executionContext) {
    try {
      // Validate plugin path
      if (!this.isValidPluginPath(executionContext.pluginPath)) {
        throw new Error('Invalid plugin path');
      }

      // Create secure VM context
      const sandbox = this.createSecureSandbox(executionContext);
      
      // Load and execute plugin
      const pluginCode = await this.loadPluginCode(executionContext.pluginPath);
      const result = await this.runInSandbox(pluginCode, sandbox, executionContext);
      
      this.sendResult(result);
    } catch (error) {
      this.sendError(getErrorMessage(error));
    }
  }

  createSecureSandbox(executionContext) {
    const sandbox = {
      // Secure globals
      console: {
        log: (msg) => this.sendLog(`Plugin log: ${msg}`),
        warn: (msg) => this.sendLog(`Plugin warn: ${msg}`),
        error: (msg) => this.sendLog(`Plugin error: ${msg}`),
      },
      
      // Plugin context
      pluginContext: {
        config: executionContext.config || {},
        permissions: executionContext.permissions || [],
        request: executionContext.requestData,
        method: executionContext.method,
      },

      // Limited Node.js APIs
      Buffer: Buffer,
      process: {
        env: {}, // Empty env for security
        versions: process.versions,
        platform: process.platform,
      },

      // Safe utilities
      JSON: JSON,
      Date: Date,
      Math: Math,
      RegExp: RegExp,
      String: String,
      Number: Number,
      Boolean: Boolean,
      Array: Array,
      Object: Object,
      
      // HTTP client (if network access allowed)
      ...(this.config.allowNetworkAccess && {
        fetch: this.createSecureFetch(),
      }),

      // File system access (if allowed)
      ...(this.config.allowFileSystemAccess && {
        fs: this.createSecureFs(),
      }),

      // Plugin response handler
      respond: (data) => {
        return data;
      },

      // Error handler
      throwError: (message) => {
        throw new Error(message);
      },
    };

    return vm.createContext(sandbox);
  }

  createSecureFetch() {
    return async (url, options = {}) => {
      // Implement secure HTTP client with restrictions
      const allowedDomains = ['api.allowed-domain.com']; // Configure allowed domains
      const urlObj = new URL(url);
      
      if (!allowedDomains.includes(urlObj.hostname)) {
        throw new Error(`Network access denied for domain: ${urlObj.hostname}`);
      }

      // Use a secure HTTP client implementation
      // This is a placeholder - implement actual HTTP client
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
      });
    };
  }

  createSecureFs() {
    return {
      readFileSync: (filepath) => {
        const safePath = this.validateFilePath(filepath);
        return fs.readFileSync(safePath, 'utf8');
      },
      writeFileSync: (filepath, data) => {
        const safePath = this.validateFilePath(filepath);
        return fs.writeFileSync(safePath, data, 'utf8');
      },
    };
  }

  validateFilePath(filepath) {
    // Only allow access to plugin's own directory
    const pluginDir = path.resolve('/plugins/sandbox');
    const resolvedPath = path.resolve(pluginDir, filepath);
    
    if (!resolvedPath.startsWith(pluginDir)) {
      throw new Error('File system access denied: path outside plugin directory');
    }
    
    return resolvedPath;
  }

  async loadPluginCode(pluginPath) {
    try {
      const fullPath = path.resolve(pluginPath);
      
      // Security check: ensure plugin is in allowed directory
      const allowedDir = path.resolve('/plugins');
      if (!fullPath.startsWith(allowedDir)) {
        throw new Error('Plugin path outside allowed directory');
      }

      return fs.readFileSync(fullPath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to load plugin: ${getErrorMessage(error)}`);
    }
  }

  async runInSandbox(pluginCode, sandbox, executionContext) {
    try {
      // Wrap plugin code in a function to control execution
      const wrappedCode = `
        (async function pluginMain() {
          ${pluginCode}
          
          // Plugin must export a main function
          if (typeof main === 'function') {
            return await main(pluginContext);
          } else {
            throw new Error('Plugin must export a main function');
          }
        })();
      `;

      // Execute with timeout
      const script = new vm.Script(wrappedCode);
      const result = await script.runInContext(sandbox, {
        timeout: this.config.timeoutMs || 30000,
        breakOnSigint: true,
      });

      return result;
    } catch (error) {
      if (error.message.includes('Script execution timed out')) {
        throw new Error('Plugin execution timeout');
      }
      throw error;
    }
  }

  isValidPluginPath(pluginPath) {
    // Basic validation
    if (!pluginPath || typeof pluginPath !== 'string') {
      return false;
    }

    // Check for path traversal attempts
    if (pluginPath.includes('..') || pluginPath.includes('~')) {
      return false;
    }

    return true;
  }

  startResourceMonitoring() {
    // Monitor memory and CPU usage
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      this.sendStats({
        memoryUsage: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // seconds
      });
    }, 1000);
  }

  sendResult(data) {
    this.port.postMessage({
      type: 'result',
      data: data,
    });
  }

  sendError(error) {
    this.port.postMessage({
      type: 'error',
      data: { error: error },
    });
  }

  sendLog(message) {
    this.port.postMessage({
      type: 'log',
      data: { message: message },
    });
  }

  sendStats(stats) {
    this.port.postMessage({
      type: 'stats',
      data: stats,
    });
  }
}

// Initialize worker
if (workerData && workerData.port) {
  new PluginWorker(
    workerData.port,
    workerData.config,
    workerData.sandboxId
  );
} else {
  console.error('Worker data not provided');
  process.exit(1);
}