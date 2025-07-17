import { PluginStatus, PluginEventType } from '../common/interfaces/plugin.interface';

export class PluginId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('Plugin ID cannot be empty');
    }
  }

  equals(other: PluginId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

export class PluginVersion {
  constructor(public readonly value: string) {
    if (!this.isValidVersion(value)) {
      throw new Error('Invalid plugin version format');
    }
  }

  private isValidVersion(version: string): boolean {
    const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
    return semverRegex.test(version);
  }

  equals(other: PluginVersion): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

export class PluginManifest {
  constructor(
    public readonly name: string,
    public readonly version: PluginVersion,
    public readonly description: string,
    public readonly author: string,
    public readonly main: string,
    public readonly dependencies: string[] = [],
    public readonly permissions: string[] = []
  ) {}

  static create(data: any): PluginManifest {
    return new PluginManifest(
      data.name,
      new PluginVersion(data.version),
      data.description,
      data.author,
      data.main,
      data.dependencies || [],
      data.permissions || []
    );
  }
}

export class PluginDomain {
  private constructor(
    private readonly id: PluginId,
    private readonly manifest: PluginManifest,
    private status: PluginStatus,
    private readonly createdAt: Date,
    private updatedAt: Date,
    private readonly events: PluginDomainEvent[] = []
  ) {}

  static create(id: PluginId, manifest: PluginManifest): PluginDomain {
    const plugin = new PluginDomain(
      id,
      manifest,
      PluginStatus.INACTIVE,
      new Date(),
      new Date()
    );

    plugin.addEvent(new PluginCreatedEvent(id, manifest));
    return plugin;
  }

  static restore(
    id: PluginId,
    manifest: PluginManifest,
    status: PluginStatus,
    createdAt: Date,
    updatedAt: Date
  ): PluginDomain {
    return new PluginDomain(id, manifest, status, createdAt, updatedAt);
  }

  getId(): PluginId {
    return this.id;
  }

  getManifest(): PluginManifest {
    return this.manifest;
  }

  getStatus(): PluginStatus {
    return this.status;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }

  getEvents(): PluginDomainEvent[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events.length = 0;
  }

  load(): void {
    this.changeStatus(PluginStatus.LOADING);
    this.addEvent(new PluginStatusChangedEvent(this.id, PluginStatus.LOADING));
  }

  activate(): void {
    if (this.status !== PluginStatus.LOADING) {
      throw new Error(`Cannot activate plugin in ${this.status} state`);
    }
    this.changeStatus(PluginStatus.ACTIVE);
    this.addEvent(new PluginActivatedEvent(this.id));
  }

  deactivate(): void {
    if (this.status !== PluginStatus.ACTIVE) {
      throw new Error(`Cannot deactivate plugin in ${this.status} state`);
    }
    this.changeStatus(PluginStatus.INACTIVE);
    this.addEvent(new PluginDeactivatedEvent(this.id));
  }

  markAsError(error: string): void {
    this.changeStatus(PluginStatus.ERROR);
    this.addEvent(new PluginErrorEvent(this.id, error));
  }

  update(newManifest: PluginManifest): void {
    this.changeStatus(PluginStatus.UPDATING);
    this.updatedAt = new Date();
    this.addEvent(new PluginUpdatedEvent(this.id, this.manifest.version, newManifest.version));
  }

  canTransitionTo(newStatus: PluginStatus): boolean {
    const validTransitions = {
      [PluginStatus.INACTIVE]: [PluginStatus.LOADING],
      [PluginStatus.LOADING]: [PluginStatus.ACTIVE, PluginStatus.ERROR],
      [PluginStatus.ACTIVE]: [PluginStatus.INACTIVE, PluginStatus.UPDATING, PluginStatus.ERROR],
      [PluginStatus.UPDATING]: [PluginStatus.ACTIVE, PluginStatus.ERROR],
      [PluginStatus.ERROR]: [PluginStatus.LOADING, PluginStatus.INACTIVE],
      [PluginStatus.STOPPING]: [PluginStatus.INACTIVE]
    };

    return validTransitions[this.status]?.includes(newStatus) || false;
  }

  private changeStatus(newStatus: PluginStatus): void {
    if (!this.canTransitionTo(newStatus)) {
      throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
    }
    this.status = newStatus;
    this.updatedAt = new Date();
  }

  private addEvent(event: PluginDomainEvent): void {
    this.events.push(event);
  }
}

export abstract class PluginDomainEvent {
  constructor(
    public readonly pluginId: PluginId,
    public readonly occurredAt: Date = new Date()
  ) {}
}

export class PluginCreatedEvent extends PluginDomainEvent {
  constructor(
    pluginId: PluginId,
    public readonly manifest: PluginManifest
  ) {
    super(pluginId);
  }
}

export class PluginStatusChangedEvent extends PluginDomainEvent {
  constructor(
    pluginId: PluginId,
    public readonly newStatus: PluginStatus
  ) {
    super(pluginId);
  }
}

export class PluginActivatedEvent extends PluginDomainEvent {
  constructor(pluginId: PluginId) {
    super(pluginId);
  }
}

export class PluginDeactivatedEvent extends PluginDomainEvent {
  constructor(pluginId: PluginId) {
    super(pluginId);
  }
}

export class PluginErrorEvent extends PluginDomainEvent {
  constructor(
    pluginId: PluginId,
    public readonly error: string
  ) {
    super(pluginId);
  }
}

export class PluginUpdatedEvent extends PluginDomainEvent {
  constructor(
    pluginId: PluginId,
    public readonly oldVersion: PluginVersion,
    public readonly newVersion: PluginVersion
  ) {
    super(pluginId);
  }
}

export class PluginAggregate {
  private plugins = new Map<string, PluginDomain>();

  addPlugin(plugin: PluginDomain): void {
    this.plugins.set(plugin.getId().value, plugin);
  }

  getPlugin(id: PluginId): PluginDomain | undefined {
    return this.plugins.get(id.value);
  }

  removePlugin(id: PluginId): void {
    this.plugins.delete(id.value);
  }

  getAllPlugins(): PluginDomain[] {
    return Array.from(this.plugins.values());
  }

  getPluginsByStatus(status: PluginStatus): PluginDomain[] {
    return this.getAllPlugins().filter(plugin => plugin.getStatus() === status);
  }

  getActivePlugins(): PluginDomain[] {
    return this.getPluginsByStatus(PluginStatus.ACTIVE);
  }

  getInactivePlugins(): PluginDomain[] {
    return this.getPluginsByStatus(PluginStatus.INACTIVE);
  }

  getErrorPlugins(): PluginDomain[] {
    return this.getPluginsByStatus(PluginStatus.ERROR);
  }

  count(): number {
    return this.plugins.size;
  }
}