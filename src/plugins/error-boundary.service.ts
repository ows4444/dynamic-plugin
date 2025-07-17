import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PluginManagerService } from './plugin-manager.service';
import { PluginEventType } from '../common/interfaces/plugin.interface';

export interface ErrorContext {
  pluginId: string;
  operation: string;
  timestamp: Date;
  stackTrace?: string;
  metadata?: any;
}

export interface ErrorBoundary {
  id: string;
  pluginId: string;
  errorTypes: string[];
  handler: (error: Error, context: ErrorContext) => Promise<ErrorRecoveryAction>;
  enabled: boolean;
  priority: number;
}

export interface ErrorRecoveryAction {
  action: 'retry' | 'rollback' | 'isolate' | 'restart' | 'ignore';
  delay?: number;
  maxAttempts?: number;
  rollbackPoint?: string;
  metadata?: any;
}

export interface ErrorIncident {
  id: string;
  pluginId: string;
  error: Error;
  context: ErrorContext;
  recoveryAction: ErrorRecoveryAction;
  attempts: number;
  resolved: boolean;
  timestamp: Date;
  resolvedAt?: Date;
}

export interface RollbackPoint {
  id: string;
  pluginId: string;
  timestamp: Date;
  state: any;
  version: string;
  metadata?: any;
}

export interface CircuitBreakerState {
  pluginId: string;
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: Date;
  nextAttemptTime: Date;
  successCount: number;
}

@Injectable()
export class ErrorBoundaryService {
  private readonly logger = new Logger(ErrorBoundaryService.name);
  private readonly errorBoundaries = new Map<string, ErrorBoundary>();
  private readonly incidents = new Map<string, ErrorIncident>();
  private readonly rollbackPoints = new Map<string, RollbackPoint[]>();
  private readonly circuitBreakers = new Map<string, CircuitBreakerState>();
  private readonly retryAttempts = new Map<string, number>();

  constructor(
    @Inject(forwardRef(() => PluginManagerService))
    private readonly pluginManager: PluginManagerService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  registerErrorBoundary(boundary: ErrorBoundary): void {
    this.errorBoundaries.set(boundary.id, boundary);
    this.logger.log(`Registered error boundary: ${boundary.id} for plugin ${boundary.pluginId}`);
  }

  unregisterErrorBoundary(boundaryId: string): void {
    this.errorBoundaries.delete(boundaryId);
    this.logger.log(`Unregistered error boundary: ${boundaryId}`);
  }

  async handleError(error: Error, context: ErrorContext): Promise<ErrorRecoveryAction> {
    const incidentId = `${context.pluginId}-${Date.now()}`;
    
    this.logger.error(`Error in plugin ${context.pluginId} during ${context.operation}:`, error);

    // Check circuit breaker
    const circuitState = this.getCircuitBreakerState(context.pluginId);
    if (circuitState.state === 'open') {
      this.logger.warn(`Circuit breaker open for plugin ${context.pluginId}`);
      return { action: 'ignore', metadata: { reason: 'circuit_breaker_open' } };
    }

    // Find applicable error boundaries
    const boundaries = this.findApplicableBoundaries(context.pluginId, error);
    
    let recoveryAction: ErrorRecoveryAction = { action: 'restart' }; // Default action

    // Try boundaries in priority order
    for (const boundary of boundaries) {
      try {
        recoveryAction = await boundary.handler(error, context);
        break;
      } catch (boundaryError) {
        this.logger.error(`Error boundary ${boundary.id} failed:`, boundaryError);
      }
    }

    // Create incident
    const incident: ErrorIncident = {
      id: incidentId,
      pluginId: context.pluginId,
      error,
      context,
      recoveryAction,
      attempts: 0,
      resolved: false,
      timestamp: new Date()
    };

    this.incidents.set(incidentId, incident);

    // Update circuit breaker
    this.updateCircuitBreaker(context.pluginId, false);

    // Execute recovery action
    await this.executeRecoveryAction(incident);

    return recoveryAction;
  }

  async createRollbackPoint(pluginId: string, metadata?: any): Promise<string> {
    const rollbackId = `${pluginId}-${Date.now()}`;
    
    try {
      const plugin = this.pluginManager.getPlugin(pluginId);
      if (!plugin) {
        throw new Error(`Plugin not found: ${pluginId}`);
      }

      const state = plugin.getState ? await plugin.getState() : null;
      const pluginMetadata = this.pluginManager.getPluginMetadata(pluginId);

      const rollbackPoint: RollbackPoint = {
        id: rollbackId,
        pluginId,
        timestamp: new Date(),
        state,
        version: pluginMetadata?.version || '1.0.0',
        metadata
      };

      if (!this.rollbackPoints.has(pluginId)) {
        this.rollbackPoints.set(pluginId, []);
      }

      const points = this.rollbackPoints.get(pluginId);
      points.push(rollbackPoint);

      // Keep only last 10 rollback points
      if (points.length > 10) {
        points.shift();
      }

      this.logger.log(`Created rollback point ${rollbackId} for plugin ${pluginId}`);
      return rollbackId;
    } catch (error) {
      this.logger.error(`Failed to create rollback point for plugin ${pluginId}:`, error);
      throw error;
    }
  }

  async rollbackToPoint(pluginId: string, rollbackId?: string): Promise<void> {
    const points = this.rollbackPoints.get(pluginId);
    if (!points || points.length === 0) {
      throw new Error(`No rollback points found for plugin ${pluginId}`);
    }

    let targetPoint: RollbackPoint;
    
    if (rollbackId) {
      targetPoint = points.find(p => p.id === rollbackId);
      if (!targetPoint) {
        throw new Error(`Rollback point ${rollbackId} not found`);
      }
    } else {
      // Use the most recent rollback point
      targetPoint = points[points.length - 1];
    }

    try {
      this.logger.log(`Rolling back plugin ${pluginId} to point ${targetPoint.id}`);

      // Stop the plugin
      await this.pluginManager.unloadPlugin(pluginId);

      // Restore state
      if (targetPoint.state) {
        // Load the plugin
        await this.pluginManager.loadPlugin(pluginId);
        
        const plugin = this.pluginManager.getPlugin(pluginId);
        if (plugin && plugin.setState) {
          await plugin.setState(targetPoint.state);
        }
      }

      this.logger.log(`Successfully rolled back plugin ${pluginId}`);
    } catch (error) {
      this.logger.error(`Failed to rollback plugin ${pluginId}:`, error);
      throw error;
    }
  }

  async isolatePlugin(pluginId: string): Promise<void> {
    this.logger.log(`Isolating plugin ${pluginId}`);

    try {
      // Disable the plugin
      await this.pluginManager.disablePlugin(pluginId);

      // Open circuit breaker
      const circuitState = this.getCircuitBreakerState(pluginId);
      circuitState.state = 'open';
      circuitState.nextAttemptTime = new Date(Date.now() + 60000); // 1 minute

      // Emit isolation event
      this.eventEmitter.emit('plugin.isolated', {
        type: PluginEventType.STOPPED,
        pluginId,
        timestamp: new Date(),
        data: { reason: 'error_isolation' }
      });

      this.logger.log(`Plugin ${pluginId} isolated successfully`);
    } catch (error) {
      this.logger.error(`Failed to isolate plugin ${pluginId}:`, error);
      throw error;
    }
  }

  async restartPlugin(pluginId: string): Promise<void> {
    this.logger.log(`Restarting plugin ${pluginId}`);

    try {
      // Create rollback point before restart
      await this.createRollbackPoint(pluginId, { reason: 'restart' });

      // Restart the plugin
      await this.pluginManager.reloadPlugin(pluginId);

      // Reset circuit breaker on successful restart
      this.updateCircuitBreaker(pluginId, true);

      this.logger.log(`Plugin ${pluginId} restarted successfully`);
    } catch (error) {
      this.logger.error(`Failed to restart plugin ${pluginId}:`, error);
      
      // Try rollback if restart fails
      try {
        await this.rollbackToPoint(pluginId);
      } catch (rollbackError) {
        this.logger.error(`Rollback also failed for plugin ${pluginId}:`, rollbackError);
        await this.isolatePlugin(pluginId);
      }
    }
  }

  getIncidents(pluginId?: string): ErrorIncident[] {
    const incidents = Array.from(this.incidents.values());
    
    if (pluginId) {
      return incidents.filter(incident => incident.pluginId === pluginId);
    }
    
    return incidents;
  }

  getCircuitBreakerState(pluginId: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(pluginId)) {
      this.circuitBreakers.set(pluginId, {
        pluginId,
        state: 'closed',
        failureCount: 0,
        lastFailureTime: new Date(),
        nextAttemptTime: new Date(),
        successCount: 0
      });
    }
    
    return this.circuitBreakers.get(pluginId);
  }

  getRollbackPoints(pluginId: string): RollbackPoint[] {
    return this.rollbackPoints.get(pluginId) || [];
  }

  private findApplicableBoundaries(pluginId: string, error: Error): ErrorBoundary[] {
    const boundaries = Array.from(this.errorBoundaries.values())
      .filter(boundary => 
        boundary.enabled && 
        boundary.pluginId === pluginId &&
        (boundary.errorTypes.length === 0 || boundary.errorTypes.includes(error.constructor.name))
      )
      .sort((a, b) => b.priority - a.priority);

    return boundaries;
  }

  private async executeRecoveryAction(incident: ErrorIncident): Promise<void> {
    const { pluginId, recoveryAction } = incident;
    
    switch (recoveryAction.action) {
      case 'retry':
        await this.executeRetry(incident);
        break;
      
      case 'rollback':
        await this.rollbackToPoint(pluginId, recoveryAction.rollbackPoint);
        incident.resolved = true;
        incident.resolvedAt = new Date();
        break;
      
      case 'isolate':
        await this.isolatePlugin(pluginId);
        incident.resolved = true;
        incident.resolvedAt = new Date();
        break;
      
      case 'restart':
        await this.restartPlugin(pluginId);
        incident.resolved = true;
        incident.resolvedAt = new Date();
        break;
      
      case 'ignore':
        this.logger.log(`Ignoring error for plugin ${pluginId}`);
        incident.resolved = true;
        incident.resolvedAt = new Date();
        break;
    }
  }

  private async executeRetry(incident: ErrorIncident): Promise<void> {
    const { pluginId, recoveryAction } = incident;
    const maxAttempts = recoveryAction.maxAttempts || 3;
    const delay = recoveryAction.delay || 1000;

    incident.attempts++;

    if (incident.attempts >= maxAttempts) {
      this.logger.warn(`Max retry attempts reached for plugin ${pluginId}`);
      
      // Fallback to restart
      await this.restartPlugin(pluginId);
      incident.resolved = true;
      incident.resolvedAt = new Date();
      return;
    }

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      // Retry the operation
      await this.retryOperation(incident);
      
      incident.resolved = true;
      incident.resolvedAt = new Date();
      
      // Reset circuit breaker on success
      this.updateCircuitBreaker(pluginId, true);
      
      this.logger.log(`Retry successful for plugin ${pluginId}`);
    } catch (error) {
      this.logger.error(`Retry failed for plugin ${pluginId}:`, error);
      
      // Schedule another retry
      setTimeout(() => {
        this.executeRetry(incident);
      }, delay);
    }
  }

  private async retryOperation(incident: ErrorIncident): Promise<void> {
    const { pluginId, context } = incident;
    
    // This would retry the original operation that failed
    // For now, we'll just try to reload the plugin
    await this.pluginManager.reloadPlugin(pluginId);
  }

  private updateCircuitBreaker(pluginId: string, success: boolean): void {
    const state = this.getCircuitBreakerState(pluginId);
    
    if (success) {
      state.successCount++;
      state.failureCount = 0;
      
      if (state.state === 'half-open' && state.successCount >= 3) {
        state.state = 'closed';
        this.logger.log(`Circuit breaker closed for plugin ${pluginId}`);
      }
    } else {
      state.failureCount++;
      state.lastFailureTime = new Date();
      state.successCount = 0;
      
      if (state.failureCount >= 5) {
        state.state = 'open';
        state.nextAttemptTime = new Date(Date.now() + 60000); // 1 minute
        this.logger.warn(`Circuit breaker opened for plugin ${pluginId}`);
      }
    }

    // Check if we should transition from open to half-open
    if (state.state === 'open' && Date.now() >= state.nextAttemptTime.getTime()) {
      state.state = 'half-open';
      this.logger.log(`Circuit breaker half-open for plugin ${pluginId}`);
    }
  }
}