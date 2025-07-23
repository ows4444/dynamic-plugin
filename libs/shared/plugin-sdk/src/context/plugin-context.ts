import { Injectable, Scope } from '@nestjs/common';
import { PluginMetadata } from '../base/base-plugin';

export type PluginRequestBody = 
  | string 
  | number 
  | boolean 
  | Record<string, unknown> 
  | Array<unknown> 
  | null;

export interface PluginRequest {
  id: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  query: Record<string, string | string[] | number | boolean>;
  params: Record<string, string | number>;
  body?: PluginRequestBody;
  user?: PluginUser;
  timestamp: Date;
}

export type PluginResponseBody = 
  | string 
  | number 
  | boolean 
  | Record<string, unknown> 
  | Array<unknown> 
  | null;

export interface PluginResponse {
  statusCode: number;
  headers: Record<string, string>;
  body?: PluginResponseBody;
  timestamp: Date;
}

export type PluginUserMetadata = Record<string, string | number | boolean | Date>;

export interface PluginUser {
  id: string;
  username?: string;
  email?: string;
  roles: string[];
  permissions: string[];
  metadata?: PluginUserMetadata;
}

export interface PluginHost {
  id: string;
  name: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  features: string[];
}

export type PluginExecutionMetadata = Record<string, string | number | boolean | Date>;

export interface PluginExecutionContext {
  pluginId: string;
  pluginName: string;
  version: string;
  requestId: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  startTime: Date;
  timeout?: number;
  retries?: number;
  metadata?: PluginExecutionMetadata;
}

@Injectable({ scope: Scope.REQUEST })
export class PluginContext {
  private plugin!: PluginMetadata;
  private request!: PluginRequest;
  private response!: PluginResponse;
  private user: PluginUser | null = null;
  private host!: PluginHost;
  private executionContext: PluginExecutionContext;
  private readonly data: Map<string, string | number | boolean | Date | Record<string, unknown> | Array<unknown>> = new Map();

  constructor() {
    this.executionContext = {
      pluginId: '',
      pluginName: '',
      version: '',
      requestId: this.generateId(),
      startTime: new Date(),
    };
  }

  setPlugin(plugin: PluginMetadata): void {
    this.plugin = plugin;
    this.executionContext.pluginId = plugin.id;
    this.executionContext.pluginName = plugin.name;
    this.executionContext.version = plugin.version;
  }

  getPlugin(): PluginMetadata {
    return this.plugin;
  }

  setRequest(request: PluginRequest): void {
    this.request = request;
  }

  getRequest(): PluginRequest {
    return this.request;
  }

  setResponse(response: PluginResponse): void {
    this.response = response;
  }

  getResponse(): PluginResponse {
    return this.response;
  }

  setUser(user: PluginUser | null): void {
    this.user = user;
  }

  getUser(): PluginUser | null {
    return this.user;
  }

  isAuthenticated(): boolean {
    return this.user !== null;
  }

  hasPermission(permission: string): boolean {
    return this.user?.permissions.includes(permission) ?? false;
  }

  hasRole(role: string): boolean {
    return this.user?.roles.includes(role) ?? false;
  }

  setHost(host: PluginHost): void {
    this.host = host;
  }

  getHost(): PluginHost {
    return this.host;
  }

  getExecutionContext(): PluginExecutionContext {
    return { ...this.executionContext };
  }

  setExecutionContext(context: Partial<PluginExecutionContext>): void {
    this.executionContext = {
      ...this.executionContext,
      ...context,
    };
  }

  getRequestId(): string {
    return this.executionContext.requestId;
  }

  getCorrelationId(): string | undefined {
    return this.executionContext.correlationId;
  }

  setCorrelationId(correlationId: string): void {
    this.executionContext.correlationId = correlationId;
  }

  getTraceId(): string | undefined {
    return this.executionContext.traceId;
  }

  setTraceId(traceId: string): void {
    this.executionContext.traceId = traceId;
  }

  getElapsedTime(): number {
    return Date.now() - this.executionContext.startTime.getTime();
  }

  set<T extends string | number | boolean | Date | Record<string, unknown> | Array<unknown>>(key: string, value: T): void {
    this.data.set(key, value);
  }

  get<T extends string | number | boolean | Date | Record<string, unknown> | Array<unknown>>(key: string): T | undefined {
    return this.data.get(key) as T | undefined;
  }

  has(key: string): boolean {
    return this.data.has(key);
  }

  delete(key: string): boolean {
    return this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }

  getAllData(): Record<string, string | number | boolean | Date | Record<string, unknown> | Array<unknown>> {
    return Object.fromEntries(this.data);
  }

  createChildContext(): PluginContext {
    const childContext = new PluginContext();
    childContext.plugin = this.plugin;
    childContext.host = this.host;
    childContext.user = this.user;
    childContext.executionContext = {
      ...this.executionContext,
      pluginId: this.plugin.id,
      pluginName: this.plugin.name,
      version: this.plugin.version,
      requestId: this.generateId(),
      startTime: new Date(),
    };
    return childContext;
  }

  toJSON(): Record<string, unknown> {
    return {
      plugin: this.plugin,
      request: this.request,
      user: this.user
        ? {
            id: this.user.id,
            username: this.user.username,
            roles: this.user.roles,
          }
        : null,
      host: this.host,
      executionContext: this.executionContext,
      data: this.getAllData(),
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}
