import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

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
export class PluginEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  @Index()
  name: string;

  @Column({ length: 20 })
  version: string;

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
  category: PluginCategory;

  @Column({
    type: 'enum',
    enum: PluginStatus,
    default: PluginStatus.UPLOADED,
  })
  @Index()
  status: PluginStatus;

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
  filePath: string;

  @Column({ type: 'bigint' })
  fileSize: number;

  @Column({ length: 64 })
  checksum: string;

  @Column({ type: 'json', nullable: true })
  manifest?: any;

  @Column({ type: 'json', nullable: true })
  validationResults?: any;

  @Column({ type: 'int', default: 0 })
  downloadCount: number;

  @Column({ type: 'float', default: 0 })
  rating: number;

  @Column({ type: 'int', default: 0 })
  ratingCount: number;

  @Column({ type: 'text', nullable: true })
  readme?: string;

  @Column({ type: 'simple-array', nullable: true })
  screenshots?: string[];

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  deprecatedAt?: Date;
}
