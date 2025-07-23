import { getErrorMessage } from '@lib/shared/common';
import { IPlugin } from '@lib/shared/plugin-types';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import {
  PluginInstance,
  PluginInstanceService,
} from './plugin-instance.service';
import { PluginSecurityService } from './plugin-security.service';


export interface ProxyContext {
  request: Request;
  response: Response;
  pluginId: string;
  instanceId: string;
  route: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
}

export interface PluginRequestData {
  route: string;
  method: string;
  body?: unknown;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  headers: Record<string, string>;
}

export interface PluginMethodHandler {
  (requestData: PluginRequestData): Promise<unknown>;
}

@Injectable()
export class PluginProxyService {
  private readonly logger = new Logger(PluginProxyService.name);

  constructor(
    private readonly instanceService: PluginInstanceService,
    private readonly securityService: PluginSecurityService,
  ) {}

  async proxyRequest(context: ProxyContext): Promise<unknown> {
    const { instanceId, route, method } = context;

    try {
      const instance = this.instanceService.getInstance(instanceId);
      if (instance == null) {
        throw new BadRequestException(
          `Plugin instance not found: ${instanceId}`,
        );
      }

      await this.validateRequest(context, instance);

      const result: unknown = await this.executePluginMethod(context, instance);

      this.logger.debug(
        `Proxied ${method} ${route} to plugin ${instance.name}`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Proxy request failed: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  async proxyWebSocketConnection(
    instanceId: string,
    socket: unknown,
    data: unknown,
  ): Promise<void> {
    const instance = this.instanceService.getInstance(instanceId);
    if (instance == null) {
      throw new Error(`Plugin instance not found: ${instanceId}`);
    }

    if (instance.instance.onWebSocketConnection) {
      await instance.instance.onWebSocketConnection(socket, data);
    }
  }

  private async validateRequest(
    context: ProxyContext,
    instance: PluginInstance,
  ): Promise<void> {
    const hasPermission = await this.securityService.checkPermission(
      instance.name,
      context.route,
      context.method,
    );

    if (!hasPermission) {
      throw new BadRequestException(
        `Plugin ${instance.name} does not have permission for ${context.method} ${context.route}`,
      );
    }

    if (this.securityService.isRateLimited(instance.id)) {
      throw new BadRequestException(
        `Rate limit exceeded for plugin ${instance.name}`,
      );
    }
  }

  private async executePluginMethod(
    context: ProxyContext,
    instance: PluginInstance,
  ): Promise<unknown> {
    const { route, method, body, query, params, headers } = context;

    const requestData: PluginRequestData = {
      route,
      method: method.toUpperCase(),
      body,
      headers: this.filterHeaders(headers),
    };

    if (query !== undefined) {
      requestData.query = query;
    }

    if (params !== undefined) {
      requestData.params = params;
    }

    try {
      if (instance.instance.handleRequest) {
        return await instance.instance.handleRequest(requestData);
      }

      const methodHandler = this.getMethodHandler(
        instance.instance,
        method,
        route,
      );
      if (methodHandler != null) {
        return await methodHandler.call(instance.instance, requestData);
      }

      throw new BadRequestException(`No handler found for ${method} ${route}`);
    } catch (error) {
      this.logger.error(`Plugin execution failed: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  private getMethodHandler(
    pluginInstance: IPlugin,
    method: string,
    route: string,
  ): PluginMethodHandler | null {
    const methodName = `handle${method.toUpperCase()}`;

    if (typeof (pluginInstance as unknown as Record<string, unknown>)[methodName] === 'function') {
      return (pluginInstance as unknown as Record<string, unknown>)[methodName] as PluginMethodHandler;
    }

    const routeHandler = `handle${this.routeToMethodName(route)}`;
    if (typeof (pluginInstance as unknown as Record<string, unknown>)[routeHandler] === 'function') {
      return (pluginInstance as unknown as Record<string, unknown>)[routeHandler] as PluginMethodHandler;
    }

    return null;
  }

  private routeToMethodName(route: string): string {
    return route
      .split('/')
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join('');
  }

  private filterHeaders(
    headers: Record<string, string>,
  ): Record<string, string> {
    const allowedHeaders = [
      'content-type',
      'accept',
      'user-agent',
      'authorization',
    ];

    const filtered: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (allowedHeaders.includes(key.toLowerCase())) {
        filtered[key] = value;
      }
    }

    return filtered;
  }
}
