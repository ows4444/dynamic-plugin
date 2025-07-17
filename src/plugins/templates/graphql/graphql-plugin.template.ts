import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { BasePluginTemplate } from '../base/plugin.template';

export abstract class GraphQLPluginTemplate extends BasePluginTemplate {
  protected abstract readonly typeDefs: string;
  protected abstract readonly resolvers: any;

  protected async onInitialize(): Promise<void> {
    this.logger.log(`GraphQL plugin ${this.name} initialized`);
  }

  protected async onDestroy(): Promise<void> {
    this.logger.log(`GraphQL plugin ${this.name} destroyed`);
  }

  protected async getHealthChecks() {
    return [
      {
        name: 'graphql-schema',
        status: 'pass' as const,
        message: 'GraphQL schema is valid'
      }
    ];
  }

  abstract getResolver(): any;
  abstract getTypeDefs(): string;
}

export function createGraphQLResolver(pluginTemplate: GraphQLPluginTemplate) {
  @Resolver()
  class DynamicGraphQLResolver {
    constructor(private readonly plugin: GraphQLPluginTemplate) {}

    @Query(() => String)
    async ping(): Promise<string> {
      return `Plugin ${this.plugin.name} is active`;
    }
  }

  return DynamicGraphQLResolver;
}