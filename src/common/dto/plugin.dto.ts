import { IsString, IsOptional, IsArray, IsEnum, IsObject, IsBoolean, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PluginStatus } from '../interfaces/plugin.interface';

export class PluginDependencyDto {
  @ApiProperty({ 
    description: 'Dependency package name',
    example: 'lodash',
    pattern: '^[a-z0-9][a-z0-9\\-_./@]*[a-z0-9]$'
  })
  @IsString()
  name: string;

  @ApiProperty({ 
    description: 'Semantic version or version range',
    example: '^4.17.21',
    pattern: '^[\\^~>=<]*\\d+\\.\\d+\\.\\d+.*$'
  })
  @IsString()
  version: string;

  @ApiPropertyOptional({ 
    description: 'Whether the dependency is optional (plugin works without it)',
    default: false,
    example: false
  })
  @IsOptional()
  @IsBoolean()
  optional?: boolean;
}

export class PermissionDto {
  @ApiProperty({ 
    description: 'Permission identifier (namespace:action format)',
    example: 'api:read',
    pattern: '^[a-z][a-z0-9\\-]*:[a-z][a-z0-9\\-]*$'
  })
  @IsString()
  name: string;

  @ApiProperty({ 
    description: 'Human-readable permission description',
    example: 'Read access to API endpoints',
    minLength: 10,
    maxLength: 200
  })
  @IsString()
  description: string;

  @ApiProperty({ 
    description: 'Permission access level',
    enum: ['read', 'write', 'admin'],
    example: 'read',
    enumName: 'PermissionLevel'
  })
  @IsEnum(['read', 'write', 'admin'])
  level: 'read' | 'write' | 'admin';
}

export class ResourceLimitsDto {
  @ApiProperty({ description: 'Memory limit (e.g., 128MB)' })
  @IsString()
  memory: string;

  @ApiProperty({ description: 'CPU limit (e.g., 0.5)' })
  @IsString()
  cpu: string;

  @ApiProperty({ description: 'Disk limit (e.g., 1GB)' })
  @IsString()
  disk: string;

  @ApiProperty({ description: 'Network limit (e.g., 10MB/s)' })
  @IsString()
  network: string;

  @ApiProperty({ description: 'Execution time limit in milliseconds' })
  @IsNumber()
  executionTime: number;
}

export class PluginManifestDto {
  @ApiProperty({ description: 'Plugin name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Plugin version' })
  @IsString()
  version: string;

  @ApiPropertyOptional({ description: 'Plugin description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Plugin author' })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional({ description: 'Plugin license' })
  @IsOptional()
  @IsString()
  license?: string;

  @ApiProperty({ description: 'Main entry point file' })
  @IsString()
  main: string;

  @ApiPropertyOptional({ description: 'Plugin dependencies', type: [PluginDependencyDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PluginDependencyDto)
  dependencies?: PluginDependencyDto[];

  @ApiPropertyOptional({ description: 'Peer dependencies' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  peerDependencies?: string[];

  @ApiPropertyOptional({ description: 'Minimum Node.js version' })
  @IsOptional()
  @IsString()
  minimumNodeVersion?: string;

  @ApiPropertyOptional({ description: 'Required permissions', type: [PermissionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  requiredPermissions?: PermissionDto[];

  @ApiPropertyOptional({ description: 'Configuration schema' })
  @IsOptional()
  @IsObject()
  configSchema?: any;

  @ApiPropertyOptional({ description: 'Resource limits', type: ResourceLimitsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ResourceLimitsDto)
  resourceLimits?: ResourceLimitsDto;
}

export class PluginLoadOptionsDto {
  @ApiPropertyOptional({ description: 'Tenant ID for multi-tenant isolation' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Plugin configuration' })
  @IsOptional()
  @IsObject()
  config?: any;

  @ApiPropertyOptional({ description: 'Resource limits', type: ResourceLimitsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ResourceLimitsDto)
  resourceLimits?: ResourceLimitsDto;

  @ApiPropertyOptional({ description: 'Plugin permissions', type: [PermissionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions?: PermissionDto[];

  @ApiPropertyOptional({ description: 'Enable hot reload' })
  @IsOptional()
  @IsBoolean()
  hotReload?: boolean;

  @ApiPropertyOptional({ description: 'Enable sandboxed execution' })
  @IsOptional()
  @IsBoolean()
  sandboxed?: boolean;
}

export class PluginInfoDto {
  @ApiProperty({ description: 'Plugin ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Plugin name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Plugin version' })
  @IsString()
  version: string;

  @ApiPropertyOptional({ description: 'Plugin description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Plugin author' })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiProperty({ description: 'Plugin status', enum: PluginStatus })
  @IsEnum(PluginStatus)
  status: PluginStatus;

  @ApiProperty({ description: 'Creation date' })
  created: Date;

  @ApiProperty({ description: 'Last update date' })
  updated: Date;

  @ApiPropertyOptional({ description: 'Tenant ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class PluginHealthDto {
  @ApiProperty({ description: 'Health status', enum: ['healthy', 'unhealthy', 'degraded'] })
  @IsEnum(['healthy', 'unhealthy', 'degraded'])
  status: 'healthy' | 'unhealthy' | 'degraded';

  @ApiProperty({ description: 'Health checks' })
  @IsArray()
  checks: any[];

  @ApiProperty({ description: 'Last health check timestamp' })
  lastCheck: Date;

  @ApiProperty({ description: 'Uptime in milliseconds' })
  @IsNumber()
  uptime: number;
}

export class PluginMetricsDto {
  @ApiProperty({ description: 'Plugin ID' })
  @IsString()
  pluginId: string;

  @ApiProperty({ description: 'Memory usage in bytes' })
  @IsNumber()
  memoryUsage: number;

  @ApiProperty({ description: 'CPU usage percentage' })
  @IsNumber()
  cpuUsage: number;

  @ApiProperty({ description: 'Request count' })
  @IsNumber()
  requestCount: number;

  @ApiProperty({ description: 'Error count' })
  @IsNumber()
  errorCount: number;

  @ApiProperty({ description: 'Average response time in milliseconds' })
  @IsNumber()
  averageResponseTime: number;

  @ApiProperty({ description: 'Timestamp' })
  timestamp: Date;
}

export class InstallPluginDto {
  @ApiProperty({ description: 'Plugin source (URL, file path, or package name)' })
  @IsString()
  source: string;

  @ApiPropertyOptional({ description: 'Plugin load options', type: PluginLoadOptionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PluginLoadOptionsDto)
  options?: PluginLoadOptionsDto;
}

export class UpdatePluginDto {
  @ApiPropertyOptional({ description: 'New plugin version' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ description: 'Updated configuration' })
  @IsOptional()
  @IsObject()
  config?: any;

  @ApiPropertyOptional({ description: 'Updated resource limits', type: ResourceLimitsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ResourceLimitsDto)
  resourceLimits?: ResourceLimitsDto;
}

export class PluginSecurityDto {
  @ApiProperty({ 
    description: 'Plugin security status',
    example: 'secure'
  })
  @IsString()
  status: 'secure' | 'warning' | 'vulnerable' | 'unknown';

  @ApiProperty({ 
    description: 'Security scan timestamp',
    example: '2024-01-20T15:30:00Z'
  })
  lastScan: Date;

  @ApiProperty({ 
    description: 'List of security violations found',
    type: [String],
    example: []
  })
  @IsArray()
  @IsString({ each: true })
  violations: string[];

  @ApiProperty({ 
    description: 'List of security warnings',
    type: [String],
    example: ['Uses deprecated crypto API']
  })
  @IsArray()
  @IsString({ each: true })
  warnings: string[];

  @ApiProperty({ 
    description: 'Sandbox information',
    required: false
  })
  @IsOptional()
  sandbox?: {
    id: string;
    resourceUsage: any;
    createdAt: Date;
    lastActivity: Date;
  };
}

export class PluginRouteDto {
  @ApiProperty({ 
    description: 'HTTP method',
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    example: 'GET'
  })
  @IsEnum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
  method: string;

  @ApiProperty({ 
    description: 'Route path',
    example: '/hello'
  })
  @IsString()
  path: string;

  @ApiProperty({ 
    description: 'Handler function name',
    example: 'hello'
  })
  @IsString()
  handler: string;

  @ApiPropertyOptional({ 
    description: 'Route description',
    example: 'Returns a greeting message'
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class PluginDetailDto extends PluginInfoDto {
  @ApiProperty({ 
    description: 'Plugin manifest',
    type: PluginManifestDto
  })
  @ValidateNested()
  @Type(() => PluginManifestDto)
  manifest: PluginManifestDto;

  @ApiProperty({ 
    description: 'Plugin routes',
    type: [PluginRouteDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PluginRouteDto)
  routes: PluginRouteDto[];

  @ApiPropertyOptional({ 
    description: 'Plugin security information',
    type: PluginSecurityDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PluginSecurityDto)
  security?: PluginSecurityDto;

  @ApiPropertyOptional({ 
    description: 'Plugin health information',
    type: PluginHealthDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PluginHealthDto)
  health?: PluginHealthDto;

  @ApiPropertyOptional({ 
    description: 'Plugin metrics',
    type: PluginMetricsDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PluginMetricsDto)
  metrics?: PluginMetricsDto;
}

export class PluginListResponseDto {
  @ApiProperty({ 
    description: 'List of plugins',
    type: [PluginInfoDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PluginInfoDto)
  plugins: PluginInfoDto[];

  @ApiProperty({ 
    description: 'Total number of plugins',
    example: 15
  })
  @IsNumber()
  total: number;

  @ApiProperty({ 
    description: 'Number of plugins returned',
    example: 10
  })
  @IsNumber()
  count: number;

  @ApiPropertyOptional({ 
    description: 'Pagination offset',
    example: 0
  })
  @IsOptional()
  @IsNumber()
  offset?: number;

  @ApiPropertyOptional({ 
    description: 'Pagination limit',
    example: 50
  })
  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class PluginErrorDto {
  @ApiProperty({ 
    description: 'Error message',
    example: 'Plugin validation failed'
  })
  @IsString()
  message: string;

  @ApiProperty({ 
    description: 'Error code',
    example: 'PLUGIN_VALIDATION_ERROR'
  })
  @IsString()
  code: string;

  @ApiPropertyOptional({ 
    description: 'Additional error details',
    example: { field: 'manifest.version', issue: 'Invalid version format' }
  })
  @IsOptional()
  @IsObject()
  details?: any;

  @ApiProperty({ 
    description: 'Error timestamp',
    example: '2024-01-20T15:30:00Z'
  })
  timestamp: Date;
}