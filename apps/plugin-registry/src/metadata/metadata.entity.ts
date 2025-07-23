import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
  main?: string;
  engines?: {
    node?: string;
    host?: string;
  };
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  permissions?: string[];
  routes?: PluginRoute[];
  configuration?: PluginConfigurationSchema;
  assets?: PluginAssets;
}

export interface PluginRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  handler: string;
  middleware?: string[];
  permissions?: string[];
}

export interface PluginConfigurationSchema {
  type: 'object';
  properties: Record<string, PluginConfigProperty>;
  required?: string[];
}

export interface PluginConfigProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  default?: unknown;
  enum?: unknown[];
  format?: string;
  minimum?: number;
  maximum?: number;
  items?: PluginConfigProperty;
  properties?: Record<string, PluginConfigProperty>;
}

export interface PluginAssets {
  icons?: {
    small?: string;
    medium?: string;
    large?: string;
  };
  screenshots?: string[];
  documentation?: string[];
}

export interface PluginValidationResults {
  isValid: boolean;
  errors: PluginValidationError[];
  warnings: PluginValidationWarning[];
  securityScore: number;
  compatibility: {
    hostVersions: string[];
    nodeVersions: string[];
  };
  dependencies: {
    resolved: Record<string, string>;
    missing: string[];
    conflicts: string[];
  };
  performance: {
    bundleSize: number;
    estimatedMemory: number;
  };
  timestamp: string;
}

export interface PluginValidationError {
  code: string;
  message: string;
  severity: 'error' | 'warning';
  path?: string;
  line?: number;
  column?: number;
}

export interface PluginValidationWarning {
  code: string;
  message: string;
  path?: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

export interface PluginMetadata {
  buildInfo?: {
    buildTime: string;
    buildNumber?: string;
    gitHash?: string;
    buildEnvironment?: string;
  };
  runtime?: {
    minMemory?: number;
    maxMemory?: number;
    cpuRequirements?: string;
  };
  security?: {
    permissions: string[];
    sandboxed: boolean;
    networkAccess: boolean;
    fileSystemAccess: boolean;
  };
  localization?: {
    supportedLocales: string[];
    defaultLocale: string;
  };
  analytics?: {
    trackingEnabled: boolean;
    metricsEndpoint?: string;
  };
  [key: string]: unknown;
}

export enum PluginStatus {
  UPLOADED = 'uploaded',
  VALIDATING = 'validating',
  VALIDATED = 'validated',
  PUBLISHED = 'published',
  DEPRECATED = 'deprecated',
  REMOVED = 'removed',
}

export enum PluginCategory {
  PAYMENT = 'payment',
  CRM = 'crm',
  ANALYTICS = 'analytics',
  AUTHENTICATION = 'authentication',
  INTEGRATION = 'integration',
  UTILITY = 'utility',
  OTHER = 'other',
}

@Entity('plugins')
@Unique(['name', 'version'])
@Index(['name', 'status'])
@Index(['category', 'status'])
@Index(['author', 'status'])
@Index(['status', 'category', 'rating'])
@Index(['status', 'downloadCount'])
@Index(['status', 'publishedAt'])
@Index('tags')
@Index('idx_plugins_search')
export class PluginEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  @Index()
  name!: string;

  @Column({ length: 20 })
  version!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ length: 100, nullable: true })
  author?: string;

  @Column({ length: 50, nullable: true })
  license?: string;

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({
    type: 'enum',
    enum: PluginCategory,
    default: PluginCategory.OTHER,
  })
  category!: PluginCategory;

  @Column({
    type: 'enum',
    enum: PluginStatus,
    default: PluginStatus.UPLOADED,
  })
  @Index()
  status!: PluginStatus;

  @Column({ nullable: true })
  homepage?: string;

  @Column({ nullable: true })
  repository?: string;

  @Column({ type: 'simple-array', nullable: true })
  dependencies?: string[];

  @Column({ length: 20, nullable: true })
  minHostVersion?: string;

  @Column({ length: 20, nullable: true })
  maxHostVersion?: string;

  @Column()
  filePath!: string;

  @Column({ type: 'bigint' })
  fileSize!: number;

  @Column({ length: 64 })
  checksum!: string;

  @Column({ type: 'json', nullable: true })
  manifest?: PluginManifest;

  @Column({ type: 'json', nullable: true })
  validationResults?: PluginValidationResults;

  @Column({ type: 'int', default: 0 })
  downloadCount!: number;

  @Column({ type: 'float', default: 0 })
  rating!: number;

  @Column({ type: 'int', default: 0 })
  ratingCount!: number;

  @Column({ type: 'text', nullable: true })
  readme?: string;

  @Column({ type: 'simple-array', nullable: true })
  screenshots?: string[];

  @Column({ type: 'json', nullable: true })
  metadata?: PluginMetadata;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  deprecatedAt?: Date;
}
