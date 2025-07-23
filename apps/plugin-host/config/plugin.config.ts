import { registerAs } from '@nestjs/config';
import * as path from 'path';

export interface PluginConfig {
  storage: {
    baseDirectory: string;
    maxPlugins: number;
    maxSizePerPlugin: number;
    allowedExtensions: string[];
    cleanupInterval: number;
    retentionDays: number;
  };
  registry: {
    url: string;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
    apiKey?: string;
    enableAutoUpdate: boolean;
    updateInterval: number;
  };
  runtime: {
    enableSandbox: boolean;
    maxMemoryMB: number;
    maxCpuPercent: number;
    timeoutMs: number;
    enableMetrics: boolean;
    enableLogging: boolean;
    logLevel: string;
  };
  security: {
    enablePermissions: boolean;
    defaultPermissions: string[];
    trustedPlugins: string[];
    blockedPlugins: string[];
    enableCodeScan: boolean;
    maxExecutionTime: number;
    allowNetworkAccess: boolean;
    allowFileSystemAccess: boolean;
  };
  cache: {
    enabled: boolean;
    ttlMs: number;
    maxSize: number;
    strategy: 'lru' | 'lfu' | 'fifo';
    enablePersistence: boolean;
    persistenceInterval: number;
  };
  loader: {
    enableHotReload: boolean;
    watchFiles: boolean;
    parallelLoading: boolean;
    maxConcurrentLoads: number;
    loadTimeout: number;
    enablePreloading: boolean;
  };
  monitoring: {
    enableHealthCheck: boolean;
    healthCheckInterval: number;
    enableMetrics: boolean;
    metricsInterval: number;
    enableAuditLog: boolean;
    auditLogLevel: string;
    enableAlerts: boolean;
  };
}

export default registerAs(
  'plugin',
  (): PluginConfig => ({
    storage: {
      baseDirectory:
        process.env['PLUGIN_STORAGE_DIR'] ?? path.join(process.cwd(), 'plugins'),
      maxPlugins: parseInt(process.env['PLUGIN_MAX_COUNT'] ?? '100', 10),
      maxSizePerPlugin:
        parseInt(process.env['PLUGIN_MAX_SIZE_MB'] ?? '50', 10) * 1024 * 1024,
      allowedExtensions: process.env['PLUGIN_ALLOWED_EXTENSIONS']?.split(',') ?? [
        '.tar.gz',
        '.tgz',
      ],
      cleanupInterval: parseInt(
        process.env['PLUGIN_CLEANUP_INTERVAL_MS'] ?? '3600000',
        10,
      ), // 1 hour
      retentionDays: parseInt(process.env['PLUGIN_RETENTION_DAYS'] ?? '30', 10),
    },

    registry: {
      url: process.env['PLUGIN_REGISTRY_URL'] ?? 'http://localhost:3002',
      timeout: parseInt(process.env['PLUGIN_REGISTRY_TIMEOUT'] ?? '30000', 10),
      retryAttempts: parseInt(
        process.env['PLUGIN_REGISTRY_RETRY_ATTEMPTS'] ?? '3',
        10,
      ),
      retryDelay: parseInt(
        process.env['PLUGIN_REGISTRY_RETRY_DELAY'] ?? '1000',
        10,
      ),
      apiKey: process.env['PLUGIN_REGISTRY_API_KEY'],
      enableAutoUpdate: process.env['PLUGIN_AUTO_UPDATE'] === 'true',
      updateInterval: parseInt(
        process.env['PLUGIN_UPDATE_INTERVAL_MS'] ?? '86400000',
        10,
      ), // 24 hours
    },

    runtime: {
      enableSandbox: process.env['PLUGIN_SANDBOX_ENABLED'] !== 'false',
      maxMemoryMB: parseInt(process.env['PLUGIN_MAX_MEMORY_MB'] ?? '256', 10),
      maxCpuPercent: parseInt(process.env['PLUGIN_MAX_CPU_PERCENT'] ?? '50', 10),
      timeoutMs: parseInt(process.env['PLUGIN_TIMEOUT_MS'] ?? '30000', 10),
      enableMetrics: process.env['PLUGIN_METRICS_ENABLED'] !== 'false',
      enableLogging: process.env['PLUGIN_LOGGING_ENABLED'] !== 'false',
      logLevel: process.env['PLUGIN_LOG_LEVEL'] ?? 'info',
    },

    security: {
      enablePermissions: process.env['PLUGIN_PERMISSIONS_ENABLED'] !== 'false',
      defaultPermissions: process.env['PLUGIN_DEFAULT_PERMISSIONS']?.split(
        ',',
      ) ?? ['network.request', 'cache.read', 'events.emit'],
      trustedPlugins: process.env['PLUGIN_TRUSTED']?.split(',') ?? [],
      blockedPlugins: process.env['PLUGIN_BLOCKED']?.split(',') ?? [],
      enableCodeScan: process.env['PLUGIN_CODE_SCAN_ENABLED'] === 'true',
      maxExecutionTime: parseInt(
        process.env['PLUGIN_MAX_EXECUTION_TIME'] ?? '60000',
        10,
      ),
      allowNetworkAccess: process.env['PLUGIN_ALLOW_NETWORK'] !== 'false',
      allowFileSystemAccess: process.env['PLUGIN_ALLOW_FILESYSTEM'] === 'true',
    },

    cache: {
      enabled: process.env['PLUGIN_CACHE_ENABLED'] !== 'false',
      ttlMs: parseInt(process.env['PLUGIN_CACHE_TTL_MS'] ?? '1800000', 10), // 30 minutes
      maxSize: parseInt(process.env['PLUGIN_CACHE_MAX_SIZE'] ?? '1000', 10),
      strategy: (process.env['PLUGIN_CACHE_STRATEGY'] ?? 'lru') as 'lru' | 'lfu' | 'fifo',
      enablePersistence: process.env['PLUGIN_CACHE_PERSISTENCE'] === 'true',
      persistenceInterval: parseInt(
        process.env['PLUGIN_CACHE_PERSISTENCE_INTERVAL'] ?? '300000',
        10,
      ), // 5 minutes
    },

    loader: {
      enableHotReload: process.env['PLUGIN_HOT_RELOAD'] === 'true',
      watchFiles: process.env['PLUGIN_WATCH_FILES'] === 'true',
      parallelLoading: process.env['PLUGIN_PARALLEL_LOADING'] !== 'false',
      maxConcurrentLoads: parseInt(
        process.env['PLUGIN_MAX_CONCURRENT_LOADS'] ?? '5',
        10,
      ),
      loadTimeout: parseInt(process.env['PLUGIN_LOAD_TIMEOUT'] ?? '60000', 10),
      enablePreloading: process.env['PLUGIN_PRELOADING'] === 'true',
    },

    monitoring: {
      enableHealthCheck: process.env['PLUGIN_HEALTH_CHECK'] !== 'false',
      healthCheckInterval: parseInt(
        process.env['PLUGIN_HEALTH_CHECK_INTERVAL'] ?? '30000',
        10,
      ),
      enableMetrics: process.env['PLUGIN_MONITORING_METRICS'] !== 'false',
      metricsInterval: parseInt(
        process.env['PLUGIN_METRICS_INTERVAL'] ?? '60000',
        10,
      ),
      enableAuditLog: process.env['PLUGIN_AUDIT_LOG'] !== 'false',
      auditLogLevel: process.env['PLUGIN_AUDIT_LOG_LEVEL'] ?? 'info',
      enableAlerts: process.env['PLUGIN_ALERTS_ENABLED'] === 'true',
    },
  }),
);
