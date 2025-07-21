export const EVENT_TYPES = {
  PLUGIN_LOADED: 'plugin.loaded',
  PLUGIN_UNLOADED: 'plugin.unloaded',
  PLUGIN_STARTED: 'plugin.started',
  PLUGIN_STOPPED: 'plugin.stopped',
  PLUGIN_ERROR: 'plugin.error',
  PLUGIN_HEALTH_CHECK: 'plugin.health.check',
  PLUGIN_ROUTE_REGISTERED: 'plugin.route.registered',
  PLUGIN_ROUTE_UNREGISTERED: 'plugin.route.unregistered',
  PLUGIN_DEPENDENCY_RESOLVED: 'plugin.dependency.resolved',
  PLUGIN_DEPENDENCY_FAILED: 'plugin.dependency.failed',
} as const;

export const SYSTEM_EVENTS = {
  HOST_STARTED: 'host.started',
  HOST_STOPPED: 'host.stopped',
  HOST_ERROR: 'host.error',
  REGISTRY_CONNECTED: 'registry.connected',
  REGISTRY_DISCONNECTED: 'registry.disconnected',
  STORAGE_READY: 'storage.ready',
  STORAGE_ERROR: 'storage.error',
} as const;

export const SECURITY_EVENTS = {
  PERMISSION_GRANTED: 'security.permission.granted',
  PERMISSION_DENIED: 'security.permission.denied',
  SECURITY_VIOLATION: 'security.violation',
  AUTHENTICATION_FAILED: 'security.auth.failed',
  AUTHORIZATION_FAILED: 'security.authz.failed',
} as const;

export const MONITORING_EVENTS = {
  METRICS_COLLECTED: 'monitoring.metrics.collected',
  HEALTH_CHECK_PASSED: 'monitoring.health.passed',
  HEALTH_CHECK_FAILED: 'monitoring.health.failed',
  PERFORMANCE_THRESHOLD_EXCEEDED: 'monitoring.performance.threshold.exceeded',
  RESOURCE_LIMIT_REACHED: 'monitoring.resource.limit.reached',
} as const;

export const EVENT_PRIORITIES = {
  LOW: 0,
  NORMAL: 1,
  HIGH: 2,
  CRITICAL: 3,
} as const;

export const EVENT_SOURCES = {
  PLUGIN_HOST: 'plugin-host',
  PLUGIN_REGISTRY: 'plugin-registry',
  PLUGIN_MANAGER: 'plugin-manager',
  PLUGIN_LOADER: 'plugin-loader',
  PLUGIN_RUNTIME: 'plugin-runtime',
  PLUGIN_INSTANCE: 'plugin-instance',
  MONITORING: 'monitoring',
  SECURITY: 'security',
} as const;
