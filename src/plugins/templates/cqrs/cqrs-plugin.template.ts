import { CommandHandler, QueryHandler, EventsHandler, ICommand, IQuery, IEvent } from '@nestjs/cqrs';
import { BasePluginTemplate } from '../base/plugin.template';

export abstract class CQRSPluginTemplate extends BasePluginTemplate {
  protected abstract readonly commands: any[];
  protected abstract readonly queries: any[];
  protected abstract readonly events: any[];

  protected async onInitialize(): Promise<void> {
    this.logger.log(`CQRS plugin ${this.name} initialized with ${this.commands.length} commands, ${this.queries.length} queries, ${this.events.length} events`);
  }

  protected async onDestroy(): Promise<void> {
    this.logger.log(`CQRS plugin ${this.name} destroyed`);
  }

  protected async getHealthChecks() {
    return [
      {
        name: 'cqrs-handlers',
        status: 'pass' as const,
        message: `CQRS handlers registered: ${this.commands.length + this.queries.length + this.events.length}`
      }
    ];
  }

  abstract getCommandHandlers(): any[];
  abstract getQueryHandlers(): any[];
  abstract getEventHandlers(): any[];
}

export abstract class BaseCommand implements ICommand {}
export abstract class BaseQuery implements IQuery {}
export abstract class BaseEvent implements IEvent {}

export function createCommandHandler(command: any) {
  return (target: any) => CommandHandler(command)(target);
}

export function createQueryHandler(query: any) {
  return (target: any) => QueryHandler(query)(target);
}

export function createEventHandler(event: any) {
  return (target: any) => EventsHandler(event)(target);
}