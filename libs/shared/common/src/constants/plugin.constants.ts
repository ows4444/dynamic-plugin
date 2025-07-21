export const PLUGIN_CONSTANTS = {
  MANIFEST_FILENAME: 'plugin.manifest.json',
  ROUTES_FILENAME: 'plugin.routes.json',
  PERMISSIONS_FILENAME: 'plugin.permissions.json',
  DEPENDENCIES_FILENAME: 'plugin.dependencies.json',
  SCHEMA_FILENAME: 'plugin.schema.json',

  SUPPORTED_VERSIONS: ['1.0.0', '1.1.0', '2.0.0'],
  MIN_SUPPORTED_VERSION: '1.0.0',
  MAX_SUPPORTED_VERSION: '2.0.0',

  DEFAULT_TIMEOUT: 30000,
  MAX_PLUGIN_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_PLUGINS_PER_HOST: 50,

  PLUGIN_DIRECTORY: 'plugins',
  TEMP_DIRECTORY: 'temp',
  CACHE_DIRECTORY: '.cache',

  PLUGIN_FILE_EXTENSIONS: ['.tar.gz', '.zip'],
  SUPPORTED_NODE_VERSIONS: ['16', '18', '20'],

  API: {
    BASE_PATH: '/api/plugins',
    VERSION: 'v1',
    UPLOAD_PATH: '/upload',
    DOWNLOAD_PATH: '/download',
    METADATA_PATH: '/metadata',
  },

  HEADERS: {
    PLUGIN_ID: 'X-Plugin-ID',
    PLUGIN_VERSION: 'X-Plugin-Version',
    PLUGIN_HOST: 'X-Plugin-Host',
    API_KEY: 'X-API-Key',
  },
} as const;

export const PLUGIN_LIFECYCLE_EVENTS = {
  BEFORE_INSTALL: 'plugin.before.install',
  AFTER_INSTALL: 'plugin.after.install',
  BEFORE_UNINSTALL: 'plugin.before.uninstall',
  AFTER_UNINSTALL: 'plugin.after.uninstall',
  BEFORE_START: 'plugin.before.start',
  AFTER_START: 'plugin.after.start',
  BEFORE_STOP: 'plugin.before.stop',
  AFTER_STOP: 'plugin.after.stop',
  ERROR: 'plugin.error',
  HEALTH_CHECK: 'plugin.health.check',
} as const;
