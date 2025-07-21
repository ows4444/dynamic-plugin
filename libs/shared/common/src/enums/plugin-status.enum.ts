export enum PluginStatus {
  UNINSTALLED = 'uninstalled',
  DOWNLOADING = 'downloading',
  INSTALLING = 'installing',
  INSTALLED = 'installed',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
  FAILED = 'failed',
  DISABLED = 'disabled',
  UPDATING = 'updating',
  UNINSTALLING = 'uninstalling',
}

export enum PluginLifecycleState {
  CREATED = 'created',
  INITIALIZED = 'initialized',
  CONFIGURED = 'configured',
  STARTED = 'started',
  READY = 'ready',
  PAUSED = 'paused',
  RESUMED = 'resumed',
  STOPPED = 'stopped',
  DESTROYED = 'destroyed',
}

export enum PluginHealth {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  DEGRADED = 'degraded',
  UNKNOWN = 'unknown',
}

export enum PluginType {
  SERVICE = 'service',
  MIDDLEWARE = 'middleware',
  HANDLER = 'handler',
  EXTENSION = 'extension',
  INTEGRATION = 'integration',
  UTILITY = 'utility',
}

export enum PluginCategory {
  PAYMENT = 'payment',
  CRM = 'crm',
  ANALYTICS = 'analytics',
  NOTIFICATION = 'notification',
  AUTHENTICATION = 'authentication',
  STORAGE = 'storage',
  LOGGING = 'logging',
  MONITORING = 'monitoring',
  SECURITY = 'security',
  OTHER = 'other',
}

export enum PluginPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}
