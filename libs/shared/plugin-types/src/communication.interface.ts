export interface IPluginCommunication {
  sendMessage<T = unknown>(
    message: PluginMessage<T>,
  ): Promise<PluginMessageResponse<T>>;
  onMessage<T = unknown>(handler: PluginMessageHandler<T>): void;
  offMessage<T = unknown>(handler: PluginMessageHandler<T>): void;
  broadcast<T = unknown>(message: PluginBroadcastMessage<T>): Promise<void>;
  request<TRequest = unknown, TResponse = unknown>(
    request: PluginRequest<TRequest>,
  ): Promise<PluginResponse<TResponse>>;
  subscribe(channel: string, handler: PluginChannelHandler): Promise<void>;
  unsubscribe(channel: string, handler?: PluginChannelHandler): Promise<void>;
  publish(channel: string, data: unknown): Promise<void>;
  createChannel(channel: string, options?: ChannelOptions): Promise<void>;
  destroyChannel(channel: string): Promise<void>;
  getChannels(): Promise<string[]>;
  isConnected(): boolean;
  disconnect(): Promise<void>;
  reconnect(): Promise<void>;
}

export interface PluginMessage<T = unknown> {
  id: string;
  type: MessageType;
  source: string;
  target?: string;
  timestamp: Date;
  data: T;
  headers?: Record<string, string>;
  priority?: MessagePriority;
  ttl?: number;
  replyTo?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface PluginMessageResponse<T = unknown> {
  id: string;
  requestId: string;
  success: boolean;
  data?: T;
  error?: MessageError;
  timestamp: Date;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface PluginBroadcastMessage<T = unknown> {
  id: string;
  type: MessageType;
  source: string;
  targets?: string[];
  excludeTargets?: string[];
  timestamp: Date;
  data: T;
  headers?: Record<string, string>;
  priority?: MessagePriority;
  ttl?: number;
  metadata?: Record<string, unknown>;
}

export interface PluginRequest<T = unknown> {
  id: string;
  method: string;
  target: string;
  data?: T;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  metadata?: Record<string, unknown>;
}

export interface PluginResponse<T = unknown> {
  id: string;
  requestId: string;
  success: boolean;
  data?: T;
  error?: MessageError;
  timestamp: Date;
  duration: number;
  metadata?: Record<string, unknown>;
}

export type MessageType =
  | 'command'
  | 'event'
  | 'request'
  | 'response'
  | 'notification'
  | 'heartbeat'
  | 'error'
  | 'log'
  | 'metric'
  | 'configuration'
  | 'lifecycle'
  | 'custom';

export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';

export interface MessageError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

export type PluginMessageHandler<T = unknown> = (
  message: PluginMessage<T>,
) => Promise<PluginMessageResponse<T>> | PluginMessageResponse<T> | void;

export type PluginChannelHandler = (
  data: unknown,
  metadata?: Record<string, unknown>,
) => Promise<void> | void;

export interface ChannelOptions {
  persistent?: boolean;
  maxMessages?: number;
  messageRetention?: number;
  allowBroadcast?: boolean;
  requireAuth?: boolean;
  permissions?: string[];
  middleware?: string[];
  compression?: boolean;
  encryption?: boolean;
}

export interface ICommunicationManager {
  registerPlugin(
    pluginId: string,
    communication: IPluginCommunication,
  ): Promise<void>;
  unregisterPlugin(pluginId: string): Promise<void>;
  getPluginCommunication(
    pluginId: string,
  ): Promise<IPluginCommunication | null>;
  routeMessage(message: PluginMessage): Promise<PluginMessageResponse>;
  broadcastMessage(message: PluginBroadcastMessage): Promise<BroadcastResult>;
  createBridge(
    pluginId1: string,
    pluginId2: string,
    options?: BridgeOptions,
  ): Promise<PluginBridge>;
  destroyBridge(bridgeId: string): Promise<void>;
  getBridges(pluginId?: string): Promise<PluginBridge[]>;
  getMetrics(pluginId?: string): Promise<CommunicationMetrics>;
  enableLogging(enabled: boolean): void;
  setMessageFilter(filter: MessageFilter): void;
  setRateLimit(pluginId: string, limit: RateLimit): Promise<void>;
}

export interface BroadcastResult {
  messageId: string;
  totalTargets: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  errors: MessageError[];
  duration: number;
}

export interface BridgeOptions {
  bidirectional?: boolean;
  persistent?: boolean;
  compression?: boolean;
  encryption?: boolean;
  middleware?: string[];
  filters?: MessageFilter[];
  rateLimit?: RateLimit;
}

export interface PluginBridge {
  id: string;
  pluginId1: string;
  pluginId2: string;
  options: BridgeOptions;
  createdAt: Date;
  lastActivity?: Date;
  messageCount: number;
  status: 'active' | 'inactive' | 'error';
}

export interface MessageFilter {
  types?: MessageType[];
  sources?: string[];
  targets?: string[];
  priorities?: MessagePriority[];
  headers?: Record<string, string>;
  custom?: (message: PluginMessage) => boolean;
}

export interface RateLimit {
  maxMessages: number;
  windowMs: number;
  burst?: number;
  strategy?: 'sliding' | 'fixed';
}

export interface CommunicationMetrics {
  pluginId?: string;
  totalMessages: number;
  messagesByType: Record<MessageType, number>;
  messagesByPriority: Record<MessagePriority, number>;
  averageResponseTime: number;
  errorRate: number;
  bytesTransferred: number;
  activeChannels: number;
  activeBridges: number;
  lastActivity: Date;
  uptime: number;
}

export interface IMessageBus {
  send<T = unknown>(message: PluginMessage<T>): Promise<PluginMessageResponse<T>>;
  broadcast<T = unknown>(
    message: PluginBroadcastMessage<T>,
  ): Promise<BroadcastResult>;
  subscribe(
    channel: string,
    handler: PluginChannelHandler,
    options?: SubscriptionOptions,
  ): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;
  publish(channel: string, data: unknown, options?: PublishOptions): Promise<void>;
  createChannel(channel: string, options?: ChannelOptions): Promise<void>;
  deleteChannel(channel: string): Promise<void>;
  getChannelInfo(channel: string): Promise<ChannelInfo | null>;
  listChannels(): Promise<string[]>;
  getSubscribers(channel: string): Promise<SubscriberInfo[]>;
  flush(channel?: string): Promise<void>;
  getStats(): Promise<MessageBusStats>;
}

export interface SubscriptionOptions {
  filter?: (data: unknown) => boolean;
  transform?: (data: unknown) => unknown;
  priority?: number;
  once?: boolean;
  metadata?: Record<string, unknown>;
}

export interface PublishOptions {
  persistent?: boolean;
  ttl?: number;
  delay?: number;
  retries?: number;
  metadata?: Record<string, unknown>;
}

export interface ChannelInfo {
  name: string;
  options: ChannelOptions;
  subscriberCount: number;
  messageCount: number;
  lastActivity?: Date;
  createdAt: Date;
  size: number;
}

export interface SubscriberInfo {
  id: string;
  pluginId?: string;
  subscriptionId: string;
  subscribedAt: Date;
  lastActivity?: Date;
  messageCount: number;
  options: SubscriptionOptions;
}

export interface MessageBusStats {
  totalChannels: number;
  totalSubscribers: number;
  totalMessages: number;
  messageRate: number;
  averageChannelSize: number;
  uptime: number;
  memoryUsage: number;
}

export interface IPluginProxy {
  createProxy<T = unknown>(
    targetPluginId: string,
    contract: ProxyContract,
  ): Promise<T>;
  destroyProxy(proxyId: string): Promise<void>;
  getProxies(pluginId?: string): Promise<PluginProxy[]>;
  enableMethodTracing(enabled: boolean): void;
  setMethodTimeout(timeout: number): void;
  setMethodRetries(retries: number): void;
  getProxyMetrics(proxyId: string): Promise<ProxyMetrics>;
}

export interface ProxyContract {
  name: string;
  version: string;
  methods: ProxyMethod[];
  events?: ProxyEvent[];
  properties?: ProxyProperty[];
}

export interface ProxyMethod {
  name: string;
  parameters: ProxyParameter[];
  returnType: string;
  async: boolean;
  description?: string;
  deprecated?: boolean;
  throws?: string[];
}

export interface ProxyParameter {
  name: string;
  type: string;
  required: boolean;
  default?: unknown;
  description?: string;
}

export interface ProxyEvent {
  name: string;
  data: string;
  description?: string;
}

export interface ProxyProperty {
  name: string;
  type: string;
  readonly: boolean;
  description?: string;
}

export interface PluginProxy {
  id: string;
  sourcePluginId: string;
  targetPluginId: string;
  contract: ProxyContract;
  createdAt: Date;
  lastActivity?: Date;
  methodCalls: number;
  status: 'active' | 'inactive' | 'error';
}

export interface ProxyMetrics {
  proxyId: string;
  totalCalls: number;
  callsByMethod: Record<string, number>;
  averageResponseTime: number;
  errorRate: number;
  lastCall?: Date;
  uptime: number;
}
