export interface IPluginLifecycle {
  onInit?(): Promise<void> | void;
  onStart?(): Promise<void> | void;
  onStop?(): Promise<void> | void;
  onDestroy?(): Promise<void> | void;
  onConfigure?(config: any): Promise<void> | void;
  onHealthCheck?(): Promise<LifecycleHealthCheck> | LifecycleHealthCheck;
  onError?(error: Error): Promise<void> | void;
  onRestart?(): Promise<void> | void;
  onUpdate?(newVersion: string): Promise<void> | void;
  onSuspend?(): Promise<void> | void;
  onResume?(): Promise<void> | void;
}

export interface LifecycleHook {
  name: string;
  phase: LifecyclePhase;
  handler: LifecycleHandler;
  priority?: number;
  timeout?: number;
  retries?: number;
  async?: boolean;
  conditions?: LifecycleCondition[];
  metadata?: Record<string, any>;
}

export type LifecyclePhase = 
  | 'beforeInit'
  | 'afterInit'
  | 'beforeStart'
  | 'afterStart'
  | 'beforeStop'
  | 'afterStop'
  | 'beforeDestroy'
  | 'afterDestroy'
  | 'beforeConfigure'
  | 'afterConfigure'
  | 'beforeUpdate'
  | 'afterUpdate'
  | 'beforeRestart'
  | 'afterRestart'
  | 'beforeSuspend'
  | 'afterSuspend'
  | 'beforeResume'
  | 'afterResume'
  | 'onError'
  | 'onHealthCheck';

export interface LifecycleHandler {
  method: string;
  parameters?: LifecycleParameter[];
  returnType?: string;
  throws?: string[];
}

export interface LifecycleParameter {
  name: string;
  type: string;
  required?: boolean;
  default?: any;
  description?: string;
}

export interface LifecycleCondition {
  type: 'config' | 'environment' | 'state' | 'dependency' | 'custom';
  key: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'exists' | 'not_exists' | 'greater_than' | 'less_than';
  value?: any;
  handler?: string;
}

export interface LifecycleHealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  checks: LifecycleHealthCheckResult[];
  timestamp: Date;
  details?: Record<string, any>;
}

export interface LifecycleHealthCheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message?: string;
  duration?: number;
  details?: Record<string, any>;
}

export interface LifecycleState {
  current: LifecycleStatus;
  previous?: LifecycleStatus;
  history: LifecycleTransition[];
  startedAt?: Date;
  stoppedAt?: Date;
  configuredAt?: Date;
  lastHealthCheck?: Date;
  errorCount: number;
  restartCount: number;
  metadata?: Record<string, any>;
}

export type LifecycleStatus = 
  | 'uninitialized'
  | 'initializing'
  | 'initialized'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'destroying'
  | 'destroyed'
  | 'error'
  | 'suspended'
  | 'resuming'
  | 'configuring'
  | 'updating'
  | 'restarting';

export interface LifecycleTransition {
  from: LifecycleStatus;
  to: LifecycleStatus;
  timestamp: Date;
  duration?: number;
  trigger: string;
  success: boolean;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface LifecycleManager {
  getState(pluginId: string): Promise<LifecycleState>;
  setState(pluginId: string, status: LifecycleStatus): Promise<void>;
  canTransition(pluginId: string, to: LifecycleStatus): Promise<boolean>;
  transition(pluginId: string, to: LifecycleStatus, trigger: string): Promise<LifecycleTransition>;
  executeHooks(pluginId: string, phase: LifecyclePhase, context?: any): Promise<LifecycleHookResult[]>;
  registerHook(pluginId: string, hook: LifecycleHook): Promise<void>;
  unregisterHook(pluginId: string, hookName: string): Promise<boolean>;
  getHooks(pluginId: string, phase?: LifecyclePhase): Promise<LifecycleHook[]>;
  validateTransition(from: LifecycleStatus, to: LifecycleStatus): boolean;
  getValidTransitions(from: LifecycleStatus): LifecycleStatus[];
  reset(pluginId: string): Promise<void>;
}

export interface LifecycleHookResult {
  hookName: string;
  phase: LifecyclePhase;
  success: boolean;
  duration: number;
  result?: any;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface LifecycleEvent {
  id: string;
  pluginId: string;
  type: 'state_change' | 'hook_execution' | 'error' | 'health_check';
  phase?: LifecyclePhase;
  status?: LifecycleStatus;
  timestamp: Date;
  duration?: number;
  success: boolean;
  data?: any;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface LifecycleConfig {
  timeouts: Record<LifecyclePhase, number>;
  retries: Record<LifecyclePhase, number>;
  enableHealthChecks: boolean;
  healthCheckInterval: number;
  enableHooks: boolean;
  enableStateHistory: boolean;
  maxHistoryEntries: number;
  enableMetrics: boolean;
  errorHandling: LifecycleErrorHandling;
}

export interface LifecycleErrorHandling {
  strategy: 'stop' | 'restart' | 'ignore' | 'custom';
  maxRetries: number;
  retryDelay: number;
  escalationThreshold: number;
  customHandler?: string;
}

export interface LifecycleMetrics {
  totalTransitions: number;
  transitionsByStatus: Record<LifecycleStatus, number>;
  averageTransitionDuration: number;
  errorRate: number;
  uptime: number;
  restartCount: number;
  lastTransition?: LifecycleTransition;
  healthCheckStats: LifecycleHealthStats;
}

export interface LifecycleHealthStats {
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  averageDuration: number;
  lastCheck?: LifecycleHealthCheck;
}