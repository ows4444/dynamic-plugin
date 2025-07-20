import { Injectable, Logger } from '@nestjs/common';

/**
 * Message broker service for point-to-point messaging between plugins
 */
@Injectable()
export class MessageBrokerService {
  private readonly logger = new Logger(MessageBrokerService.name);

  /**
   * Send direct message to a specific plugin
   */
  sendMessage(targetPluginId: string, message: BrokerMessage): Promise<void> {
    this.logger.debug(`Sending message to plugin: ${targetPluginId}`);
    // Implementation would go here
    return Promise.resolve();
  }

  /**
   * Register message handler for a plugin
   */
  registerHandler(pluginId: string, handler: MessageHandler): Promise<void> {
    this.logger.debug(`Registering message handler for plugin: ${pluginId}`);
    // Implementation would go here
    return Promise.resolve();
  }
}

export interface BrokerMessage {
  id: string;
  type: string;
  data: any;
  from: string;
  timestamp: Date;
}

export type MessageHandler = (message: BrokerMessage) => Promise<void>;
