```
nizaami-plugins-monorepo/
├── apps/
│   ├── plugin-host/                                        # Main NestJS app that runs plugins
│   │   ├── src/
│   │   │   ├── core/                                       # Core host functionality
│   │   │   │   ├── app.module.ts                           # Main application module
│   │   │   │   ├── app.controller.ts                       # Health checks, status
│   │   │   │   └── main.ts                                 # Bootstrap application
│   │   │   │
│   │   │   ├── plugin-manager/                             # Plugin lifecycle management
│   │   │   │   ├── plugin-manager.service.ts               # Install/uninstall plugins
│   │   │   │   ├── plugin-manager.controller.ts            # Plugin management APIs
│   │   │   │   ├── plugin-installer.service.ts             # Download & extract plugins
│   │   │   │   └── plugin-validator.service.ts             # Validate plugin packages
│   │   │   │
│   │   │   ├── plugin-loader/                              # Dynamic loading runtime
│   │   │   │   ├── plugin-loader.service.ts                # Dynamic import() logic
│   │   │   │   ├── module-resolver.service.ts              # Resolve plugin modules
│   │   │   │   └── route-manager.service.ts                # Register plugin routes
│   │   │   │
│   │   │   ├── plugin-registry/                            # Registry client
│   │   │   │   ├── registry-client.service.ts              # Connect to plugin registry
│   │   │   │   ├── download.service.ts                     # Download plugin packages
│   │   │   │   └── metadata.service.ts                     # Plugin metadata handling
│   │   │   │
│   │   │   ├── plugin-runtime/                             # Runtime execution environment
│   │   │   │   ├── plugin-instance.service.ts              # Manage plugin instances
│   │   │   │   ├── plugin-proxy.service.ts                 # Proxy requests to plugins
│   │   │   │   ├── plugin-events.service.ts                # Plugin event handling
│   │   │   │   └── plugin-security.service.ts              # Security & permissions
│   │   │   │
│   │   │   ├── storage/                                    # Local plugin storage
│   │   │   │   ├── file-system.service.ts                  # File operations
│   │   │   │   ├── plugin-cache.service.ts                 # Plugin caching
│   │   │   │   └── storage.interface.ts                    # Storage abstractions
│   │   │   │
│   │   │   └── monitoring/                                 # Plugin monitoring
│   │   │       ├── health-check.service.ts                 # Plugin health monitoring
│   │   │       ├── metrics.service.ts                      # Performance metrics
│   │   │       └── audit.service.ts                        # Audit logging
│   │   │
│   │   ├── plugins/                                        # Runtime plugin storage
│   │   │   ├── xyz/
│   │   │   │   ├── payment-plugin@1.0.0/
│   │   │   │   └── crm-plugin@2.1.0/
│   │   │   └── abc/
│   │   │       └── analytics-plugin@1.5.0/
│   │   │
│   │   ├── config/
│   │   │   ├── app.config.ts                               # Application configuration
│   │   │   ├── plugin.config.ts                            # Plugin system config
│   │   │
│   │   └── package.json
│   │
│   ├── plugin-registry/
│   │   ├── src/
│   │   │   ├── main.ts                                     # NestJS app bootstrap
│   │   │   ├── app.module.ts                               # Root module
│   │   │   │
│   │   │   ├── upload/                                     # Plugin Upload Module
│   │   │   │   ├── upload.controller.ts                    # POST /plugins/upload
│   │   │   │   ├── upload.service.ts                       # Handle file upload logic
│   │   │   │   ├── upload.dto.ts                           # Upload validation DTOs
│   │   │   │   └── upload.module.ts
│   │   │   │
│   │   │   ├── download/                                   # Plugin Download Module
│   │   │   │   ├── download.controller.ts                  # GET /plugins/{id}/download
│   │   │   │   ├── download.service.ts                     # Serve plugin files
│   │   │   │   └── download.module.ts
│   │   │   │
│   │   │   ├── storage/                                    # File Storage Module
│   │   │   │   ├── storage.service.ts                      # File system operations
│   │   │   │   ├── storage.interface.ts                    # Storage abstraction
│   │   │   │   └── providers/
│   │   │   │       ├── local-storage.provider.ts           # Local file storage
│   │   │   │       ├── s3-storage.provider.ts              # AWS S3 storage
│   │   │   │       └── gcs-storage.provider.ts             # Google Cloud Storage
│   │   │   │
│   │   │   ├── metadata/                                   # Plugin Metadata Module
│   │   │   │   ├── metadata.controller.ts                  # GET /plugins, GET /plugins/{id}
│   │   │   │   ├── metadata.service.ts                     # Plugin info management
│   │   │   │   ├── metadata.entity.ts                      # Database entity
│   │   │   │   └── metadata.repository.ts
│   │   │   │
│   │   │   ├── auth/                                       # Authentication Module
│   │   │   │   ├── auth.guard.ts                           # API key validation
│   │   │   │   ├── auth.service.ts                         # Token management
│   │   │   │   └── auth.module.ts
│   │   │   │
│   │   │   ├── validation/                                 # Plugin Validation
│   │   │   │   ├── manifest.validator.ts                   # Validate plugin.manifest.json
│   │   │   │   ├── security.validator.ts                   # Security checks
│   │   │   │   └── dependency.validator.ts                 # Dependency validation
│   │   │   │
│   │   │   └── database/                                   # Database Module
│   │   │       ├── database.module.ts
│   │   │       └── migrations/
│   │   │
│   │   ├── storage/                                        # Local file storage directory
│   │   │   ├── plugins/
│   │   │   │   ├── payment-plugin/
│   │   │   │   │   ├── v1.0.0/
│   │   │   │   │   │   ├── payment-plugin.tar.gz
│   │   │   │   │   │   └── manifest.json
│   │   │   │   │   └── v1.1.0/
│   │   │   │   └── crm-plugin/
│   │   │   └── temp/                                       # Temporary upload processing
│   │   │
│   │   ├── config/
│   │   │   ├── database.config.ts
│   │   │   ├── storage.config.ts
│   │   │   └── app.config.ts
│   │   │
│   │   └── package.json
│   ├── plugin-template/
│   │   ├── src/                                            # Core plugin source code
│   │   │   ├── plugin.module.ts                            # Main NestJS module (entry point)
│   │   │   ├── plugin.controller.ts                        # REST API endpoints
│   │   │   ├── plugin.service.ts                           # Business logic
│   │   │   ├── plugin.interface.ts                         # Plugin contract/interface
│   │   │   └── dto/                                        # Data transfer objects
│   │   │       ├── plugin-config.dto.ts
│   │   │       └── plugin-response.dto.ts
│   │   │
│   │   ├── config/                                         # Plugin configuration
│   │   │   ├── plugin.config.ts                            # Default configuration
│   │   │   └── schema.validation.ts                        # Config validation schema
│   │   │
│   │   ├── templates/                                      # Code generation templates
│   │   │   ├── controller.template.ts                      # Controller boilerplate
│   │   │   ├── service.template.ts                         # Service boilerplate
│   │   │   ├── module.template.ts                          # Module boilerplate
│   │   │   └── dto.template.ts                             # DTO boilerplate
│   │   │
│   │   ├── scripts/                                        # Development scripts
│   │   │   ├── generate.js                                 # Generate plugin from template
│   │   │   ├── build.js                                    # Build plugin bundle
│   │   │   └── validate.js                                 # Validate plugin structure
│   │   │
│   │   ├── plugin.manifest.json                            # Plugin metadata & requirements
│   │   ├── plugin.schema.json                              # Configuration schema
│   │   ├── package.json                                    # Template package.json
│   │   ├── tsconfig.json                                   # TypeScript config
│   │   ├── webpack.config.js                               # Build configuration
│   │   ├── .gitignore                                      # Git ignore template
│   │   └── README.md                                       # Plugin development guide
│   └── plugins/
│       └── payment-plugin/
│           ├── src/
│           │   ├── controllers/
│           │   │   ├── payment.controller.ts               # Payment API endpoints
│           │   │   └── webhook.controller.ts               # Payment webhooks
│           │   ├── services/
│           │   │   ├── payment.service.ts                  # Core payment logic
│           │   │   ├── stripe.service.ts                   # Stripe integration
│           │   │   └── paypal.service.ts                   # PayPal integration
│           │   ├── entities/
│           │   │   ├── payment.entity.ts                   # Payment data model
│           │   │   └── transaction.entity.ts               # Transaction records
│           │   ├── dto/
│           │   │   ├── create-payment.dto.ts               # Payment request validation
│           │   │   └── payment-response.dto.ts             # Payment response format
│           │   ├── interfaces/
│           │   │   └── payment-provider.interface.ts       # Payment provider contract
│           │   ├── guards/
│           │   │   └── payment.guard.ts                    # access control
│           │   ├── middleware/
│           │   │   └── payment-logging.middleware.ts       # Payment audit logging
│           │   └── payment-plugin.module.ts                # Main plugin module
│           │
│           ├── config/
│           │   ├── payment.config.ts                       # Plugin configuration
│           │   └── providers.config.ts                     # Payment providers setup
│           │
│           ├── migrations/
│           │   └── 001-create-payment-tables.ts            # Database schema
│           │
│           ├── tests/
│           │   ├── unit/
│           │   │   └── payment.service.spec.ts
│           │   └── e2e/
│           │       └── payment.e2e-spec.ts
│           │
│           ├── dist/                                       # Built plugin bundle
│           │   ├── payment-plugin.bundle.js                # Webpack bundled code
│           │   └── assets/
│           │
│           ├── plugin.manifest.json                        # Plugin metadata
│           ├── plugin.routes.json                          # API routes definition
│           ├── plugin.permissions.json                     # Required permissions
│           ├── plugin.dependencies.json                    # External dependencies
│           ├── package.json                                # Plugin package info
│           ├── tsconfig.json                               # TypeScript config
│           ├── webpack.config.js                           # Bundle configuration
│           └── README.md                                   # Plugin documentation
├── libs/
│   └── shared/
│          ├── plugin-types/                                # TypeScript interfaces & types
│          │   ├── src/
│          │   │   ├── plugin.interface.ts                  # Core plugin contract
│          │   │   ├── manifest.interface.ts                # Plugin manifest schema
│          │   │   ├── lifecycle.interface.ts               # Plugin lifecycle hooks
│          │   │   ├── communication.interface.ts           # Plugin-to-host communication
│          │   │   ├── permissions.interface.ts             # Permission system types
│          │   │   └── index.ts                             # Export all types
│          │   ├── package.json
│          │   └── tsconfig.json
│          │
│          ├── plugin-sdk/                                  # SDK for plugin development
│          │   ├── src/
│          │   │   ├── decorators/
│          │   │   │   ├── plugin.decorator.ts              # @Plugin() decorator
│          │   │   │   └── plugin-route.decorator.ts        # @PluginRoute() decorator
│          │   │   ├── base/
│          │   │   │   ├── base-plugin.ts                   # Abstract base plugin class
│          │   │   │   └── base-service.ts                  # Base plugin service
│          │   │   ├── context/
│          │   │   │   └── plugin-context.ts                # Plugin execution context
│          │   │   ├── utilities/
│          │   │   │   ├── config.util.ts                   # Plugin configuration helpers
│          │   │   │   ├── validation.util.ts               # Input validation helpers
│          │   │   │   └── logger.util.ts                   # Plugin logging utilities
│          │   │   └── index.ts
│          │   ├── package.json
│          │   └── README.md
│          │
│          └── common/                                      # Common utilities & helpers
│              ├── src/
│              │   ├── constants/
│              │   │   ├── plugin.constants.ts              # Plugin system constants
│              │   │   └── event.constants.ts               # Event type constants
│              │   ├── enums/
│              │   │   ├── plugin-status.enum.ts            # Plugin lifecycle states
│              │   │   └── permission.enum.ts               # Permission levels
│              │   ├── validators/
│              │   │   ├── manifest.validator.ts            # Plugin manifest validation
│              │   │   ├── config.validator.ts              # Configuration validation
│              │   ├── errors/
│              │   │   └── plugin.errors.ts                 # Plugin-specific error classes
│              │   └── index.ts
│              ├── package.json
│              └── tsconfig.json
├── tools/
│   └── plugin-builder/                                     # Automated plugin build system
│       ├── src/
│       │   ├── builder/
│       │   │   ├── webpack.config.ts                       # Plugin-specific webpack config
│       │   │   ├── bundle-analyzer.ts                      # Bundle size & dependency analysis
│       │   │   ├── code-splitter.ts                        # Split plugin into chunks
│       │   │   └── optimizer.ts                            # Tree shaking & minification
│       │   ├── validators/
│       │   │   ├── manifest-validator.ts                   # Validate plugin.manifest.json
│       │   │   ├── dependency-checker.ts                   # Check for conflicts
│       │   │   ├── security-scanner.ts                     # Basic security checks
│       │   │   └── api-validator.ts                        # Validate plugin API contracts
│       │   ├── packager/
│       │   │   ├── bundle-packager.ts                      # Create .tgz with metadata
│       │   │   ├── version-manager.ts                      # Semantic versioning
│       │   │   └── metadata-generator.ts                   # Generate plugin metadata
│       │   ├── uploader/
│       │   │   ├── registry-client.ts                      # Upload to plugin registry
│       │   │   ├── retry-handler.ts                        # Handle upload failures
│       │   │   └── progress-tracker.ts                     # Upload progress tracking
│       │   └── cli/
│       │       ├── build-command.ts                        # CLI build command
│       │       ├── upload-command.ts                       # CLI upload command
│       │       └── watch-command.ts                        # Development hot reload
│       ├── templates/
│       │   ├── webpack.plugin.template.js                  # Base webpack config
│       │   ├── tsconfig.plugin.template.json
│       │   └── package.plugin.template.json
│       ├── configs/
│       │   ├── build.config.ts                             # Build configuration
│       │   ├── environments.ts                             # Target environments
│       │   └── registry.config.ts                          # Registry endpoints
│       ├── scripts/
│       │   ├── build-plugin.sh                             # Shell script wrapper
│       │   ├── build-all.sh                                # Build all plugins
│       │   └── deploy-plugin.sh                            # Build + upload pipeline
│       └── package.json
├── .gitignore                                              # Git ignore rules
├── README.md                                               # Project overview and setup guide
├── CLAUDE.md                                               # Detailed architecture and design decisions
├── tsconfig.json                                           # TypeScript configuration
├── tsconfig.build.json                                     # TypeScript build configuration
├── nest-cli.json                                           # NestJS CLI configuration
├── jest.config.js                                          # Jest testing configuration
├── eslint.config.mjs                                       # ESLint configuration
├── .prettierrc                                             # Prettier configuration
├── .env                                                    # Environment variables
├── .env.example                                            # Example environment variables
└── package.json                                            # Root package.json with workspaces
```

