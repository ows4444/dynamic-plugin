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
      return metadata;
    } catch (error) {
      this.logger.error(`Failed to extract metadata: ${error.message}`);
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
        );
        metadata = {
          id: packageJson.name,
          name: packageJson.name,
          version: packageJson.version,
          description: packageJson.description,
          author: packageJson.author,
          license: packageJson.license,
          repository: packageJson.repository?.url,
          homepage: packageJson.homepage,
          keywords: packageJson.keywords,
          dependencies: packageJson.dependencies,
          peerDependencies: packageJson.peerDependencies,
          engines: packageJson.engines,
          main: packageJson.main,
          files: packageJson.files,
        };
      }

      // Read plugin manifest if it exists (override package.json values)
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        metadata = { ...metadata, ...manifest };
      }

      // Ensure required fields
      if (!metadata.id || !metadata.name || !metadata.version) {
        throw new Error('Missing required metadata fields (id, name, version)');
      }

      this.logger.log(
        `Extracted metadata: ${metadata.name}@${metadata.version}`,
      );
      return metadata as PluginMetadata;
    } catch (error) {
      this.logger.error(
        `Failed to extract metadata from directory: ${error.message}`,
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
      const requiredFields = ['id', 'name', 'version', 'description', 'author'];
      for (const field of requiredFields) {
        if (!metadata[field]) {
          this.logger.error(`Missing required field: ${field}`);
          return false;
        }
      }

      // Validate version format
      if (!this.isValidVersion(metadata.version)) {
        this.logger.error(`Invalid version format: ${metadata.version}`);
        return false;
      }

      // Validate name format
      if (!this.isValidName(metadata.name)) {
        this.logger.error(`Invalid name format: ${metadata.name}`);
        return false;
      }

      this.logger.log(
        `Metadata validation passed: ${metadata.name}@${metadata.version}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Metadata validation failed: ${error.message}`);
      return false;
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
