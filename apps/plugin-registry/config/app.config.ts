import { registerAs } from '@nestjs/config';

export interface RegistryAppConfig {
  port: number;
  host: string;
  nodeEnv: string;
  apiPrefix: string;
  corsEnabled: boolean;
  corsOrigins: string[];
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
  };
  auth: {
    enabled: boolean;
    jwtSecret?: string;
    jwtExpiresIn: string;
    apiKeyHeader: string;
    allowAnonymousDownloads: boolean;
    allowAnonymousSearch: boolean;
  };
  registry: {
    name: string;
    version: string;
    description: string;
    maintainer: {
      name: string;
      email: string;
      url?: string;
    };
    enableMetrics: boolean;
    enableAnalytics: boolean;
    maxPluginsPerUser: number;
    enableAutoApproval: boolean;
  };
  validation: {
    enableManifestValidation: boolean;
    enableSecurityScan: boolean;
    enableDependencyCheck: boolean;
    quarantineUnsafePlugins: boolean;
    maxValidationTime: number;
    enableVirusScan: boolean;
  };
  search: {
    enableFullTextSearch: boolean;
    indexingInterval: number;
    maxSearchResults: number;
    enableFuzzySearch: boolean;
    searchEngine: 'elasticsearch' | 'postgresql' | 'sqlite';
  };
  cdn: {
    enabled: boolean;
    baseUrl?: string;
    enableCaching: boolean;
    cacheMaxAge: number;
    enableCompression: boolean;
  };
  monitoring: {
    enableHealthCheck: boolean;
    enableMetrics: boolean;
    enableTracing: boolean;
    metricsInterval: number;
    healthCheckTimeout: number;
  };
  security: {
    enableHelmet: boolean;
    enableCsrf: boolean;
    trustProxy: boolean;
    maxRequestSize: string;
    enableContentTypeValidation: boolean;
    blockedIPs: string[];
    allowedIPs: string[];
  };
}

export default registerAs(
  'registryApp',
  (): RegistryAppConfig => ({
    port: parseInt(process.env.PORT ?? '3002', 10),
    host: process.env.HOST ?? '0.0.0.0',
    nodeEnv: process.env.NODE_ENV ?? 'development',
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    corsEnabled: process.env.CORS_ENABLED === 'true',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') ?? [
      'http://localhost:3000',
      'http://localhost:3001',
    ],

    rateLimiting: {
      enabled: process.env.RATE_LIMITING_ENABLED !== 'false',
      windowMs: parseInt(process.env.RATE_LIMITING_WINDOW_MS ?? '900000', 10), // 15 minutes
      maxRequests: parseInt(
        process.env.RATE_LIMITING_MAX_REQUESTS ?? '100',
        10,
      ),
      skipSuccessfulRequests: process.env.RATE_LIMITING_SKIP_SUCCESS === 'true',
    },

    auth: {
      enabled: process.env.AUTH_ENABLED !== 'false',
      jwtSecret:
        process.env.JWT_SECRET ?? 'your-secret-key-change-in-production',
      jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
      apiKeyHeader: process.env.API_KEY_HEADER ?? 'x-api-key',
      allowAnonymousDownloads:
        process.env.ALLOW_ANONYMOUS_DOWNLOADS !== 'false',
      allowAnonymousSearch: process.env.ALLOW_ANONYMOUS_SEARCH !== 'false',
    },

    registry: {
      name: process.env.REGISTRY_NAME ?? 'Plugin Registry',
      version: process.env.REGISTRY_VERSION ?? '1.0.0',
      description:
        process.env.REGISTRY_DESCRIPTION ?? 'A registry for dynamic plugins',
      maintainer: {
        name: process.env.REGISTRY_MAINTAINER_NAME ?? 'Registry Admin',
        email: process.env.REGISTRY_MAINTAINER_EMAIL ?? 'admin@example.com',
        url: process.env.REGISTRY_MAINTAINER_URL,
      },
      enableMetrics: process.env.REGISTRY_METRICS !== 'false',
      enableAnalytics: process.env.REGISTRY_ANALYTICS === 'true',
      maxPluginsPerUser: parseInt(
        process.env.REGISTRY_MAX_PLUGINS_PER_USER ?? '50',
        10,
      ),
      enableAutoApproval: process.env.REGISTRY_AUTO_APPROVAL === 'true',
    },

    validation: {
      enableManifestValidation: process.env.VALIDATION_MANIFEST !== 'false',
      enableSecurityScan: process.env.VALIDATION_SECURITY === 'true',
      enableDependencyCheck: process.env.VALIDATION_DEPENDENCIES === 'true',
      quarantineUnsafePlugins: process.env.VALIDATION_QUARANTINE === 'true',
      maxValidationTime: parseInt(
        process.env.VALIDATION_MAX_TIME ?? '300000',
        10,
      ), // 5 minutes
      enableVirusScan: process.env.VALIDATION_VIRUS_SCAN === 'true',
    },

    search: {
      enableFullTextSearch: process.env.SEARCH_FULL_TEXT !== 'false',
      indexingInterval: parseInt(
        process.env.SEARCH_INDEXING_INTERVAL ?? '3600000',
        10,
      ), // 1 hour
      maxSearchResults: parseInt(process.env.SEARCH_MAX_RESULTS ?? '100', 10),
      enableFuzzySearch: process.env.SEARCH_FUZZY === 'true',
      searchEngine: (process.env.SEARCH_ENGINE as 'elasticsearch' | 'postgresql' | 'sqlite' | undefined) ?? 'postgresql',
    },

    cdn: {
      enabled: process.env.CDN_ENABLED === 'true',
      baseUrl: process.env.CDN_BASE_URL,
      enableCaching: process.env.CDN_CACHING !== 'false',
      cacheMaxAge: parseInt(process.env.CDN_CACHE_MAX_AGE ?? '86400', 10), // 24 hours
      enableCompression: process.env.CDN_COMPRESSION !== 'false',
    },

    monitoring: {
      enableHealthCheck: process.env.MONITORING_HEALTH_CHECK !== 'false',
      enableMetrics: process.env.MONITORING_METRICS !== 'false',
      enableTracing: process.env.MONITORING_TRACING === 'true',
      metricsInterval: parseInt(
        process.env.MONITORING_METRICS_INTERVAL ?? '60000',
        10,
      ), // 1 minute
      healthCheckTimeout: parseInt(
        process.env.MONITORING_HEALTH_TIMEOUT ?? '5000',
        10,
      ),
    },

    security: {
      enableHelmet: process.env.SECURITY_HELMET !== 'false',
      enableCsrf: process.env.SECURITY_CSRF === 'true',
      trustProxy: process.env.TRUST_PROXY === 'true',
      maxRequestSize: process.env.MAX_REQUEST_SIZE ?? '100mb',
      enableContentTypeValidation:
        process.env.SECURITY_CONTENT_TYPE !== 'false',
      blockedIPs: process.env.SECURITY_BLOCKED_IPS?.split(',') ?? [],
      allowedIPs: process.env.SECURITY_ALLOWED_IPS?.split(',') ?? [],
    },
  }),
);
