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
  body?: any;
  query?: any;
  params?: any;
}

@Injectable()
export class PluginProxyService {
  private readonly logger = new Logger(PluginProxyService.name);

  constructor(
    private readonly instanceService: PluginInstanceService,
    private readonly securityService: PluginSecurityService,
  ) {}

  async proxyRequest(context: ProxyContext): Promise<any> {
    const { instanceId, route, method } = context;

    try {
      const instance = this.instanceService.getInstance(instanceId);
      if (!instance) {
        throw new BadRequestException(
          `Plugin instance not found: ${instanceId}`,
        );
      }

      await this.validateRequest(context, instance);

      const result = await this.executePluginMethod(context, instance);

      this.logger.debug(
        `Proxied ${method} ${route} to plugin ${instance.name}`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Proxy request failed: ${error.message}`);
      throw error;
    }
  }

  async proxyWebSocketConnection(
    instanceId: string,
    socket: any,
    data: any,
  ): Promise<void> {
    const instance = this.instanceService.getInstance(instanceId);
    if (!instance) {
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
  ): Promise<any> {
    const { route, method, body, query, params, headers } = context;

    const requestData = {
      route,
      method: method.toUpperCase(),
      body,
      query,
      params,
      headers: this.filterHeaders(headers),
    };

    try {
      if (instance.instance.handleRequest) {
        return await instance.instance.handleRequest(requestData);
      }

      const methodHandler = this.getMethodHandler(
        instance.instance,
        method,
        route,
      );
      if (methodHandler) {
        return await methodHandler.call(instance.instance, requestData);
      }

      throw new BadRequestException(`No handler found for ${method} ${route}`);
    } catch (error) {
      this.logger.error(`Plugin execution failed: ${error.message}`);
      throw error;
    }
  }

  private getMethodHandler(
    pluginInstance: any,
    method: string,
    route: string,
  ): Function | null {
    const methodName = `handle${method.toUpperCase()}`;

    if (typeof pluginInstance[methodName] === 'function') {
      return pluginInstance[methodName];
    }

    const routeHandler = `handle${this.routeToMethodName(route)}`;
    if (typeof pluginInstance[routeHandler] === 'function') {
      return pluginInstance[routeHandler];
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
