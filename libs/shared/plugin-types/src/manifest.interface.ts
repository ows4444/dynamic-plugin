export interface IManifest {
  schema: string;
  name: string;
  version: string;
  displayName?: string;
  description: string;
  author: ManifestAuthor;
  license: string;
  homepage?: string;
  repository?: ManifestRepository;
  bugs?: ManifestBugs;
  keywords?: string[];
  tags?: string[];
  category: string;
  type: string;
  main: string;
  icon?: string;
  screenshots?: string[];
  changelog?: string;
  readme?: string;

  // Runtime configuration
  runtime: ManifestRuntime;

  // Dependencies
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;

  // Plugin-specific configuration
  plugin: ManifestPlugin;

  // Build and deployment
  build?: ManifestBuild;

  // Security
  security: ManifestSecurity;

  // Compatibility
  compatibility: ManifestCompatibility;

  // Extension points
  extensions?: ManifestExtension[];

  // Metadata
  metadata?: Record<string, any>;
}

export interface ManifestAuthor {
  name: string;
  email?: string;
  url?: string;
  organization?: string;
}

export interface ManifestRepository {
  type: string;
  url: string;
  directory?: string;
}

export interface ManifestBugs {
  url?: string;
  email?: string;
}

export interface ManifestRuntime {
  nodeVersion: string;
  hostVersion: string;
  supportedPlatforms: string[];
  architecture?: string[];
  environment?: Record<string, string>;
  requiresRestart?: boolean;
  isolationLevel: 'none' | 'process' | 'container';
}

export interface ManifestPlugin {
  entryPoint: string;
  configSchema?: string;
  defaultConfig?: Record<string, any>;
  routes?: ManifestRoute[];
  hooks?: ManifestHook[];
  commands?: ManifestCommand[];
  events?: ManifestEvent[];
  services?: ManifestService[];
  middleware?: ManifestMiddleware[];
  guards?: ManifestGuard[];
  pipes?: ManifestPipe[];
  filters?: ManifestFilter[];
  interceptors?: ManifestInterceptor[];
  decorators?: ManifestDecorator[];
  providers?: ManifestProvider[];
  controllers?: ManifestController[];
  modules?: ManifestModule[];
}

export interface ManifestRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD' | 'ALL';
  path: string;
  handler: string;
  description?: string;
  summary?: string;
  tags?: string[];
  deprecated?: boolean;
  operationId?: string;
  middleware?: string[];
  guards?: string[];
  interceptors?: string[];
  pipes?: string[];
  filters?: string[];
  parameters?: ManifestParameter[];
  requestBody?: ManifestRequestBody;
  responses?: Record<string, ManifestResponse>;
  security?: ManifestRouteSecurity[];
}

export interface ManifestParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
  schema: ManifestSchema;
  examples?: Record<string, ManifestExample>;
}

export interface ManifestRequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, ManifestMediaType>;
}

export interface ManifestResponse {
  description: string;
  headers?: Record<string, ManifestHeader>;
  content?: Record<string, ManifestMediaType>;
  links?: Record<string, ManifestLink>;
}

export interface ManifestMediaType {
  schema?: ManifestSchema;
  examples?: Record<string, ManifestExample>;
  encoding?: Record<string, ManifestEncoding>;
}

export interface ManifestHeader {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
  schema?: ManifestSchema;
  examples?: Record<string, ManifestExample>;
}

export interface ManifestExample {
  summary?: string;
  description?: string;
  value?: any;
  externalValue?: string;
}

export interface ManifestEncoding {
  contentType?: string;
  headers?: Record<string, ManifestHeader>;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
}

export interface ManifestLink {
  operationRef?: string;
  operationId?: string;
  parameters?: Record<string, any>;
  requestBody?: any;
  description?: string;
  server?: ManifestServer;
}

export interface ManifestServer {
  url: string;
  description?: string;
  variables?: Record<string, ManifestServerVariable>;
}

export interface ManifestServerVariable {
  enum?: string[];
  default: string;
  description?: string;
}

export interface ManifestRouteSecurity {
  [name: string]: string[];
}

export interface ManifestSchema {
  type?: string;
  format?: string;
  title?: string;
  description?: string;
  default?: any;
  multipleOf?: number;
  maximum?: number;
  exclusiveMaximum?: boolean;
  minimum?: number;
  exclusiveMinimum?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
  maxProperties?: number;
  minProperties?: number;
  required?: string[];
  enum?: any[];
  allOf?: ManifestSchema[];
  oneOf?: ManifestSchema[];
  anyOf?: ManifestSchema[];
  not?: ManifestSchema;
  items?: ManifestSchema;
  properties?: Record<string, ManifestSchema>;
  additionalProperties?: boolean | ManifestSchema;
  nullable?: boolean;
  discriminator?: ManifestDiscriminator;
  readOnly?: boolean;
  writeOnly?: boolean;
  xml?: ManifestXml;
  externalDocs?: ManifestExternalDocs;
  example?: any;
  deprecated?: boolean;
}

export interface ManifestDiscriminator {
  propertyName: string;
  mapping?: Record<string, string>;
}

export interface ManifestXml {
  name?: string;
  namespace?: string;
  prefix?: string;
  attribute?: boolean;
  wrapped?: boolean;
}

export interface ManifestExternalDocs {
  description?: string;
  url: string;
}

export interface ManifestHook {
  name: string;
  type: 'before' | 'after' | 'around' | 'replace';
  target: string;
  handler: string;
  priority?: number;
  async?: boolean;
  conditions?: ManifestCondition[];
  timeout?: number;
  retries?: number;
}

export interface ManifestCommand {
  name: string;
  description?: string;
  handler: string;
  options?: ManifestCommandOption[];
  arguments?: ManifestCommandArgument[];
  aliases?: string[];
  examples?: ManifestCommandExample[];
}

export interface ManifestCommandOption {
  name: string;
  description?: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required?: boolean;
  default?: any;
  choices?: any[];
  alias?: string;
}

export interface ManifestCommandArgument {
  name: string;
  description?: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required?: boolean;
  variadic?: boolean;
}

export interface ManifestCommandExample {
  command: string;
  description?: string;
}

export interface ManifestEvent {
  name: string;
  description?: string;
  type: 'emit' | 'listen' | 'both';
  handler?: string;
  schema?: ManifestSchema;
  priority?: number;
  async?: boolean;
}

export interface ManifestService {
  name: string;
  class: string;
  scope?: 'singleton' | 'transient' | 'request';
  dependencies?: string[];
  interfaces?: string[];
  lifecycle?: ManifestServiceLifecycle;
}

export interface ManifestServiceLifecycle {
  onCreate?: string;
  onDestroy?: string;
  onStart?: string;
  onStop?: string;
}

export interface ManifestMiddleware {
  name: string;
  class: string;
  routes?: string[];
  order?: number;
  conditions?: ManifestCondition[];
}

export interface ManifestGuard {
  name: string;
  class: string;
  routes?: string[];
  roles?: string[];
  permissions?: string[];
  conditions?: ManifestCondition[];
}

export interface ManifestPipe {
  name: string;
  class: string;
  parameters?: string[];
  global?: boolean;
}

export interface ManifestFilter {
  name: string;
  class: string;
  exceptions?: string[];
  global?: boolean;
}

export interface ManifestInterceptor {
  name: string;
  class: string;
  routes?: string[];
  global?: boolean;
}

export interface ManifestDecorator {
  name: string;
  class: string;
  targets?: ('class' | 'method' | 'property' | 'parameter')[];
}

export interface ManifestProvider {
  name: string;
  class?: string;
  useValue?: any;
  useFactory?: string;
  useClass?: string;
  useExisting?: string;
  inject?: string[];
  scope?: 'singleton' | 'transient' | 'request';
}

export interface ManifestController {
  name: string;
  class: string;
  path?: string;
  guards?: string[];
  interceptors?: string[];
  pipes?: string[];
  filters?: string[];
}

export interface ManifestModule {
  name: string;
  class: string;
  imports?: string[];
  exports?: string[];
  providers?: string[];
  controllers?: string[];
  global?: boolean;
}

export interface ManifestCondition {
  type: 'environment' | 'config' | 'feature' | 'custom';
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'exists' | 'not_exists';
  key: string;
  value?: any;
  handler?: string;
}

export interface ManifestBuild {
  scripts?: Record<string, string>;
  assets?: string[];
  externals?: string[];
  optimization?: ManifestOptimization;
  webpack?: Record<string, any>;
  typescript?: Record<string, any>;
}

export interface ManifestOptimization {
  minify?: boolean;
  sourceMaps?: boolean;
  treeshaking?: boolean;
  splitting?: boolean;
  compression?: 'gzip' | 'brotli' | 'none';
}

export interface ManifestSecurity {
  permissions: string[];
  securityLevel: 'public' | 'internal' | 'restricted' | 'confidential' | 'secret';
  sandbox?: ManifestSandbox;
  csp?: ManifestCSP;
  allowedHosts?: string[];
  blockedHosts?: string[];
  rateLimiting?: ManifestRateLimit;
  authentication?: ManifestAuthentication;
  encryption?: ManifestEncryption;
}

export interface ManifestSandbox {
  enabled: boolean;
  allowNetworking?: boolean;
  allowFileSystem?: boolean;
  allowSubprocesses?: boolean;
  allowEval?: boolean;
  memoryLimit?: number;
  cpuLimit?: number;
  timeout?: number;
}

export interface ManifestCSP {
  directives: Record<string, string[]>;
  reportUri?: string;
  reportOnly?: boolean;
}

export interface ManifestRateLimit {
  enabled: boolean;
  requests?: number;
  window?: number;
  burst?: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface ManifestAuthentication {
  required: boolean;
  methods: ('api_key' | 'jwt' | 'oauth2' | 'basic' | 'certificate')[];
  scopes?: string[];
  audience?: string;
  issuer?: string;
}

export interface ManifestEncryption {
  inTransit: boolean;
  atRest: boolean;
  algorithms: string[];
  keyManagement?: ManifestKeyManagement;
}

export interface ManifestKeyManagement {
  provider: string;
  keyId?: string;
  rotation?: ManifestKeyRotation;
}

export interface ManifestKeyRotation {
  enabled: boolean;
  interval?: number;
  versions?: number;
}

export interface ManifestCompatibility {
  hostVersions: string[];
  nodeVersions: string[];
  platforms: string[];
  architectures: string[];
  breaking?: ManifestBreakingChange[];
  migrations?: ManifestMigration[];
}

export interface ManifestBreakingChange {
  version: string;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  mitigation?: string;
}

export interface ManifestMigration {
  fromVersion: string;
  toVersion: string;
  handler: string;
  description?: string;
  automatic?: boolean;
}

export interface ManifestExtension {
  name: string;
  point: string;
  handler: string;
  priority?: number;
  conditions?: ManifestCondition[];
  metadata?: Record<string, any>;
}
