import { HttpException, HttpStatus } from '@nestjs/common';

export class PluginNotFoundException extends HttpException {
  constructor(pluginId: string) {
    super(`Plugin with ID '${pluginId}' not found`, HttpStatus.NOT_FOUND);
  }
}

export class PluginLoadException extends HttpException {
  constructor(pluginId: string, error: string) {
    super(`Failed to load plugin '${pluginId}': ${error}`, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

export class PluginValidationException extends HttpException {
  constructor(pluginId: string, errors: string[]) {
    super(`Plugin '${pluginId}' validation failed: ${errors.join(', ')}`, HttpStatus.BAD_REQUEST);
  }
}

export class PluginDependencyException extends HttpException {
  constructor(pluginId: string, dependency: string) {
    super(`Plugin '${pluginId}' missing dependency: ${dependency}`, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class PluginSecurityException extends HttpException {
  constructor(pluginId: string, violation: string) {
    super(`Security violation in plugin '${pluginId}': ${violation}`, HttpStatus.FORBIDDEN);
  }
}

export class PluginResourceLimitException extends HttpException {
  constructor(pluginId: string, resource: string, limit: string) {
    super(`Plugin '${pluginId}' exceeded ${resource} limit: ${limit}`, HttpStatus.TOO_MANY_REQUESTS);
  }
}

export class PluginExecutionException extends HttpException {
  constructor(pluginId: string, error: string) {
    super(`Plugin '${pluginId}' execution failed: ${error}`, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

export class PluginConflictException extends HttpException {
  constructor(pluginId: string, conflict: string) {
    super(`Plugin '${pluginId}' conflict: ${conflict}`, HttpStatus.CONFLICT);
  }
}

export class PluginUpdateException extends HttpException {
  constructor(pluginId: string, error: string) {
    super(`Failed to update plugin '${pluginId}': ${error}`, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

export class PluginHealthException extends HttpException {
  constructor(pluginId: string, healthStatus: string) {
    super(`Plugin '${pluginId}' health check failed: ${healthStatus}`, HttpStatus.SERVICE_UNAVAILABLE);
  }
}