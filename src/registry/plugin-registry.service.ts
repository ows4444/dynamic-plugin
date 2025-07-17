import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import * as semver from 'semver';
import { ConfigService } from '../config/config.service';
import { PluginRegistryEntry, PluginSearchQuery } from './registry.interfaces';

export interface VersionConflict {
  pluginId: string;
  requestedVersion: string;
  installedVersion: string;
  conflictType: 'major' | 'minor' | 'patch';
  resolutionStrategy: 'upgrade' | 'downgrade' | 'reject';
}

export interface DependencyGraph {
  pluginId: string;
  version: string;
  dependencies: DependencyNode[];
  conflicts: VersionConflict[];
}

export interface DependencyNode {
  name: string;
  version: string;
  optional: boolean;
  children: DependencyNode[];
}

@Injectable()
export class PluginRegistryService {
  private readonly logger = new Logger(PluginRegistryService.name);
  private readonly localRegistry = new Map<string, PluginRegistryEntry>();
  private readonly versionRegistry = new Map<string, Map<string, PluginRegistryEntry>>();
  private readonly dependencyGraph = new Map<string, DependencyGraph>();
  
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.loadLocalRegistry();
  }

  async searchPlugins(query: PluginSearchQuery): Promise<PluginRegistryEntry[]> {
    this.logger.log(`Searching plugins with query: ${JSON.stringify(query)}`);
    
    // Search in local registry first
    const localResults = await this.searchLocalRegistry(query);
    
    // If remote registry is configured, search there too
    const remoteRegistryUrl = this.configService.get('REMOTE_REGISTRY_URL');
    if (remoteRegistryUrl) {
      try {
        const remoteResults = await this.searchRemoteRegistry(query);
        return [...localResults, ...remoteResults];
      } catch (error) {
        this.logger.warn('Failed to search remote registry:', error.message);
      }
    }
    
    return localResults;
  }

  async getPluginInfo(pluginId: string, version?: string): Promise<PluginRegistryEntry | null> {
    // Check local registry first
    if (version) {
      const versionMap = this.versionRegistry.get(pluginId);
      if (versionMap && versionMap.has(version)) {
        return versionMap.get(version);
      }
    } else {
      const localEntry = this.localRegistry.get(pluginId);
      if (localEntry) {
        return localEntry;
      }
    }
    
    // Check remote registry
    const remoteRegistryUrl = this.configService.get('REMOTE_REGISTRY_URL');
    if (remoteRegistryUrl) {
      try {
        const url = version 
          ? `${remoteRegistryUrl}/plugins/${pluginId}/${version}`
          : `${remoteRegistryUrl}/plugins/${pluginId}`;
        const response = await firstValueFrom(this.httpService.get(url));
        return response.data;
      } catch (error) {
        this.logger.warn(`Failed to fetch plugin info from remote registry: ${error.message}`);
      }
    }
    
    return null;
  }

  async downloadPlugin(pluginId: string, version?: string): Promise<string> {
    this.logger.log(`Downloading plugin: ${pluginId}${version ? `@${version}` : ''}`);
    
    const pluginInfo = await this.getPluginInfo(pluginId);
    if (!pluginInfo) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    
    const downloadUrl = pluginInfo.downloadUrl;
    const tempDir = path.join(process.cwd(), 'temp', 'downloads');
    await fs.ensureDir(tempDir);
    
    const fileName = `${pluginId}-${pluginInfo.version}.zip`;
    const filePath = path.join(tempDir, fileName);
    
    // Download the plugin
    const response = await firstValueFrom(
      this.httpService.get(downloadUrl, { responseType: 'stream' })
    );
    
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', async () => {
        try {
          // Verify checksum
          const checksum = await this.calculateFileChecksum(filePath);
          if (checksum !== pluginInfo.checksum) {
            throw new Error('Plugin checksum verification failed');
          }
          
          this.logger.log(`Plugin downloaded successfully: ${filePath}`);
          resolve(filePath);
        } catch (error) {
          reject(error);
        }
      });
      
      writer.on('error', reject);
    });
  }

  async publishPlugin(pluginPath: string, metadata: Partial<PluginRegistryEntry>): Promise<PluginRegistryEntry> {
    this.logger.log(`Publishing plugin from: ${pluginPath}`);
    
    // Validate plugin structure
    await this.validatePluginStructure(pluginPath);
    
    // Read plugin manifest
    const manifestPath = path.join(pluginPath, 'plugin.manifest.json');
    const manifest = await fs.readJson(manifestPath);
    
    // Create registry entry
    const entry: PluginRegistryEntry = {
      id: manifest.name,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      license: manifest.license,
      tags: metadata.tags || [],
      downloadUrl: '', // Will be set after upload
      checksum: await this.calculateDirectoryChecksum(pluginPath),
      size: await this.getDirectorySize(pluginPath),
      createdAt: new Date(),
      updatedAt: new Date(),
      downloads: 0,
      rating: 0,
      verified: false,
      compatibility: {
        nodeVersion: manifest.minimumNodeVersion || process.version,
        platformVersion: this.configService.get('PLATFORM_VERSION') || '1.0.0'
      },
      ...metadata
    };
    
    // Add to local registry
    this.localRegistry.set(entry.id, entry);
    
    // Add to version registry
    if (!this.versionRegistry.has(entry.id)) {
      this.versionRegistry.set(entry.id, new Map());
    }
    this.versionRegistry.get(entry.id).set(entry.version, entry);
    
    await this.saveLocalRegistry();
    
    // If remote registry is configured, publish there too
    const remoteRegistryUrl = this.configService.get('REMOTE_REGISTRY_URL');
    if (remoteRegistryUrl) {
      try {
        await this.publishToRemoteRegistry(entry, pluginPath);
      } catch (error) {
        this.logger.warn('Failed to publish to remote registry:', error.message);
      }
    }
    
    this.logger.log(`Plugin published successfully: ${entry.id}`);
    return entry;
  }

  async unpublishPlugin(pluginId: string): Promise<void> {
    this.logger.log(`Removing plugin from registry: ${pluginId}`);
    
    // Remove from local registry
    this.localRegistry.delete(pluginId);
    await this.saveLocalRegistry();
    
    // If remote registry is configured, unpublish there too
    const remoteRegistryUrl = this.configService.get('REMOTE_REGISTRY_URL');
    if (remoteRegistryUrl) {
      try {
        await firstValueFrom(
          this.httpService.delete(`${remoteRegistryUrl}/plugins/${pluginId}`)
        );
      } catch (error) {
        this.logger.warn('Failed to unpublish from remote registry:', error.message);
      }
    }
    
    this.logger.log(`Plugin unpublished successfully: ${pluginId}`);
  }

  async resolveVersionConflicts(pluginId: string, requestedVersion: string): Promise<VersionConflict[]> {
    this.logger.log(`Resolving version conflicts for ${pluginId}@${requestedVersion}`);
    
    const conflicts: VersionConflict[] = [];
    const graph = this.dependencyGraph.get(pluginId);
    
    if (!graph) {
      return conflicts;
    }
    
    const installedVersion = graph.version;
    
    if (semver.eq(requestedVersion, installedVersion)) {
      return conflicts;
    }
    
    const conflictType = this.getConflictType(requestedVersion, installedVersion);
    const resolutionStrategy = this.determineResolutionStrategy(requestedVersion, installedVersion);
    
    conflicts.push({
      pluginId,
      requestedVersion,
      installedVersion,
      conflictType,
      resolutionStrategy
    });
    
    // Check for transitive dependency conflicts
    await this.checkTransitiveDependencyConflicts(pluginId, requestedVersion, conflicts);
    
    return conflicts;
  }

  async buildDependencyGraph(pluginId: string, version: string): Promise<DependencyGraph> {
    this.logger.log(`Building dependency graph for ${pluginId}@${version}`);
    
    const pluginInfo = await this.getPluginInfo(pluginId, version);
    if (!pluginInfo) {
      throw new Error(`Plugin not found: ${pluginId}@${version}`);
    }
    
    const dependencies: DependencyNode[] = [];
    const conflicts: VersionConflict[] = [];
    
    // Build dependency tree
    if (pluginInfo.dependencies) {
      for (const dep of pluginInfo.dependencies) {
        const depNode = await this.buildDependencyNode(dep);
        dependencies.push(depNode);
      }
    }
    
    // Check for conflicts
    const conflictList = await this.resolveVersionConflicts(pluginId, version);
    conflicts.push(...conflictList);
    
    const graph: DependencyGraph = {
      pluginId,
      version,
      dependencies,
      conflicts
    };
    
    this.dependencyGraph.set(pluginId, graph);
    return graph;
  }

  async getCompatibleVersions(pluginId: string, versionRange: string): Promise<string[]> {
    this.logger.log(`Finding compatible versions for ${pluginId} with range ${versionRange}`);
    
    const versions = await this.getAvailableVersions(pluginId);
    const compatibleVersions = versions.filter(version => 
      semver.satisfies(version, versionRange)
    );
    
    return compatibleVersions.sort(semver.rcompare);
  }

  async getLatestVersion(pluginId: string, prereleaseAllowed = false): Promise<string | null> {
    const versions = await this.getAvailableVersions(pluginId);
    
    if (versions.length === 0) {
      return null;
    }
    
    const filteredVersions = prereleaseAllowed 
      ? versions 
      : versions.filter(v => !semver.prerelease(v));
    
    return filteredVersions.sort(semver.rcompare)[0] || null;
  }

  async checkCircularDependencies(pluginId: string): Promise<boolean> {
    this.logger.log(`Checking circular dependencies for ${pluginId}`);
    
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    return this.hasCircularDependency(pluginId, visited, recursionStack);
  }

  private getConflictType(requestedVersion: string, installedVersion: string): 'major' | 'minor' | 'patch' {
    const requested = semver.parse(requestedVersion);
    const installed = semver.parse(installedVersion);
    
    if (requested.major !== installed.major) {
      return 'major';
    }
    if (requested.minor !== installed.minor) {
      return 'minor';
    }
    return 'patch';
  }

  private determineResolutionStrategy(requestedVersion: string, installedVersion: string): 'upgrade' | 'downgrade' | 'reject' {
    if (semver.gt(requestedVersion, installedVersion)) {
      return 'upgrade';
    }
    if (semver.lt(requestedVersion, installedVersion)) {
      return 'downgrade';
    }
    return 'reject';
  }

  private async checkTransitiveDependencyConflicts(
    pluginId: string, 
    version: string, 
    conflicts: VersionConflict[]
  ): Promise<void> {
    const graph = this.dependencyGraph.get(pluginId);
    if (!graph) return;
    
    for (const dep of graph.dependencies) {
      const depConflicts = await this.resolveVersionConflicts(dep.name, dep.version);
      conflicts.push(...depConflicts);
    }
  }

  private async buildDependencyNode(dependency: any): Promise<DependencyNode> {
    const children: DependencyNode[] = [];
    
    try {
      const depInfo = await this.getPluginInfo(dependency.name, dependency.version);
      if (depInfo && depInfo.dependencies) {
        for (const childDep of depInfo.dependencies) {
          const childNode = await this.buildDependencyNode(childDep);
          children.push(childNode);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to build dependency node for ${dependency.name}:`, error.message);
    }
    
    return {
      name: dependency.name,
      version: dependency.version,
      optional: dependency.optional || false,
      children
    };
  }

  private async getAvailableVersions(pluginId: string): Promise<string[]> {
    const versions: string[] = [];
    
    // Get local versions
    const localVersions = this.versionRegistry.get(pluginId);
    if (localVersions) {
      versions.push(...localVersions.keys());
    }
    
    // Get remote versions
    const remoteRegistryUrl = this.configService.get('REMOTE_REGISTRY_URL');
    if (remoteRegistryUrl) {
      try {
        const response = await firstValueFrom(
          this.httpService.get(`${remoteRegistryUrl}/plugins/${pluginId}/versions`)
        );
        versions.push(...response.data);
      } catch (error) {
        this.logger.warn(`Failed to fetch versions from remote registry: ${error.message}`);
      }
    }
    
    return [...new Set(versions)];
  }

  private async hasCircularDependency(
    pluginId: string, 
    visited: Set<string>, 
    recursionStack: Set<string>
  ): Promise<boolean> {
    if (recursionStack.has(pluginId)) {
      return true;
    }
    
    if (visited.has(pluginId)) {
      return false;
    }
    
    visited.add(pluginId);
    recursionStack.add(pluginId);
    
    const graph = this.dependencyGraph.get(pluginId);
    if (graph) {
      for (const dep of graph.dependencies) {
        if (await this.hasCircularDependency(dep.name, visited, recursionStack)) {
          return true;
        }
      }
    }
    
    recursionStack.delete(pluginId);
    return false;
  }

  async installPlugin(pluginId: string, version?: string): Promise<void> {
    this.logger.log(`Installing plugin: ${pluginId}${version ? `@${version}` : ''}`);
    
    // Download the plugin
    const downloadPath = await this.downloadPlugin(pluginId, version);
    
    // Extract to plugins directory
    const pluginsDir = path.join(process.cwd(), 'plugins');
    const extractPath = path.join(pluginsDir, pluginId);
    
    await fs.ensureDir(extractPath);
    
    // Extract zip file
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(downloadPath);
    zip.extractAllTo(extractPath, true);
    
    // Clean up download
    await fs.remove(downloadPath);
    
    this.logger.log(`Plugin installed successfully: ${pluginId}`);
  }

  async uninstallPlugin(pluginId: string): Promise<void> {
    this.logger.log(`Uninstalling plugin: ${pluginId}`);
    
    const pluginPath = path.join(process.cwd(), 'plugins', pluginId);
    if (await fs.pathExists(pluginPath)) {
      await fs.remove(pluginPath);
      this.logger.log(`Plugin uninstalled successfully: ${pluginId}`);
    } else {
      this.logger.warn(`Plugin not found for uninstall: ${pluginId}`);
    }
  }

  async updatePlugin(pluginId: string, version?: string): Promise<void> {
    this.logger.log(`Updating plugin: ${pluginId}${version ? ` to ${version}` : ''}`);
    
    // Get current version
    const currentManifest = await this.getInstalledPluginManifest(pluginId);
    if (!currentManifest) {
      throw new Error(`Plugin not installed: ${pluginId}`);
    }
    
    // Get latest version from registry
    const registryEntry = await this.getPluginInfo(pluginId);
    if (!registryEntry) {
      throw new Error(`Plugin not found in registry: ${pluginId}`);
    }
    
    const targetVersion = version || registryEntry.version;
    
    // Check if update is needed
    if (currentManifest.version === targetVersion) {
      this.logger.log(`Plugin ${pluginId} is already up to date`);
      return;
    }
    
    // Backup current version
    const backupPath = path.join(process.cwd(), 'plugins', `.${pluginId}-backup`);
    const currentPath = path.join(process.cwd(), 'plugins', pluginId);
    
    if (await fs.pathExists(currentPath)) {
      await fs.copy(currentPath, backupPath);
    }
    
    try {
      // Uninstall current version
      await this.uninstallPlugin(pluginId);
      
      // Install new version
      await this.installPlugin(pluginId, targetVersion);
      
      // Clean up backup
      await fs.remove(backupPath);
      
      this.logger.log(`Plugin updated successfully: ${pluginId} ${currentManifest.version} → ${targetVersion}`);
    } catch (error) {
      // Restore backup on failure
      if (await fs.pathExists(backupPath)) {
        await fs.copy(backupPath, currentPath);
        await fs.remove(backupPath);
      }
      
      throw new Error(`Failed to update plugin: ${error.message}`);
    }
  }

  private async searchLocalRegistry(query: PluginSearchQuery): Promise<PluginRegistryEntry[]> {
    const entries = Array.from(this.localRegistry.values());
    
    return entries.filter(entry => {
      if (query.query && !entry.name.toLowerCase().includes(query.query.toLowerCase()) &&
          !entry.description.toLowerCase().includes(query.query.toLowerCase())) {
        return false;
      }
      
      if (query.author && entry.author !== query.author) {
        return false;
      }
      
      if (query.verified !== undefined && entry.verified !== query.verified) {
        return false;
      }
      
      if (query.minRating && entry.rating < query.minRating) {
        return false;
      }
      
      return true;
    }).slice(query.offset || 0, (query.offset || 0) + (query.limit || 10));
  }

  private async searchRemoteRegistry(query: PluginSearchQuery): Promise<PluginRegistryEntry[]> {
    const remoteRegistryUrl = this.configService.get('REMOTE_REGISTRY_URL');
    const response = await firstValueFrom(
      this.httpService.get(`${remoteRegistryUrl}/search`, { params: query })
    );
    
    return response.data;
  }

  private async publishToRemoteRegistry(entry: PluginRegistryEntry, pluginPath: string): Promise<void> {
    const remoteRegistryUrl = this.configService.get('REMOTE_REGISTRY_URL');
    
    // Create multipart form data
    const FormData = require('form-data');
    const form = new FormData();
    
    // Add plugin metadata
    form.append('metadata', JSON.stringify(entry));
    
    // Add plugin files
    const pluginZip = await this.createPluginZip(pluginPath);
    form.append('plugin', fs.createReadStream(pluginZip));
    
    // Upload to remote registry
    await firstValueFrom(
      this.httpService.post(`${remoteRegistryUrl}/publish`, form, {
        headers: form.getHeaders()
      })
    );
  }

  private async validatePluginStructure(pluginPath: string): Promise<void> {
    const manifestPath = path.join(pluginPath, 'plugin.manifest.json');
    const mainFile = path.join(pluginPath, 'index.js');
    
    if (!await fs.pathExists(manifestPath)) {
      throw new Error('plugin.manifest.json not found');
    }
    
    if (!await fs.pathExists(mainFile)) {
      throw new Error('index.js not found');
    }
    
    const manifest = await fs.readJson(manifestPath);
    
    // Validate required fields
    const requiredFields = ['name', 'version', 'description', 'main'];
    for (const field of requiredFields) {
      if (!manifest[field]) {
        throw new Error(`Missing required field in manifest: ${field}`);
      }
    }
  }

  private async calculateFileChecksum(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    return new Promise((resolve, reject) => {
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private async calculateDirectoryChecksum(dirPath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const files = await this.getDirectoryFiles(dirPath);
    
    for (const file of files.sort()) {
      const content = await fs.readFile(file);
      hash.update(content);
    }
    
    return hash.digest('hex');
  }

  private async getDirectoryFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        files.push(...await this.getDirectoryFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    const files = await this.getDirectoryFiles(dirPath);
    let totalSize = 0;
    
    for (const file of files) {
      const stats = await fs.stat(file);
      totalSize += stats.size;
    }
    
    return totalSize;
  }

  private async createPluginZip(pluginPath: string): Promise<string> {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    
    zip.addLocalFolder(pluginPath);
    
    const zipPath = path.join(process.cwd(), 'temp', `${Date.now()}.zip`);
    await fs.ensureDir(path.dirname(zipPath));
    
    zip.writeZip(zipPath);
    return zipPath;
  }

  private async loadLocalRegistry(): Promise<void> {
    const registryPath = path.join(process.cwd(), 'plugin-registry.json');
    
    if (await fs.pathExists(registryPath)) {
      try {
        const registry = await fs.readJson(registryPath);
        Object.entries(registry).forEach(([key, value]) => {
          const entry = value as PluginRegistryEntry;
          this.localRegistry.set(key, entry);
          
          // Build version registry
          if (!this.versionRegistry.has(entry.id)) {
            this.versionRegistry.set(entry.id, new Map());
          }
          this.versionRegistry.get(entry.id).set(entry.version, entry);
        });
        
        this.logger.log(`Loaded ${this.localRegistry.size} plugins from local registry`);
      } catch (error) {
        this.logger.warn('Failed to load local registry:', error.message);
      }
    }
  }

  private async saveLocalRegistry(): Promise<void> {
    const registryPath = path.join(process.cwd(), 'plugin-registry.json');
    const registry = Object.fromEntries(this.localRegistry);
    
    await fs.writeJson(registryPath, registry, { spaces: 2 });
  }

  private async getInstalledPluginManifest(pluginId: string): Promise<any> {
    const manifestPath = path.join(process.cwd(), 'plugins', pluginId, 'plugin.manifest.json');
    
    if (await fs.pathExists(manifestPath)) {
      return await fs.readJson(manifestPath);
    }
    
    return null;
  }
}