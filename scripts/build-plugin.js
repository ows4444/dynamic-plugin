#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');
const crypto = require('crypto');

class PluginBuilder {
  constructor(options = {}) {
    this.options = {
      sourceDir: options.sourceDir || './plugin-source',
      outputDir: options.outputDir || './dist',
      targetDir: options.targetDir || './plugins',
      ...options
    };
  }

  async buildPlugin(pluginName) {
    console.log(`🔨 Building plugin: ${pluginName}`);
    
    const pluginSourcePath = path.join(this.options.sourceDir, pluginName);
    const pluginOutputPath = path.join(this.options.outputDir, pluginName);
    const pluginTargetPath = path.join(this.options.targetDir, pluginName);

    if (!await fs.pathExists(pluginSourcePath)) {
      throw new Error(`Plugin source directory not found: ${pluginSourcePath}`);
    }

    // Step 1: Validate plugin structure
    await this.validatePluginStructure(pluginSourcePath);

    // Step 2: Create output directory
    await fs.ensureDir(pluginOutputPath);

    // Step 3: Copy and process plugin files
    await this.processPluginFiles(pluginSourcePath, pluginOutputPath);

    // Step 4: Install dependencies
    await this.installDependencies(pluginOutputPath);

    // Step 5: Run tests if available
    await this.runTests(pluginOutputPath);

    // Step 6: Package plugin
    const packagePath = await this.packagePlugin(pluginName, pluginOutputPath);

    // Step 7: Deploy to target directory
    await this.deployPlugin(pluginName, pluginOutputPath, pluginTargetPath);

    console.log(`✅ Plugin built successfully: ${pluginName}`);
    return {
      pluginName,
      version: await this.getPluginVersion(pluginOutputPath),
      packagePath,
      targetPath: pluginTargetPath
    };
  }

  async validatePluginStructure(pluginPath) {
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

    // Validate semantic version
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(manifest.version)) {
      throw new Error('Invalid version format. Use semantic versioning (x.y.z)');
    }

    console.log('✅ Plugin structure validated');
    return manifest;
  }

  async processPluginFiles(sourcePath, outputPath) {
    // Copy all files
    await fs.copy(sourcePath, outputPath);

    // Process TypeScript files if present
    const tsConfigPath = path.join(sourcePath, 'tsconfig.json');
    if (await fs.pathExists(tsConfigPath)) {
      console.log('📝 Compiling TypeScript...');
      try {
        execSync('npx tsc', { cwd: outputPath, stdio: 'inherit' });
      } catch (error) {
        throw new Error('TypeScript compilation failed');
      }
    }

    // Minify JavaScript files if needed
    const shouldMinify = process.env.NODE_ENV === 'production';
    if (shouldMinify) {
      console.log('🗜️  Minifying JavaScript...');
      await this.minifyJavaScript(outputPath);
    }

    console.log('✅ Plugin files processed');
  }

  async installDependencies(pluginPath) {
    const packageJsonPath = path.join(pluginPath, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      console.log('📦 Installing dependencies...');
      try {
        // First try npm ci, if it fails, try npm install
        execSync('npm ci --production', { cwd: pluginPath, stdio: 'inherit' });
      } catch (error) {
        try {
          execSync('npm install --production', { cwd: pluginPath, stdio: 'inherit' });
        } catch (installError) {
          console.warn('Failed to install dependencies, continuing...');
        }
      }
    }
  }

  async runTests(pluginPath) {
    const packageJsonPath = path.join(pluginPath, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      const packageJson = await fs.readJson(packageJsonPath);
      if (packageJson.scripts && packageJson.scripts.test) {
        console.log('🧪 Running tests...');
        try {
          const result = execSync('npm test', { cwd: pluginPath, stdio: 'pipe' });
          console.log('✅ Tests passed');
        } catch (error) {
          // Check if it's just a placeholder test
          const output = error.stdout ? error.stdout.toString() : '';
          if (output.includes('No tests specified for plugin') || output.includes('Error: no test specified')) {
            console.log('⚠️  No tests specified, skipping...');
          } else {
            throw new Error('Plugin tests failed');
          }
        }
      }
    }
  }

  async packagePlugin(pluginName, pluginPath) {
    const packagePath = path.join(this.options.outputDir, `${pluginName}.zip`);
    
    console.log('📦 Packaging plugin...');
    
    const output = fs.createWriteStream(packagePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
      output.on('close', () => {
        console.log(`📦 Package created: ${packagePath} (${archive.pointer()} bytes)`);
        resolve(packagePath);
      });

      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(pluginPath, false);
      archive.finalize();
    });
  }

  async deployPlugin(pluginName, sourcePath, targetPath) {
    console.log('🚀 Deploying plugin...');
    
    await fs.ensureDir(targetPath);
    await fs.copy(sourcePath, targetPath);
    
    // Generate plugin hash for integrity checking
    const hash = await this.generatePluginHash(targetPath);
    await fs.writeFile(path.join(targetPath, '.plugin-hash'), hash);
    
    console.log('✅ Plugin deployed');
  }

  async generatePluginHash(pluginPath) {
    const files = await this.getPluginFiles(pluginPath);
    const hash = crypto.createHash('sha256');
    
    for (const file of files) {
      const content = await fs.readFile(file);
      hash.update(content);
    }
    
    return hash.digest('hex');
  }

  async getPluginFiles(pluginPath) {
    const files = [];
    const entries = await fs.readdir(pluginPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(pluginPath, entry.name);
      if (entry.isDirectory()) {
        files.push(...await this.getPluginFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  async getPluginVersion(pluginPath) {
    const manifestPath = path.join(pluginPath, 'plugin.manifest.json');
    const manifest = await fs.readJson(manifestPath);
    return manifest.version;
  }

  async minifyJavaScript(pluginPath) {
    // Implementation for JavaScript minification
    // This would typically use tools like terser or uglify-js
    console.log('Minification would be implemented here');
  }

  async buildAll() {
    const sourceDir = this.options.sourceDir;
    if (!await fs.pathExists(sourceDir)) {
      throw new Error(`Source directory not found: ${sourceDir}`);
    }

    const entries = await fs.readdir(sourceDir, { withFileTypes: true });
    const plugins = entries.filter(entry => entry.isDirectory()).map(entry => entry.name);

    console.log(`Found ${plugins.length} plugins to build`);

    const results = [];
    for (const plugin of plugins) {
      try {
        const result = await this.buildPlugin(plugin);
        results.push(result);
      } catch (error) {
        console.error(`❌ Failed to build plugin ${plugin}:`, error.message);
        results.push({ pluginName: plugin, error: error.message });
      }
    }

    return results;
  }
}

// CLI usage
if (require.main === module) {
  const [,, pluginName] = process.argv;
  const builder = new PluginBuilder();

  if (pluginName) {
    builder.buildPlugin(pluginName).catch(console.error);
  } else {
    builder.buildAll().catch(console.error);
  }
}

module.exports = PluginBuilder;