import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { ValidationResults } from '../metadata/metadata.service';

export enum PluginCategory {
  PAYMENT = 'payment',
  CRM = 'crm',
  ANALYTICS = 'analytics',
  AUTHENTICATION = 'authentication',
  INTEGRATION = 'integration',
  UTILITY = 'utility',
  OTHER = 'other',
}

export class CreatePluginUploadDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  version!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  author?: string;

  @IsString()
  @IsOptional()
  license?: string;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsEnum(PluginCategory)
  @IsOptional()
  category?: PluginCategory;

  @IsUrl()
  @IsOptional()
  homepage?: string;

  @IsUrl()
  @IsOptional()
  repository?: string;

  @IsString()
  @IsOptional()
  readme?: string;

  @IsArray()
  @IsOptional()
  dependencies?: string[];

  @IsString()
  @IsOptional()
  minHostVersion?: string;

  @IsString()
  @IsOptional()
  maxHostVersion?: string;
}

export class PluginUploadResponseDto {
  id!: string;
  name!: string;
  version!: string;
  status!: 'uploaded' | 'validating' | 'validated' | 'published' | 'failed';
  uploadedAt!: Date;
  validationResults?: ValidationResults;
  downloadUrl?: string;
  size!: number;
  checksum!: string;
}
