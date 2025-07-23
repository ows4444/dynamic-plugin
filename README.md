.
├── apps
│   ├── plugin-host
│   │   ├── config
│   │   │   ├── app.config.ts
│   │   │   └── plugin.config.ts
│   │   ├── plugins
│   │   ├── src
│   │   │   ├── core
│   │   │   │   ├── app.controller.ts
│   │   │   │   ├── app.module.ts
│   │   │   │   └── health.controller.ts
│   │   │   ├── main.ts
│   │   │   ├── monitoring
│   │   │   │   ├── audit.service.ts
│   │   │   │   ├── health-check.service.ts
│   │   │   │   ├── metrics.controller.ts
│   │   │   │   ├── metrics.service.ts
│   │   │   │   └── monitoring.module.ts
│   │   │   ├── plugin-host.controller.spec.ts
│   │   │   ├── plugin-host.controller.ts
│   │   │   ├── plugin-host.module.ts
│   │   │   ├── plugin-host.service.ts
│   │   │   ├── plugin-loader
│   │   │   │   ├── module-resolver.service.ts
│   │   │   │   ├── plugin-loader.module.ts
│   │   │   │   ├── plugin-loader.service.ts
│   │   │   │   └── route-manager.service.ts
│   │   │   ├── plugin-manager
│   │   │   │   ├── plugin-installer.service.ts
│   │   │   │   ├── plugin-manager.controller.ts
│   │   │   │   ├── plugin-manager.module.ts
│   │   │   │   ├── plugin-manager.service.ts
│   │   │   │   └── plugin-validator.service.ts
│   │   │   ├── plugin-registry
│   │   │   │   ├── download.service.ts
│   │   │   │   ├── metadata.service.ts
│   │   │   │   ├── plugin-registry.module.ts
│   │   │   │   └── registry-client.service.ts
│   │   │   ├── plugin-runtime
│   │   │   │   ├── plugin-events.service.ts
│   │   │   │   ├── plugin-instance.service.ts
│   │   │   │   ├── plugin-proxy.service.ts
│   │   │   │   ├── plugin-runtime.module.ts
│   │   │   │   ├── plugin-sandbox.service.ts
│   │   │   │   └── plugin-security.service.ts
│   │   │   └── storage
│   │   │       ├── file-system.service.ts
│   │   │       ├── plugin-cache.service.ts
│   │   │       ├── storage.interface.ts
│   │   │       └── storage.module.ts
│   │   └── tsconfig.app.json
│   ├── plugin-registry
│   │   ├── config
│   │   │   ├── app.config.ts
│   │   │   ├── database.config.ts
│   │   │   └── storage.config.ts
│   │   ├── src
│   │   │   ├── app.module.ts
│   │   │   ├── auth
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.guard.ts
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   └── jwt-auth.service.ts
│   │   │   ├── database
│   │   │   │   └── migrations
│   │   │   ├── download
│   │   │   │   ├── download.controller.ts
│   │   │   │   ├── download.module.ts
│   │   │   │   └── download.service.ts
│   │   │   ├── main.ts
│   │   │   ├── metadata
│   │   │   │   ├── metadata.controller.ts
│   │   │   │   ├── metadata.entity.ts
│   │   │   │   ├── metadata.module.ts
│   │   │   │   └── metadata.service.ts
│   │   │   ├── storage
│   │   │   │   ├── storage.module.ts
│   │   │   │   └── storage.service.ts
│   │   │   ├── upload
│   │   │   │   ├── upload.controller.ts
│   │   │   │   ├── upload.dto.ts
│   │   │   │   ├── upload.module.ts
│   │   │   │   └── upload.service.ts
│   │   │   └── validation
│   │   │       ├── validation.module.ts
│   │   │       └── validation.service.ts
│   │   └── tsconfig.app.json
│   ├── plugin-template
│   │   ├── scripts
│   │   ├── src
│   │   │   ├── main.ts
│   │   │   ├── plugin-template.controller.spec.ts
│   │   │   ├── plugin-template.controller.ts
│   │   │   ├── plugin-template.module.ts
│   │   │   └── plugin-template.service.ts
│   │   ├── templates
│   │   │   ├── controller.template.ts
│   │   │   ├── module.template.ts
│   │   │   └── service.template.ts
│   │   └── tsconfig.app.json
│   └── plugins
│       └── payment-plugin
│           ├── package.json
│           ├── plugin.manifest.json
│           ├── src
│           │   └── payment-plugin.module.ts
│           └── tsconfig.json
├── eslint.config.mjs
├── libs
│   ├── shared
│   │   ├── common
│   │   │   ├── src
│   │   │   │   ├── cache
│   │   │   │   │   ├── cache-manager.service.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── config
│   │   │   │   │   ├── app.config.ts
│   │   │   │   │   ├── cache.config.ts
│   │   │   │   │   ├── config.module.ts
│   │   │   │   │   ├── database.config.ts
│   │   │   │   │   ├── environment.validator.ts
│   │   │   │   │   ├── index.ts
│   │   │   │   │   └── validation.schema.ts
│   │   │   │   ├── constants
│   │   │   │   │   ├── event.constants.ts
│   │   │   │   │   ├── index.ts
│   │   │   │   │   └── plugin.constants.ts
│   │   │   │   ├── database
│   │   │   │   │   ├── database.config.ts
│   │   │   │   │   ├── database.module.ts
│   │   │   │   │   ├── index.ts
│   │   │   │   │   └── query-optimizer.service.ts
│   │   │   │   ├── decorators
│   │   │   │   │   ├── cache-response.decorator.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── enums
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── permission.enum.ts
│   │   │   │   │   └── plugin-status.enum.ts
│   │   │   │   ├── errors
│   │   │   │   │   ├── index.ts
│   │   │   │   │   └── plugin.errors.ts
│   │   │   │   ├── filters
│   │   │   │   │   ├── global-exception.filter.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── health
│   │   │   │   │   ├── health-check.service.ts
│   │   │   │   │   ├── health-check.types.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── logging
│   │   │   │   │   ├── correlation-id.middleware.ts
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── logging.interceptor.ts
│   │   │   │   │   ├── logging.module.ts
│   │   │   │   │   ├── structured-logger.service.spec.ts
│   │   │   │   │   └── structured-logger.service.ts
│   │   │   │   ├── monitoring
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── metrics-collector.service.ts
│   │   │   │   │   ├── monitoring.module.ts
│   │   │   │   │   ├── performance-metrics.service.ts
│   │   │   │   │   ├── performance-monitor.service.ts
│   │   │   │   │   ├── plugin-performance.decorator.ts
│   │   │   │   │   ├── prometheus-metrics.service.spec.ts
│   │   │   │   │   └── prometheus-metrics.service.ts
│   │   │   │   ├── storage
│   │   │   │   │   ├── cloud-storage.service.spec.ts
│   │   │   │   │   ├── cloud-storage.service.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── utils
│   │   │   │   │   ├── error.utils.ts
│   │   │   │   │   └── index.ts
│   │   │   │   └── validators
│   │   │   │       ├── config.validator.ts
│   │   │   │       ├── index.ts
│   │   │   │       └── manifest.validator.ts
│   │   │   └── tsconfig.lib.json
│   │   ├── plugin-sdk
│   │   │   ├── src
│   │   │   │   ├── base
│   │   │   │   │   ├── base-plugin.ts
│   │   │   │   │   ├── base-service.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── context
│   │   │   │   │   ├── index.ts
│   │   │   │   │   └── plugin-context.ts
│   │   │   │   ├── decorators
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── plugin-route.decorator.ts
│   │   │   │   │   └── plugin.decorator.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── shared
│   │   │   │   │   ├── plugin-sdk.module.ts
│   │   │   │   │   └── plugin-sdk.service.ts
│   │   │   │   └── utilities
│   │   │   │       ├── config.util.ts
│   │   │   │       ├── index.ts
│   │   │   │       ├── logger.util.ts
│   │   │   │       └── validation.util.ts
│   │   │   └── tsconfig.lib.json
│   │   └── plugin-types
│   │       ├── src
│   │       │   ├── communication.interface.ts
│   │       │   ├── config.interface.ts
│   │       │   ├── index.ts
│   │       │   ├── lifecycle.interface.ts
│   │       │   ├── manifest.interface.ts
│   │       │   ├── permissions.interface.ts
│   │       │   ├── plugin.interface.ts
│   │       │   ├── template-literal-types.ts
│   │       │   ├── type-guards.ts
│   │       │   ├── utility-types.ts
│   │       │   └── validation.interface.ts
│   │       └── tsconfig.lib.json
│   └── tsconfig.json
├── nest-cli.json
├── package.json
├── plugins
├── scripts
├── tools
│   └── plugin-builder
│       ├── configs
│       ├── src
│       │   ├── builder
│       │   │   ├── bundle-analyzer.ts
│       │   │   └── webpack.config.ts
│       │   ├── cli
│       │   │   └── build-command.ts
│       │   ├── main.ts
│       │   ├── optimizer
│       │   │   ├── bundle-optimizer.service.ts
│       │   │   └── tree-shaking.analyzer.ts
│       │   ├── packager
│       │   │   └── bundle-packager.ts
│       │   ├── tools
│       │   │   ├── plugin-builder.controller.spec.ts
│       │   │   ├── plugin-builder.controller.ts
│       │   │   ├── plugin-builder.module.ts
│       │   │   └── plugin-builder.service.ts
│       │   └── validators
│       │       ├── dependency-checker.ts
│       │       └── manifest-validator.ts
│       └── tsconfig.app.json
├── tsconfig.build.json
└── tsconfig.json