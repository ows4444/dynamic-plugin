import type {
  ConfigSchema,
  ConfigValidationResult,
  ConfigValue,
  PluginConfig,
} from './config.interface';
import type { IManifest } from './manifest.interface';
import type {
  HttpResponse,
  PluginEvent,
  PluginHealthCheck,
  PluginMetrics,
  PluginRoute,
  RequestConfig,
} from './plugin.interface';
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isConfigValue(value: unknown): value is ConfigValue {
  if (value === null || value === undefined) {
    return true;
  }
  
  if (isString(value) || isNumber(value) || isBoolean(value)) {
    return true;
  }
  
  if (isArray(value)) {
    return value.every(isConfigValue);
  }
  
  if (isObject(value)) {
    return Object.values(value).every(isConfigValue);
  }
  
  return false;
}

export function isPluginConfig(obj: unknown): obj is PluginConfig {
  if (!isObject(obj)) {
    return false;
  }
  
  return Object.values(obj).every(isConfigValue);
}

export function isConfigSchema(obj: unknown): obj is ConfigSchema {
  if (!isObject(obj)) {
    return false;
  }
  
  const schema = obj;
  
  if (!isString(schema['type']) || !['string', 'number', 'boolean', 'object', 'array'].includes(schema['type'])) {
    return false;
  }
  
  if (schema['required'] !== undefined && !isBoolean(schema['required'])) {
    return false;
  }
  
  if (schema['default'] !== undefined && !isConfigValue(schema['default'])) {
    return false;
  }
  
  if (schema['enum'] !== undefined && (!isArray(schema['enum']) || !schema['enum'].every(isConfigValue))) {
    return false;
  }
  
  if (schema['minimum'] !== undefined && !isNumber(schema['minimum'])) {
    return false;
  }
  
  if (schema['maximum'] !== undefined && !isNumber(schema['maximum'])) {
    return false;
  }
  
  if (schema['minLength'] !== undefined && !isNumber(schema['minLength'])) {
    return false;
  }
  
  if (schema['maxLength'] !== undefined && !isNumber(schema['maxLength'])) {
    return false;
  }
  
  if (schema['pattern'] !== undefined && !isString(schema['pattern'])) {
    return false;
  }
  
  if (schema['properties'] !== undefined) {
    if (!isObject(schema['properties'])) {
      return false;
    }
    if (!Object.values(schema['properties']).every(isConfigSchema)) {
      return false;
    }
  }
  
  if (schema['items'] !== undefined && !isConfigSchema(schema['items'])) {
    return false;
  }
  
  if (schema['description'] !== undefined && !isString(schema['description'])) {
    return false;
  }
  
  return true;
}

export function isPluginRoute(obj: unknown): obj is PluginRoute {
  if (!isObject(obj)) {
    return false;
  }
  
  const route = obj;
  
  if (!isString(route['method']) || 
      !['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(route['method'])) {
    return false;
  }
  
  if (!isString(route['path'])) {
    return false;
  }
  
  if (!isString(route['handler'])) {
    return false;
  }
  
  if (route['middleware'] !== undefined && 
      (!isArray(route['middleware']) || !route['middleware'].every(isString))) {
    return false;
  }
  
  if (route['guards'] !== undefined && 
      (!isArray(route['guards']) || !route['guards'].every(isString))) {
    return false;
  }
  
  if (route['description'] !== undefined && !isString(route['description'])) {
    return false;
  }
  
  if (route['tags'] !== undefined && 
      (!isArray(route['tags']) || !route['tags'].every(isString))) {
    return false;
  }
  
  return true;
}

export function isPluginHealthCheck(obj: unknown): obj is PluginHealthCheck {
  if (!isObject(obj)) {
    return false;
  }
  
  const health = obj;
  
  if (!isString(health['status'])) {
    return false;
  }
  
  if (!(health['timestamp'] instanceof Date)) {
    return false;
  }
  
  if (!isNumber(health['uptime'])) {
    return false;
  }
  
  if (!isArray(health['checks'])) {
    return false;
  }
  
  // Validate each health check result
  for (const check of health['checks']) {
    if (!isObject(check)) {
      return false;
    }
    
    const checkObj = check;
    
    if (!isString(checkObj['name'])) {
      return false;
    }
    
    if (!isString(checkObj['status']) || 
        !['pass', 'fail', 'warn'].includes(checkObj['status'])) {
      return false;
    }
    
    if (checkObj['message'] !== undefined && !isString(checkObj['message'])) {
      return false;
    }
    
    if (checkObj['duration'] !== undefined && !isNumber(checkObj['duration'])) {
      return false;
    }
  }
  
  return true;
}

export function isPluginMetrics(obj: unknown): obj is PluginMetrics {
  if (!isObject(obj)) {
    return false;
  }
  
  const metrics = obj;
  
  const requiredNumbers = [
    'requestCount', 'errorCount', 'averageResponseTime', 
    'uptime', 'memoryUsage', 'cpuUsage'
  ];
  
  for (const field of requiredNumbers) {
    if (!isNumber(metrics[field])) {
      return false;
    }
  }
  
  if (!(metrics['lastActivity'] instanceof Date)) {
    return false;
  }
  
  if (metrics['customMetrics'] !== undefined) {
    if (!isObject(metrics['customMetrics'])) {
      return false;
    }
    
    if (!Object.values(metrics['customMetrics']).every(isNumber)) {
      return false;
    }
  }
  
  return true;
}

export function isPluginEvent(obj: unknown): obj is PluginEvent {
  if (!isObject(obj)) {
    return false;
  }
  
  const event = obj;
  
  if (!isString(event['id']) || !isString(event['type']) || !isString(event['source'])) {
    return false;
  }
  
  if (!(event['timestamp'] instanceof Date)) {
    return false;
  }
  
  if (!isObject(event['data'])) {
    return false;
  }
  
  if (event['pluginId'] !== undefined && !isString(event['pluginId'])) {
    return false;
  }
  
  if (event['correlationId'] !== undefined && !isString(event['correlationId'])) {
    return false;
  }
  
  return true;
}

export function isRequestConfig(obj: unknown): obj is RequestConfig {
  if (!isObject(obj)) {
    return false;
  }
  
  const config = obj;
  
  if (config['headers'] !== undefined) {
    if (!isObject(config['headers'])) {
      return false;
    }
    if (!Object.values(config['headers']).every(isString)) {
      return false;
    }
  }
  
  if (config['timeout'] !== undefined && !isNumber(config['timeout'])) {
    return false;
  }
  
  if (config['params'] !== undefined && !isObject(config['params'])) {
    return false;
  }
  
  if (config['auth'] !== undefined) {
    if (!isObject(config['auth'])) {
      return false;
    }
    const auth = config['auth'];
    if (!isString(auth['username']) || !isString(auth['password'])) {
      return false;
    }
  }
  
  if (config['retry'] !== undefined && !isNumber(config['retry'])) {
    return false;
  }
  
  return true;
}

export function isHttpResponse<T = unknown>(obj: unknown): obj is HttpResponse<T> {
  if (!isObject(obj)) {
    return false;
  }
  
  const response = obj;
  
  if (!isNumber(response['status']) || !isString(response['statusText'])) {
    return false;
  }
  
  if (!isObject(response['headers'])) {
    return false;
  }
  
  if (!Object.values(response['headers']).every(isString)) {
    return false;
  }
  
  if (!isRequestConfig(response['config'])) {
    return false;
  }
  
  return true;
}

export function isPluginManifest(obj: unknown): obj is IManifest {
  if (!isObject(obj)) {
    return false;
  }
  
  const manifest = obj;
  
  const requiredStringFields = ['name', 'version', 'description'];
  for (const field of requiredStringFields) {
    if (!isString(manifest[field])) {
      return false;
    }
  }
  
  if (!isValidSemVer(manifest['version'] as string)) {
    return false;
  }
  
  if (manifest['author'] !== undefined && !isString(manifest['author']) && !isObject(manifest['author'])) {
    return false;
  }
  
  if (manifest['license'] !== undefined && !isString(manifest['license'])) {
    return false;
  }
  
  if (manifest['keywords'] !== undefined && 
      (!isArray(manifest['keywords']) || !manifest['keywords'].every(isString))) {
    return false;
  }
  
  if (manifest['homepage'] !== undefined && !isString(manifest['homepage'])) {
    return false;
  }
  
  return true;
}

function isValidSemVer(version: string): boolean {
  const semVerPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
  return semVerPattern.test(version);
}

type ValidationErrorCode = 'MISSING_REQUIRED' | 'INVALID_TYPE' | 'INVALID_VALUE' | 'INVALID_FORMAT';

export function validateConfigWithSchema(config: unknown, schema: ConfigSchema): ConfigValidationResult {
  const errors: { field: string; message: string; code: ValidationErrorCode }[] = [];
  
  function validateValue(value: unknown, fieldSchema: ConfigSchema, fieldPath: string): void {
    // Check required fields
    if ((fieldSchema.required ?? false) && (value === undefined || value === null)) {
      errors.push({
        field: fieldPath,
        message: `Field '${fieldPath}' is required`,
        code: 'MISSING_REQUIRED'
      });
      return;
    }
    
    if (value === undefined || value === null) {
      return;
    }
    
    switch (fieldSchema.type) {
      case 'string':
        if (!isString(value)) {
          errors.push({
            field: fieldPath,
            message: `Field '${fieldPath}' must be a string`,
            code: 'INVALID_TYPE'
          });
        }
        break;
      case 'number':
        if (!isNumber(value)) {
          errors.push({
            field: fieldPath,
            message: `Field '${fieldPath}' must be a number`,
            code: 'INVALID_TYPE'
          });
        }
        break;
      case 'boolean':
        if (!isBoolean(value)) {
          errors.push({
            field: fieldPath,
            message: `Field '${fieldPath}' must be a boolean`,
            code: 'INVALID_TYPE'
          });
        }
        break;
      case 'object':
        if (!isObject(value)) {
          errors.push({
            field: fieldPath,
            message: `Field '${fieldPath}' must be an object`,
            code: 'INVALID_TYPE'
          });
        } else if (fieldSchema.properties) {
          const objValue = value;
          for (const [propName, propSchema] of Object.entries(fieldSchema.properties)) {
            validateValue(objValue[propName], propSchema, `${fieldPath}.${propName}`);
          }
        }
        break;
      case 'array':
        if (!isArray(value)) {
          errors.push({
            field: fieldPath,
            message: `Field '${fieldPath}' must be an array`,
            code: 'INVALID_TYPE'
          });
        } else if (fieldSchema.items) {
          value.forEach((item, index) => {
            validateValue(item, fieldSchema.items!, `${fieldPath}[${index}]`);
          });
        }
        break;
    }
  }
  
  validateValue(config, schema, 'root');
  
  return {
    valid: errors.length === 0,
    errors: errors.map(error => ({
      field: error.field,
      message: error.message,
      code: error.code as 'MISSING_REQUIRED' | 'INVALID_TYPE' | 'INVALID_VALUE' | 'INVALID_FORMAT'
    }))
  };
}

export function assertType<T>(
  value: unknown,
  guard: (value: unknown) => value is T,
  errorMessage: string
): asserts value is T {
  if (!guard(value)) {
    throw new TypeError(errorMessage);
  }
}