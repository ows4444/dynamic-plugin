import { getErrorMessage } from '@lib/shared/common';
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PluginValidatorService {
  private readonly logger = new Logger(PluginValidatorService.name);

  async validatePackage(packagePath: string): Promise<boolean> {
    this.logger.log(`Validating plugin package: ${packagePath}`);

    try {
      // Basic validation - check if file exists
      if (!fs.existsSync(packagePath)) {
        this.logger.error(`Package file not found: ${packagePath}`);
        return false;
      }

      // Check file extension
      const ext = path.extname(packagePath);
      if (!['.tgz', '.tar.gz', '.zip'].includes(ext)) {
        this.logger.error(`Invalid package format: ${ext}`);
        return false;
      }

      // Additional validation would go here:
      // - Check package structure
      // - Validate manifest.json
      // - Security checks
      // - Dependency validation

      this.logger.log(`Package validation passed: ${packagePath}`);
      return await Promise.resolve(true) ;
    } catch (error) {
      this.logger.error(`Package validation failed: ${getErrorMessage(error)}`);
      return await Promise.resolve(false) ;
    }
  }

  async validateManifest(manifestPath: string): Promise<boolean> {
    this.logger.log(`Validating manifest: ${manifestPath}`);

    try {
      if (!fs.existsSync(manifestPath)) {
        return false;
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;

      // Check required fields
      const requiredFields = ['id', 'name', 'version'];
      for (const field of requiredFields) {
        if (manifest[field] == null || manifest[field] === '') {
          this.logger.error(`Missing required field in manifest: ${field}`);
          return false;
        }
      }

      // Validate version format
      if (!this.isValidVersion(String(manifest['version']))) {
        this.logger.error(`Invalid version format: ${String(manifest['version'])}`);
        return false;
      }

      return Promise.resolve(true)
    } catch (error) {
      this.logger.error(`Manifest validation failed: ${getErrorMessage(error)}`);
      return Promise.resolve(false)
    }
  }

  private isValidVersion(version: string): boolean {
    // Basic semver validation
    const semverRegex =
      /^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*)?(\+[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*)?$/;
    return semverRegex.test(version);
  }

  async validateSecurity(pluginDir: string): Promise<boolean> {
    this.logger.log(`Running security validation for: ${pluginDir}`);

    // Security validation logic would go here:
    // - Check for suspicious files
    // - Validate permissions
    // - Scan for malicious code patterns
    // - Validate dependencies

    return Promise.resolve(true) ;
  }
}
