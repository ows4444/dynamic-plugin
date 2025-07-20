export enum Permission {
  READ = 'read',
  WRITE = 'write',
  EXECUTE = 'execute',
  DELETE = 'delete',
  ADMIN = 'admin',
}

export enum PluginPermission {
  FILE_SYSTEM_READ = 'filesystem.read',
  FILE_SYSTEM_WRITE = 'filesystem.write',
  FILE_SYSTEM_DELETE = 'filesystem.delete',
  NETWORK_ACCESS = 'network.access',
  DATABASE_READ = 'database.read',
  DATABASE_WRITE = 'database.write',
  API_ACCESS = 'api.access',
  PLUGIN_COMMUNICATION = 'plugin.communication',
  HOST_RESOURCES = 'host.resources',
  SYSTEM_MONITORING = 'system.monitoring',
  USER_DATA_ACCESS = 'user.data.access',
  CONFIGURATION_MODIFY = 'configuration.modify',
  LOG_ACCESS = 'log.access',
  CACHE_ACCESS = 'cache.access',
  WEBHOOK_REGISTER = 'webhook.register',
  SCHEDULE_TASKS = 'schedule.tasks',
  EXTERNAL_SERVICES = 'external.services',
}

export enum SecurityLevel {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  RESTRICTED = 'restricted',
  CONFIDENTIAL = 'confidential',
  SECRET = 'secret',
}

export enum AccessLevel {
  NONE = 'none',
  READ_ONLY = 'readonly',
  READ_WRITE = 'readwrite',
  FULL_ACCESS = 'full_access',
}

export enum PermissionScope {
  GLOBAL = 'global',
  HOST = 'host',
  PLUGIN = 'plugin',
  USER = 'user',
  TENANT = 'tenant',
}

export enum AuthenticationMethod {
  API_KEY = 'api_key',
  JWT = 'jwt',
  OAUTH2 = 'oauth2',
  BASIC_AUTH = 'basic_auth',
  CERTIFICATE = 'certificate',
  NONE = 'none',
}