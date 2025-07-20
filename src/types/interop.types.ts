/**
 * Interop Types - Plugin communication and interoperability types
 */

import type { NetworkProtocol } from './common.types';

// Message and Communication Types
export enum MessageType {
  REQUEST = 'request',
  RESPONSE = 'response',
  EVENT = 'event',
  BROADCAST = 'broadcast',
  NOTIFICATION = 'notification',
}

export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum DeliveryMode {
  FIRE_AND_FORGET = 'fire_and_forget',
  AT_LEAST_ONCE = 'at_least_once',
  EXACTLY_ONCE = 'exactly_once',
  REQUEST_RESPONSE = 'request_response',
}

// MessageMetadata for interop messages
export interface MessageMetadata {
  messageId?: string;
  correlationId?: string;
  causationId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  retryCount?: number;
  maxRetries?: number;
  ttl?: number;
  encrypted?: boolean;
  compressed?: boolean;
  schema?: string;
  contentType?: string;
  encoding?: string;
  replyTo?: string;
  priority?: MessagePriority;
  deliveryMode?: DeliveryMode;
  timestamp?: Date;
  expiresAt?: Date;
  headers?: Record<string, string>;
}

export interface Message {
  id: string;
  type: MessageType;
  source: string;
  target?: string;
  topic?: string;
  data: unknown;
  metadata?: MessageMetadata;
  timestamp: Date;
  expiresAt?: Date;
}

export interface MessageFilter {
  source?: string | string[];
  target?: string | string[];
  type?: MessageType | MessageType[];
  topic?: string | string[];
  priority?: MessagePriority | MessagePriority[];
  metadata?: MessageMetadata;
}

// Event Types
export interface PluginEvent extends Message {
  type: MessageType.EVENT;
  eventType: string;
  payload: unknown;
}

export interface InteropSystemEvent extends PluginEvent {
  eventType: 'system.startup' | 'system.shutdown' | 'system.error' | 'system.warning';
}

export interface InteropLifecycleEvent extends PluginEvent {
  eventType: 'plugin.installed' | 'plugin.loaded' | 'plugin.started' | 'plugin.stopped' | 'plugin.unloaded' | 'plugin.uninstalled';
  pluginId: string;
}

export interface InteropCustomEvent extends PluginEvent {
  eventType: string;
  namespace?: string;
}

// Subscription and Handler Types
export interface Subscription {
  id: string;
  subscriberId: string;
  pattern: string | MessageFilter;
  handler: MessageHandler;
  options: SubscriptionOptions;
  createdAt: Date;
  lastActivity?: Date;
  messageCount: number;
}

export interface SubscriptionOptions {
  durable?: boolean;
  exclusive?: boolean;
  autoAck?: boolean;
  prefetch?: number;
  priority?: number;
  deadLetterTopic?: string;
  retryPolicy?: RetryPolicy;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffType: 'fixed' | 'exponential' | 'linear';
  initialDelay: number;
  maxDelay: number;
  multiplier?: number;
}

export type MessageHandler = (message: Message) => Promise<MessageHandlerResult>;

export interface MessageHandlerResult {
  success: boolean;
  result?: unknown;
  error?: Error;
  ack?: boolean;
  requeue?: boolean;
  metadata?: MessageMetadata;
}

// RPC and Method Call Types
export interface RpcRequest extends Message {
  type: MessageType.REQUEST;
  method: string;
  params: unknown[];
  timeout?: number;
}

export interface RpcResponse extends Message {
  type: MessageType.RESPONSE;
  success: boolean;
  result?: unknown;
  error?: RpcError;
}

export interface RpcError {
  code: string;
  message: string;
  data?: unknown;
  stack?: string;
}

export interface RpcCall {
  id: string;
  request: RpcRequest;
  response?: RpcResponse;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'pending' | 'completed' | 'failed' | 'timeout';
}

// Channel and Topic Types
export interface Channel {
  id: string;
  name: string;
  type: 'point_to_point' | 'publish_subscribe' | 'request_response';
  persistent: boolean;
  encrypted: boolean;
  maxSize?: number;
  ttl?: number;
  subscribers: string[];
  publishers: string[];
  messageCount: number;
  createdAt: Date;
  lastActivity?: Date;
}

export interface Topic {
  id: string;
  name: string;
  pattern: string;
  description?: string;
  retentionPolicy?: RetentionPolicy;
  compressionType?: CompressionType;
  partitions?: number;
  replicationFactor?: number;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RetentionPolicy {
  type: 'time' | 'size' | 'count';
  value: number;
  unit?: 'ms' | 's' | 'm' | 'h' | 'd' | 'bytes' | 'kb' | 'mb' | 'gb';
}

export enum CompressionType {
  NONE = 'none',
  GZIP = 'gzip',
  LZ4 = 'lz4',
  SNAPPY = 'snappy',
  ZSTD = 'zstd',
}

// Protocol and Transport Types
export enum TransportType {
  MEMORY = 'memory',
  TCP = 'tcp',
  HTTP = 'http',
  WEBSOCKET = 'websocket',
  GRPC = 'grpc',
  REDIS = 'redis',
  NATS = 'nats',
  KAFKA = 'kafka',
  RABBITMQ = 'rabbitmq',
}

export interface TransportConfig {
  type: TransportType;
  host?: string;
  port?: number;
  path?: string;
  protocol?: NetworkProtocol;
  options: Record<string, unknown>;
  security?: TransportSecurity;
}

export interface TransportSecurity {
  enabled: boolean;
  tls?: boolean;
  cert?: string;
  key?: string;
  ca?: string;
  verifyPeer?: boolean;
  allowInsecure?: boolean;
}

export interface ProtocolAdapter {
  id: string;
  name: string;
  type: TransportType;
  config: TransportConfig;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  metrics: ProtocolMetrics;
}

export interface ProtocolMetrics {
  messagesSent: number;
  messagesReceived: number;
  bytesTransferred: number;
  connections: number;
  errors: number;
  latency: LatencyMetrics;
  uptime: number;
}

export interface LatencyMetrics {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

// Serialization Types
export enum SerializationType {
  JSON = 'json',
  PROTOBUF = 'protobuf',
  AVRO = 'avro',
  MSGPACK = 'msgpack',
  CBOR = 'cbor',
  BINARY = 'binary',
}

export interface Serializer {
  type: SerializationType;
  serialize(data: unknown): Buffer;
  deserialize<T>(data: Buffer): T;
  validate?(data: unknown): boolean;
}

// Resource Sharing Types
export interface SharedResource {
  id: string;
  name: string;
  type: string;
  owner: string;
  data: unknown;
  permissions: ResourcePermissions;
  metadata?: MessageMetadata;
  ttl?: number;
  createdAt: Date;
  lastAccessed?: Date;
  accessCount: number;
}

export interface ResourcePermissions {
  read: string[];
  write: string[];
  delete: string[];
  share: string[];
}

export interface ResourceAccess {
  resourceId: string;
  accessor: string;
  action: 'read' | 'write' | 'delete' | 'share';
  timestamp: Date;
  success: boolean;
  error?: string;
}

export interface ResourceLease {
  id: string;
  resourceId: string;
  holder: string;
  type: 'read' | 'write' | 'exclusive';
  expiresAt: Date;
  renewable: boolean;
  metadata?: MessageMetadata;
}

// Plugin Interop Service Interface
export interface PluginInterop {
  // Messaging
  sendMessage(target: string, message: unknown, options?: MessageOptions): Promise<void>;
  broadcastEvent(event: PluginEvent, options?: BroadcastOptions): Promise<void>;
  subscribeToEvents(pattern: string | MessageFilter, handler: MessageHandler, options?: SubscriptionOptions): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;

  // RPC
  callMethod(target: string, method: string, params: unknown[], options?: RpcOptions): Promise<unknown>;
  registerMethod(method: string, handler: RpcMethodHandler): Promise<void>;
  unregisterMethod(method: string): Promise<void>;

  // Resource Sharing
  shareResource(resource: SharedResource): Promise<void>;
  getSharedResource(resourceId: string): Promise<SharedResource | null>;
  removeSharedResource(resourceId: string): Promise<void>;
  listSharedResources(filter?: ResourceFilter): Promise<SharedResource[]>;

  // Channel Management
  createChannel(name: string, options: ChannelOptions): Promise<Channel>;
  deleteChannel(channelId: string): Promise<void>;
  joinChannel(channelId: string): Promise<void>;
  leaveChannel(channelId: string): Promise<void>;
}

export interface MessageOptions {
  priority?: MessagePriority;
  ttl?: number;
  deliveryMode?: DeliveryMode;
  metadata?: MessageMetadata;
}

export interface BroadcastOptions {
  target?: string | string[];
  excludeSender?: boolean;
  persistent?: boolean;
  metadata?: MessageMetadata;
}

export interface RpcOptions {
  timeout?: number;
  retries?: number;
  metadata?: MessageMetadata;
}

export interface ChannelOptions {
  type?: 'point_to_point' | 'publish_subscribe';
  persistent?: boolean;
  encrypted?: boolean;
  maxSize?: number;
  ttl?: number;
}

export interface ResourceFilter {
  type?: string;
  owner?: string;
  permissions?: Partial<ResourcePermissions>;
  metadata?: MessageMetadata;
}

export type RpcMethodHandler = (params: unknown[], metadata?: MessageMetadata) => Promise<unknown>;

// Communication Patterns
export interface RequestResponsePattern {
  request: Message;
  response?: Message;
  timeout: number;
  correlationId: string;
}

export interface PublishSubscribePattern {
  topic: string;
  message: Message;
  subscribers: string[];
}

export interface EventSourcingPattern {
  streamId: string;
  events: PluginEvent[];
  version: number;
  metadata?: MessageMetadata;
}

// Plugin Event Bus Interface (for plugin communication)
export interface PluginEventBus {
  publish(event: PluginEvent): Promise<void>;
  subscribe(pattern: string, handler: MessageHandler, options?: SubscriptionOptions): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;
  listSubscriptions(subscriberId?: string): Promise<Subscription[]>;
  getMetrics(): Promise<EventBusMetrics>;
}

export interface EventBusMetrics {
  totalEvents: number;
  totalSubscriptions: number;
  eventRate: number;
  averageLatency: number;
  errorRate: number;
  topicMetrics: Record<string, TopicMetrics>;
}

export interface TopicMetrics {
  messageCount: number;
  subscriberCount: number;
  publishRate: number;
  size: number;
}

// Type Guards
export function isMessage(obj: unknown): obj is Message {
  return typeof obj === 'object' && obj !== null && 'id' in obj && 'type' in obj;
}

export function isPluginEvent(obj: unknown): obj is PluginEvent {
  return isMessage(obj) && obj.type === MessageType.EVENT;
}

export function isRpcRequest(obj: unknown): obj is RpcRequest {
  return isMessage(obj) && obj.type === MessageType.REQUEST && 'method' in obj;
}

export function isRpcResponse(obj: unknown): obj is RpcResponse {
  return isMessage(obj) && obj.type === MessageType.RESPONSE && 'success' in obj;
}
