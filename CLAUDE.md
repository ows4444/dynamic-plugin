**Goal**
Design only the high‑level architecture and folder/module structure for a NestJS‑based, server‑installed dynamic plugin system. Ignore Nizaami’s multi‑tenant requirements.

**Overview**

* A NestJS server (Node + TypeScript) hosts:

  * **Plugin Registry Service**: catalog of available plugins, licensing, versioning
  * **Plugin Creation Environment**: CLI or web UI to generate new plugin templates
  * **Plugin Consumer API**: endpoints for clients to discover, download, install, activate, and license plugins
* A client‑side “app plugin consumer” that calls the server API to manage plugins at runtime

**Plugin Requirements**
Each plugin, as its own NestJS module, may include any of:

* Database integration (TypeORM/Mongoose/etc.)
* GraphQL and/or REST controllers
* gRPC microservices
* CQRS/Event‑Sourcing handlers
* Redis caching / PubSub
* RabbitMQ or Kafka message handlers
* Plugin‑to‑Plugin communication channels

**Deliverable**

* A modular folder/layout diagram showing:

  * Core server modules (Registry, Creator, Consumer)
  * Plugin template structure (src/, controllers/, services/, events/, db/, etc.)
  * How plugins are discovered, loaded (dynamic module loading), activated/disabled
  * Key design patterns (Factory, Strategy, Observer, Dependency Injection)
  * Extension points (hooks for gRPC, event bus, licensing)

Emphasize production‑grade best practices (SOLID, separation of concerns, automated testing, CI/CD hooks, anti‑corruption layer for external services) and sub‑100 ms edge‑accelerated startup for each plugin.
