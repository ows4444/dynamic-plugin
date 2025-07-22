export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  message?: string;
  duration?: number;
  details?: Record<string, unknown>;
  timestamp: Date;
}
export interface HealthCheckResponse {
  status: HealthStatus;
  timestamp: Date;
  duration: number;
  checks: HealthCheckResult[];
  info?: {
    version?: string;
    uptime?: number;
    environment?: string;
    host?: string;
  };
  error?: {
    message: string;
    details?: Record<string, unknown>;
  };
}
export interface HealthCheckConfig {
  name: string;
  enabled?: boolean;
  timeout?: number;
  cacheDuration?: number;
  critical?: boolean;
  tags?: string[];
}
export interface PluginHealthInfo {
  pluginId: string;
  name: string;
  version: string;
  status: 'loaded' | 'running' | 'stopped' | 'error';
  uptime?: number;
  memoryUsage?: number;
  activeConnections?: number;
  lastError?: {
    message: string;
    timestamp: Date;
    stack?: string;
  };
  metrics?: Record<string, number>;
}
export interface SystemHealthInfo {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  disk?: {
    used: number;
    total: number;
    percentage: number;
  };
  network?: {
    connections: number;
    bytesSent?: number;
    bytesReceived?: number;
  };
}
export interface DatabaseHealthInfo {
  type: string;
  connected: boolean;
  responseTime?: number;
  connections?: number;
  version?: string;
  lastError?: {
    message: string;
    timestamp: Date;
    code?: string | number;
  };
}
export interface ExternalServiceHealthInfo {
  name: string;
  url: string;
  status: 'available' | 'unavailable' | 'degraded';
  responseTime?: number;
  statusCode?: number;
  lastSuccessful?: Date;
  lastError?: {
    message: string;
    timestamp: Date;
    statusCode?: number;
  };
}