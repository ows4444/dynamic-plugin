import { Module } from '@nestjs/common';
{{#if useDatabase}}
import { TypeOrmModule } from '@nestjs/typeorm';
import { {{pascalCase name}}Entity } from './entities/{{kebabCase name}}.entity';
{{/if}}
{{#if useCache}}
import { CacheModule } from '@nestjs/cache-manager';
{{/if}}
{{#if includeConfig}}
import { ConfigModule } from '@nestjs/config';
import { {{pascalCase name}}ConfigService } from './config/{{kebabCase name}}-config.service';
{{/if}}
import { {{pascalCase name}}Controller } from './{{kebabCase name}}.controller';
import { {{pascalCase name}}Service } from './{{kebabCase name}}.service';
{{#if includeMiddleware}}
import { {{pascalCase name}}Middleware } from './middleware/{{kebabCase name}}.middleware';
{{/if}}
{{#if includeGuards}}
import { {{pascalCase name}}Guard } from './guards/{{kebabCase name}}.guard';
{{/if}}

@Module({
  imports: [
    {{#if useDatabase}}
    TypeOrmModule.forFeature([{{pascalCase name}}Entity]),
    {{/if}}
    {{#if useCache}}
    CacheModule.register({
      ttl: 300, // 5 minutes
      max: 100, // maximum number of items in cache
    }),
    {{/if}}
    {{#if includeConfig}}
    ConfigModule,
    {{/if}}
  ],
  controllers: [{{pascalCase name}}Controller],
  providers: [
    {{pascalCase name}}Service,
    {{#if includeConfig}}
    {{pascalCase name}}ConfigService,
    {{/if}}
    {{#if includeGuards}}
    {{pascalCase name}}Guard,
    {{/if}}
    {{#if includeMiddleware}}
    {{pascalCase name}}Middleware,
    {{/if}}
  ],
  exports: [
    {{pascalCase name}}Service,
    {{#if includeConfig}}
    {{pascalCase name}}ConfigService,
    {{/if}}
  ],
})
export class {{pascalCase name}}Module {
  {{#if includeMiddleware}}
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply({{pascalCase name}}Middleware)
      .forRoutes('{{kebabCase name}}');
  }
  {{/if}}
}

{{#if isPlugin}}
// Plugin-specific exports for dynamic loading
export const PluginModule = {{pascalCase name}}Module;
export const PluginController = {{pascalCase name}}Controller;
export const PluginService = {{pascalCase name}}Service;

// Plugin metadata for the host system
export const PluginMetadata = {
  name: '{{kebabCase name}}',
  version: '{{version}}',
  description: '{{description}}',
  author: '{{author}}',
  apiVersion: '{{apiVersion}}',
  dependencies: {{JSON.stringify dependencies}},
  routes: [
    {
      path: '/{{kebabCase name}}',
      method: 'GET',
      handler: 'findAll',
    },
    {
      path: '/{{kebabCase name}}/:id',
      method: 'GET',
      handler: 'findOne',
    },
    {
      path: '/{{kebabCase name}}',
      method: 'POST',
      handler: 'create',
    },
    {
      path: '/{{kebabCase name}}/:id',
      method: 'PUT',
      handler: 'update',
    },
    {
      path: '/{{kebabCase name}}/:id',
      method: 'DELETE',
      handler: 'remove',
    },
    {{#if includeHealthCheck}}
    {
      path: '/{{kebabCase name}}/health/check',
      method: 'GET',
      handler: 'healthCheck',
    },
    {{/if}}
    {{#if includeMetrics}}
    {
      path: '/{{kebabCase name}}/metrics/stats',
      method: 'GET',
      handler: 'getStats',
    },
    {{/if}}
  ],
  permissions: [
    {{#each permissions}}
    '{{this}}',
    {{/each}}
  ],
  hooks: {
    {{#if includeLifecycleHooks}}
    onLoad: () => console.log('{{pascalCase name}} plugin loaded'),
    onUnload: () => console.log('{{pascalCase name}} plugin unloaded'),
    {{/if}}
  },
};

// Default export for plugin loading
export default {{pascalCase name}}Module;
{{/if}}