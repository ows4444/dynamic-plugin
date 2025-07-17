import { BasePluginTemplate } from '../base/plugin.template';

export abstract class MessagingPluginTemplate extends BasePluginTemplate {
  protected abstract readonly messageHandlers: Map<string, Function>;
  protected abstract readonly subscriptions: string[];

  protected async onInitialize(): Promise<void> {
    this.logger.log(`Messaging plugin ${this.name} initialized with ${this.subscriptions.length} subscriptions`);
    await this.subscribeToMessages();
  }

  protected async onDestroy(): Promise<void> {
    await this.unsubscribeFromMessages();
    this.logger.log(`Messaging plugin ${this.name} destroyed`);
  }

  protected async getHealthChecks() {
    return [
      {
        name: 'message-handlers',
        status: 'pass' as const,
        message: `${this.messageHandlers.size} message handlers active`
      },
      {
        name: 'subscriptions',
        status: 'pass' as const,
        message: `${this.subscriptions.length} message subscriptions active`
      }
    ];
  }

  protected abstract subscribeToMessages(): Promise<void>;
  protected abstract unsubscribeFromMessages(): Promise<void>;
  abstract handleMessage(topic: string, message: any): Promise<void>;
}