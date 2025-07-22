import { Injectable, Scope } from '@nestjs/common';
import { PluginMetadata } from '../base/base-plugin';

export type PluginRequestBody = 
  | string 
  | number 
  | boolean 
  | Record<string, any> 
  | Array<any> 
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
  | Record<string, any> 
  | Array<any> 
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
  private _plugin!: PluginMetadata;
  private _request!: PluginRequest;
  private _response!: PluginResponse;
  private _user: PluginUser | null = null;
  private _host!: PluginHost;
  private _executionContext: PluginExecutionContext;
  private _data: Map<string, string | number | boolean | Date | Record<string, any> | Array<any>> = new Map();

  constructor() {
    this._executionContext = {
      requestId: this.generateId(),
      startTime: new Date(),
    };
  }

  setPlugin(plugin: PluginMetadata): void {
    this._plugin = plugin;
  }

  getPlugin(): PluginMetadata {
    return this._plugin;
  }

  setRequest(request: PluginRequest): void {
    this._request = request;
  }

  getRequest(): PluginRequest {
    return this._request;
  }

  setResponse(response: PluginResponse): void {
    this._response = response;
  }

  getResponse(): PluginResponse {
    return this._response;
  }

  setUser(user: PluginUser | null): void {
    this._user = user;
  }

  getUser(): PluginUser | null {
    return this._user;
  }

  isAuthenticated(): boolean {
    return this._user !== null;
  }

  hasPermission(permission: string): boolean {
    return this._user?.permissions.includes(permission) ?? false;
  }

  hasRole(role: string): boolean {
    return this._user?.roles.includes(role) ?? false;
  }

  setHost(host: PluginHost): void {
    this._host = host;
  }

  getHost(): PluginHost {
    return this._host;
  }

  getExecutionContext(): PluginExecutionContext {
    return { ...this._executionContext };
  }

  setExecutionContext(context: Partial<PluginExecutionContext>): void {
    this._executionContext = {
      ...this._executionContext,
      ...context,
    };
  }

  getRequestId(): string {
    return this._executionContext.requestId;
  }

  getCorrelationId(): string | undefined {
    return this._executionContext.correlationId;
  }

  setCorrelationId(correlationId: string): void {
    this._executionContext.correlationId = correlationId;
  }

  getTraceId(): string | undefined {
    return this._executionContext.traceId;
  }

  setTraceId(traceId: string): void {
    this._executionContext.traceId = traceId;
  }

  getElapsedTime(): number {
    return Date.now() - this._executionContext.startTime.getTime();
  }

  set<T extends string | number | boolean | Date | Record<string, any> | Array<any>>(key: string, value: T): void {
    this._data.set(key, value);
  }

  get<T extends string | number | boolean | Date | Record<string, any> | Array<any>>(key: string): T | undefined {
    return this._data.get(key) as T | undefined;
  }

  has(key: string): boolean {
    return this._data.has(key);
  }

  delete(key: string): boolean {
    return this._data.delete(key);
  }

  clear(): void {
    this._data.clear();
  }

  getAllData(): Record<string, string | number | boolean | Date | Record<string, any> | Array<any>> {
    return Object.fromEntries(this._data);
  }

  createChildContext(): PluginContext {
    const childContext = new PluginContext();
    childContext._plugin = this._plugin;
    childContext._host = this._host;
    childContext._user = this._user;
    childContext._executionContext = {
      ...this._executionContext,
      requestId: this.generateId(),
      startTime: new Date(),
    };
    return childContext;
  }

  toJSON(): Record<string, any> {
    return {
      plugin: this._plugin,
      request: this._request
        ? {
            id: this._request.id,
            method: this._request.method,
            url: this._request.url,
            timestamp: this._request.timestamp,
          }
        : null,
      user: this._user
        ? {
            id: this._user.id,
            username: this._user.username,
            roles: this._user.roles,
          }
        : null,
      host: this._host,
      executionContext: this._executionContext,
      data: this.getAllData(),
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}
