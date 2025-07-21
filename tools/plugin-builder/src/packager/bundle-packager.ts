import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as tar from 'tar';
import * as crypto from 'crypto';

export interface PackageOptions {
  pluginPath: string;
  outputPath?: string;
  includeSource?: boolean;
  includeDocs?: boolean;
  includeTests?: boolean;
  customFiles?: string[];
  excludePatterns?: string[];
  compressionLevel?: number;
}

export interface PackageResult {
  packagePath: string;
  size: number;
  checksum: string;
  files: string[];
  manifest: any;
  metadata: {
    name: string;
    version: string;
    createdAt: Date;
    buildInfo?: any;
  };
}

export interface PackageValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class BundlePackager {
  private readonly logger = new Logger(BundlePackager.name);

  async createPackage(options: PackageOptions): Promise<PackageResult> {
    const {
      pluginPath,
      outputPath = path.join(pluginPath, 'dist'),
      includeSource = false,
      includeDocs = true,
      includeTests = false,
      customFiles = [],
      excludePatterns = [],
      compressionLevel = 6,
    } = options;

    try {
      this.logger.log(`Creating package for plugin at: ${pluginPath}`);

      // Load and validate manifest
      const manifest = await this.loadManifest(pluginPath);
      const packageName = `${manifest.name}-${manifest.version}.tar.gz`;
      const packagePath = path.join(outputPath, packageName);

      // Ensure output directory exists
      await fs.mkdir(outputPath, { recursive: true });

      // Collect files to include
      const filesToPackage = await this.collectFiles({
        pluginPath,
        includeSource,
        includeDocs,
        includeTests,
        customFiles,
        excludePatterns,
      });

      // Validate package contents
      const validation = await this.validatePackageContents(filesToPackage, manifest);
      if (!validation.valid) {
        throw new Error(`Package validation failed: ${validation.errors.join(', ')}`);
      }

      // Create tar.gz archive
      await this.createArchive(filesToPackage, packagePath, pluginPath, compressionLevel);

      // Calculate package info
      const stats = await fs.stat(packagePath);
      const checksum = await this.calculateChecksum(packagePath);

      const result: PackageResult = {
        packagePath,
        size: stats.size,
        checksum,
        files: filesToPackage.map(f => f.relativePath),
        manifest,
        metadata: {
          name: manifest.name,
          version: manifest.version,
          createdAt: new Date(),
        },
      };

      this.logger.log(`Package created successfully: ${packagePath} (${this.formatBytes(stats.size)})`);

      // Log validation warnings
      if (validation.warnings.length > 0) {
        validation.warnings.forEach(warning => {
          this.logger.warn(`Package warning: ${warning}`);
        });
      }

      return result;

    } catch (error) {
      this.logger.error(`Package creation failed: ${error.message}`);
      throw error;
    }
  }

  async extractPackage(
    packagePath: string,
    extractPath: string,
    options: {
      overwrite?: boolean;
      preservePermissions?: boolean;
    } = {},
  ): Promise<{
    extractedFiles: string[];
    manifest: any;
    metadata: any;
  }> {
    const { overwrite = false, preservePermissions = true } = options;

    try {
      this.logger.log(`Extracting package: ${packagePath} to ${extractPath}`);

      // Check if extraction path exists
      if (!overwrite) {
        try {
          await fs.access(extractPath);
          throw new Error('Extraction path already exists. Use overwrite option to replace.');
        } catch (error) {
          if (error.code !== 'ENOENT') {
            throw error;
          }
        }
      }

      // Ensure extraction directory exists
      await fs.mkdir(extractPath, { recursive: true });

      // Extract archive
      const extractedFiles: string[] = [];
      
      await tar.x({
        file: packagePath,
        cwd: extractPath,
        preservePaths: preservePermissions,
        onentry: (entry) => {
          extractedFiles.push(entry.path);
        },
      });

      // Load extracted manifest
      const manifestPath = path.join(extractPath, 'plugin.manifest.json');
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));

      // Load metadata if available
      let metadata = {};
      try {
        const metadataPath = path.join(extractPath, '.plugin-metadata.json');
        metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
      } catch {
        // Metadata file is optional
      }

      this.logger.log(`Package extracted successfully: ${extractedFiles.length} files`);

      return {
        extractedFiles,
        manifest,
        metadata,
      };

    } catch (error) {
      this.logger.error(`Package extraction failed: ${error.message}`);
      throw error;
    }
  }

  async validatePackage(packagePath: string): Promise<PackageValidation> {
    const result: PackageValidation = {
      valid: true,
      errors: [],
      warnings: [],
    };

    try {
      // Check if file exists and is readable
      const stats = await fs.stat(packagePath);
      
      if (!stats.isFile()) {
        result.valid = false;
        result.errors.push('Path is not a file');
        return result;
      }

      // Check file size (max 100MB)
      const maxSize = 100 * 1024 * 1024;
      if (stats.size > maxSize) {
        result.valid = false;
        result.errors.push(`Package size exceeds maximum (${this.formatBytes(maxSize)})`);
      }

      if (stats.size === 0) {
        result.valid = false;
        result.errors.push('Package file is empty');
        return result;
      }

      // Validate tar.gz structure
      await this.validateArchiveStructure(packagePath, result);

      // Check for required files
      await this.validateRequiredFiles(packagePath, result);

      // Security checks
      await this.performSecurityChecks(packagePath, result);

    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation error: ${error.message}`);
    }

    return result;
  }

  async getPackageInfo(packagePath: string): Promise<{
    size: number;
    checksum: string;
    files: string[];
    manifest?: any;
    created?: Date;
  }> {
    try {
      const stats = await fs.stat(packagePath);
      const checksum = await this.calculateChecksum(packagePath);
      const files: string[] = [];

      // List files in archive
      await tar.t({
        file: packagePath,
        onentry: (entry) => {
          files.push(entry.path);
        },
      });

      let manifest;
      try {
        // Try to extract and read manifest
        const manifestContent = await this.extractFileFromArchive(
          packagePath,
          'plugin.manifest.json',
        );
        manifest = JSON.parse(manifestContent);
      } catch {
        // Manifest extraction failed
      }

      return {
        size: stats.size,
        checksum,
        files,
        manifest,
        created: stats.ctime,
      };

    } catch (error) {
      this.logger.error(`Failed to get package info: ${error.message}`);
      throw error;
    }
  }

  private async loadManifest(pluginPath: string): Promise<any> {
    const manifestPath = path.join(pluginPath, 'plugin.manifest.json');
    
    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      return JSON.parse(manifestContent);
    } catch (error) {
      throw new Error(`Failed to load manifest: ${error.message}`);
    }
  }

  private async collectFiles(options: {
    pluginPath: string;
    includeSource: boolean;
    includeDocs: boolean;
    includeTests: boolean;
    customFiles: string[];
    excludePatterns: string[];
  }): Promise<Array<{ absolutePath: string; relativePath: string }>> {
    const files: Array<{ absolutePath: string; relativePath: string }> = [];
    const { pluginPath, includeSource, includeDocs, includeTests, customFiles, excludePatterns } = options;

    // Always include required files
    const requiredFiles = [
      'plugin.manifest.json',
      'package.json',
      'dist/**/*',
    ];

    // Optional files based on flags
    const optionalFiles: string[] = [];
    
    if (includeSource) {
      optionalFiles.push('src/**/*', 'tsconfig.json');
    }

    if (includeDocs) {
      optionalFiles.push('README.md', 'LICENSE', 'docs/**/*');
    }

    if (includeTests) {
      optionalFiles.push('test/**/*', 'tests/**/*', '*.test.*', '*.spec.*');
    }

    // Add custom files
    optionalFiles.push(...customFiles);

    const allPatterns = [...requiredFiles, ...optionalFiles];

    // Use glob to find matching files
    const glob = require('glob');
    
    for (const pattern of allPatterns) {
      try {
        const matches = await new Promise<string[]>((resolve, reject) => {
          glob(pattern, { cwd: pluginPath }, (error, matches) => {
            if (error) reject(error);
            else resolve(matches);
          });
        });

        for (const match of matches) {
          const absolutePath = path.join(pluginPath, match);
          const stat = await fs.stat(absolutePath);
          
          if (stat.isFile() && !this.shouldExcludeFile(match, excludePatterns)) {
            files.push({
              absolutePath,
              relativePath: match,
            });
          }
        }
      } catch (error) {
        this.logger.debug(`Pattern ${pattern} matched no files or caused error: ${error.message}`);
      }
    }

    // Remove duplicates
    const uniqueFiles = files.filter((file, index, self) =>
      index === self.findIndex(f => f.relativePath === file.relativePath)
    );

    return uniqueFiles;
  }

  private shouldExcludeFile(filePath: string, excludePatterns: string[]): boolean {
    const defaultExcludes = [
      'node_modules/**',
      '.git/**',
      '.env',
      '.env.*',
      '*.log',
      '.DS_Store',
      'Thumbs.db',
    ];

    const allExcludes = [...defaultExcludes, ...excludePatterns];
    
    return allExcludes.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return regex.test(filePath);
    });
  }

  private async validatePackageContents(
    files: Array<{ absolutePath: string; relativePath: string }>,
    manifest: any,
  ): Promise<PackageValidation> {
    const result: PackageValidation = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // Check for required files
    const requiredFiles = ['plugin.manifest.json', 'package.json'];
    
    for (const required of requiredFiles) {
      if (!files.find(f => f.relativePath === required)) {
        result.valid = false;
        result.errors.push(`Required file missing: ${required}`);
      }
    }

    // Check for main entry point
    if (manifest.main) {
      const mainFile = files.find(f => f.relativePath === manifest.main);
      if (!mainFile) {
        result.valid = false;
        result.errors.push(`Main entry point file not found: ${manifest.main}`);
      }
    }

    // Check for compiled output
    const hasDistFiles = files.some(f => f.relativePath.startsWith('dist/'));
    if (!hasDistFiles) {
      result.warnings.push('No compiled output found in dist/ directory');
    }

    // Check package size
    const totalSize = await this.calculateTotalSize(files);
    const maxSize = 50 * 1024 * 1024; // 50MB
    
    if (totalSize > maxSize) {
      result.warnings.push(`Package size is large (${this.formatBytes(totalSize)})`);
    }

    return result;
  }

  private async createArchive(
    files: Array<{ absolutePath: string; relativePath: string }>,
    packagePath: string,
    basePath: string,
    compressionLevel: number,
  ): Promise<void> {
    // Add metadata file
    const metadata = {
      createdAt: new Date().toISOString(),
      createdBy: 'plugin-builder',
      version: '1.0.0',
      files: files.map(f => f.relativePath),
    };

    const metadataPath = path.join(basePath, '.plugin-metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    // Add metadata to files list
    files.push({
      absolutePath: metadataPath,
      relativePath: '.plugin-metadata.json',
    });

    try {
      await tar.c(
        {
          file: packagePath,
          cwd: basePath,
          gzip: {
            level: compressionLevel,
          },
        },
        files.map(f => f.relativePath),
      );
    } finally {
      // Clean up temporary metadata file
      try {
        await fs.unlink(metadataPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private async validateArchiveStructure(
    packagePath: string,
    result: PackageValidation,
  ): Promise<void> {
    try {
      const files: string[] = [];
      
      await tar.t({
        file: packagePath,
        onentry: (entry) => {
          files.push(entry.path);
          
          // Check for suspicious file paths
          if (entry.path.includes('..') || entry.path.startsWith('/')) {
            result.valid = false;
            result.errors.push(`Suspicious file path: ${entry.path}`);
          }
          
          // Check for executable files
          if (entry.path.match(/\.(exe|bat|sh|cmd)$/i)) {
            result.warnings.push(`Executable file found: ${entry.path}`);
          }
        },
      });

      if (files.length === 0) {
        result.valid = false;
        result.errors.push('Archive is empty');
      }

    } catch (error) {
      result.valid = false;
      result.errors.push(`Cannot read archive: ${error.message}`);
    }
  }

  private async validateRequiredFiles(
    packagePath: string,
    result: PackageValidation,
  ): Promise<void> {
    const files: string[] = [];
    
    await tar.t({
      file: packagePath,
      onentry: (entry) => {
        files.push(entry.path);
      },
    });

    const requiredFiles = ['plugin.manifest.json'];
    
    for (const required of requiredFiles) {
      if (!files.includes(required)) {
        result.valid = false;
        result.errors.push(`Required file missing in archive: ${required}`);
      }
    }
  }

  private async performSecurityChecks(
    packagePath: string,
    result: PackageValidation,
  ): Promise<void> {
    // Check for suspiciously large files
    await tar.t({
      file: packagePath,
      onentry: (entry) => {
        const maxFileSize = 10 * 1024 * 1024; // 10MB per file
        
        if (entry.size && entry.size > maxFileSize) {
          result.warnings.push(`Large file detected: ${entry.path} (${this.formatBytes(entry.size)})`);
        }
      },
    });
  }

  private async extractFileFromArchive(packagePath: string, fileName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let content = '';
      
      tar.t({
        file: packagePath,
        onentry: (entry) => {
          if (entry.path === fileName) {
            entry.on('data', (chunk) => {
              content += chunk.toString();
            });
            
            entry.on('end', () => {
              resolve(content);
            });
          }
        },
      }).catch(reject);
    });
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const data = await fs.readFile(filePath);
    hash.update(data);
    return hash.digest('hex');
  }

  private async calculateTotalSize(files: Array<{ absolutePath: string; relativePath: string }>): Promise<number> {
    let totalSize = 0;
    
    for (const file of files) {
      try {
        const stats = await fs.stat(file.absolutePath);
        totalSize += stats.size;
      } catch {
        // Skip files that can't be stat'd
      }
    }
    
    return totalSize;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}