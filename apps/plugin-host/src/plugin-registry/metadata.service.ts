import { getErrorMessage } from '@lib/shared/common';
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license?: string;
  repository?: string;
  homepage?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  main?: string;
  files?: string[];
}

export interface PackageJsonData {
  name?: string;
  version?: string;
  description?: string;
  author?: string | { name?: string; email?: string; url?: string };
  license?: string;
  repository?: string | { url?: string; type?: string };
  homepage?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  main?: string;
  files?: string[];
  [key: string]: unknown;
}

export interface PluginManifestData {
  id?: string;
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  license?: string;
  repository?: string;
  homepage?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  main?: string;
  files?: string[];
  [key: string]: unknown;
}

@Injectable()
export class MetadataService {
  private readonly logger = new Logger(MetadataService.name);

  async extractFromPackage(packagePath: string): Promise<PluginMetadata> {
    this.logger.log(`Extracting metadata from package: ${packagePath}`);

    try {
      // For .tgz files, we would need to extract and read package.json
      // For now, simulate reading metadata
      const metadata: PluginMetadata = {
        id: path.basename(packagePath, '.tgz'),
        name: path.basename(packagePath, '.tgz'),
        version: '1.0.0',
        description: 'Plugin package',
        author: 'Unknown',
      };

      this.logger.log(
        `Extracted metadata: ${metadata.name}@${metadata.version}`,
      );
      return Promise.resolve(metadata);
    } catch (error) {
      this.logger.error(`Failed to extract metadata: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  async extractFromDirectory(pluginDir: string): Promise<PluginMetadata> {
    this.logger.log(`Extracting metadata from directory: ${pluginDir}`);

    try {
      const packageJsonPath = path.join(pluginDir, 'package.json');
      const manifestPath = path.join(pluginDir, 'plugin.manifest.json');

      let metadata: Partial<PluginMetadata> = {};

      // Read package.json if it exists
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, 'utf8'),
        ) as PackageJsonData;
        
        // Extract author string if it's an object
        const authorString = typeof packageJson.author === 'object' 
          ? packageJson.author.name ?? 'Unknown'
          : packageJson.author;
        
        // Extract repository URL if it's an object
        const repositoryUrl = typeof packageJson.repository === 'object'
          ? packageJson.repository.url
          : packageJson.repository;
        
        // Build metadata object with only defined values
        metadata = {
          id: packageJson.name ?? '',
          name: packageJson.name ?? '',
          version: packageJson.version ?? '',
          description: packageJson.description ?? '',
          author: authorString ?? '',
        };

        // Add optional properties only if they are defined
        if (packageJson.license != null) metadata.license = packageJson.license;
        if (repositoryUrl != null) metadata.repository = repositoryUrl;
        if (packageJson.homepage != null) metadata.homepage = packageJson.homepage;
        if (packageJson.keywords) metadata.keywords = packageJson.keywords;
        if (packageJson.dependencies) metadata.dependencies = packageJson.dependencies;
        if (packageJson.peerDependencies) metadata.peerDependencies = packageJson.peerDependencies;
        if (packageJson.engines) metadata.engines = packageJson.engines;
        if (packageJson.main != null) metadata.main = packageJson.main;
        if (packageJson.files) metadata.files = packageJson.files;
      }

      // Read plugin manifest if it exists (override package.json values)
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as PluginManifestData;
        metadata = { ...metadata, ...manifest };
      }

      // Ensure required fields
      if ((metadata.id == null) || metadata.id === '' || (metadata.name == null) || metadata.name === '' || (metadata.version == null) || metadata.version === '') {
        throw new Error('Missing required metadata fields (id, name, version)');
      }

      this.logger.log(
        `Extracted metadata: ${metadata.name}@${metadata.version}`,
      );
      return Promise.resolve(metadata as PluginMetadata);
    } catch (error) {
      this.logger.error(
        `Failed to extract metadata from directory: ${getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async validateMetadata(metadata: PluginMetadata): Promise<boolean> {
    this.logger.log(
      `Validating metadata for: ${metadata.name}@${metadata.version}`,
    );

    try {
      // Check required fields
      const requiredFields: (keyof PluginMetadata)[] = ['id', 'name', 'version', 'description', 'author'];
      for (const field of requiredFields) {
        const value = metadata[field];
        if (value == null || value === '') {
          this.logger.error(`Missing required field: ${field}`);
          return Promise.resolve(false);
        }
      }

      // Validate version format
      if (!this.isValidVersion(metadata.version)) {
        this.logger.error(`Invalid version format: ${metadata.version}`);
        return Promise.resolve(false);
      }

      // Validate name format
      if (!this.isValidName(metadata.name)) {
        this.logger.error(`Invalid name format: ${metadata.name}`);
        return Promise.resolve(false);
      }

      this.logger.log(
        `Metadata validation passed: ${metadata.name}@${metadata.version}`,
      );
      return Promise.resolve(true);
    } catch (error) {
      this.logger.error(`Metadata validation failed: ${getErrorMessage(error)}`);
      return Promise.resolve(false);
    }
  }

  async generateMetadata(pluginDir: string): Promise<PluginMetadata> {
    this.logger.log(`Generating metadata for: ${pluginDir}`);

    const metadata: PluginMetadata = {
      id: path.basename(pluginDir),
      name: path.basename(pluginDir),
      version: '1.0.0',
      description: 'Auto-generated plugin metadata',
      author: 'Unknown',
    };

    // Try to enhance with existing files
    try {
      const existingMetadata = await this.extractFromDirectory(pluginDir);
      Object.assign(metadata, existingMetadata);
    } catch {
      // Use default metadata if extraction fails
    }

    return metadata;
  }

  private isValidVersion(version: string): boolean {
    const semverRegex =
      /^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*)?(\+[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*)?$/;
    return semverRegex.test(version);
  }

  private isValidName(name: string): boolean {
    // Basic npm package name validation
    const nameRegex = /^[a-z][a-z0-9-]*[a-z0-9]$/;
    return nameRegex.test(name) && name.length >= 2 && name.length <= 50;
  }
}
