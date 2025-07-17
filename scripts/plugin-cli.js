#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const AdmZip = require('adm-zip');

class PluginCLI {
  constructor() {
    this.program = new Command();
    this.apiUrl = process.env.PLUGIN_API_URL || 'http://localhost:3000';
    this.setupCommands();
  }

  setupCommands() {
    this.program
      .name('plugin-cli')
      .description('Plugin management CLI tool')
      .version('1.0.0');

    // Create plugin command
    this.program
      .command('create <name>')
      .description('Create a new plugin')
      .option('-a, --author <author>', 'Plugin author', 'Anonymous')
      .option('-d, --description <description>', 'Plugin description', '')
      .option('-l, --license <license>', 'Plugin license', 'MIT')
      .action((name, options) => this.createPlugin(name, options));

    // Build plugin command
    this.program
      .command('build [plugin]')
      .description('Build plugin(s)')
      .option('-s, --source <dir>', 'Source directory', './plugin-source')
      .option('-o, --output <dir>', 'Output directory', './dist')
      .option('-t, --target <dir>', 'Target directory', './plugins')
      .action((plugin, options) => this.buildPlugin(plugin, options));

    // Search plugins command
    this.program
      .command('search <query>')
      .description('Search for plugins in registry')
      .option('-l, --limit <number>', 'Limit results', '10')
      .option('-o, --offset <number>', 'Offset results', '0')
      .option('-a, --author <author>', 'Filter by author')
      .option('-v, --verified', 'Show only verified plugins')
      .action((query, options) => this.searchPlugins(query, options));

    // Install plugin command
    this.program
      .command('install <plugin>')
      .description('Install a plugin from registry')
      .option('-v, --version <version>', 'Specific version to install')
      .action((plugin, options) => this.installPlugin(plugin, options));

    // Uninstall plugin command
    this.program
      .command('uninstall <plugin>')
      .description('Uninstall a plugin')
      .action((plugin) => this.uninstallPlugin(plugin));

    // Update plugin command
    this.program
      .command('update <plugin>')
      .description('Update a plugin to latest version')
      .option('-v, --version <version>', 'Specific version to update to')
      .action((plugin, options) => this.updatePlugin(plugin, options));

    // List plugins command
    this.program
      .command('list')
      .description('List installed plugins')
      .action(() => this.listPlugins());

    // Publish plugin command
    this.program
      .command('publish <plugin>')
      .description('Publish a plugin to registry')
      .option('-t, --tags <tags>', 'Comma-separated tags')
      .option('-c, --category <category>', 'Plugin category')
      .action((plugin, options) => this.publishPlugin(plugin, options));

    // Info command
    this.program
      .command('info <plugin>')
      .description('Get plugin information')
      .action((plugin) => this.getPluginInfo(plugin));

    // Validate command
    this.program
      .command('validate <plugin>')
      .description('Validate a plugin structure')
      .action((plugin) => this.validatePlugin(plugin));
  }

  async createPlugin(name, options) {
    console.log(`🚀 Creating plugin: ${name}`);
    
    const pluginDir = path.join(process.cwd(), 'plugin-source', name);
    
    if (await fs.pathExists(pluginDir)) {
      console.error(`❌ Plugin directory already exists: ${pluginDir}`);
      return;
    }
    
    await fs.ensureDir(pluginDir);
    
    // Create plugin.manifest.json
    const manifest = {
      name,
      version: '1.0.0',
      description: options.description || `${name} plugin`,
      author: options.author,
      license: options.license,
      main: 'index.js',
      dependencies: [],
      peerDependencies: [],
      minimumNodeVersion: process.version,
      requiredPermissions: [],
      configSchema: {
        type: 'object',
        properties: {}
      },
      resourceLimits: {
        memory: '128MB',
        cpu: '0.5',
        disk: '200MB',
        network: '5MB/s',
        executionTime: 10000
      }
    };
    
    await fs.writeJson(path.join(pluginDir, 'plugin.manifest.json'), manifest, { spaces: 2 });
    
    // Create index.js
    const indexTemplate = `class ${this.toPascalCase(name)}Plugin {
  constructor() {
    this.name = '${name}';
    this.version = '1.0.0';
    this.description = '${options.description || `${name} plugin`}';
    this.author = '${options.author}';
    this.license = '${options.license}';
    this.config = null;
    this.logger = null;
  }

  async initialize(context) {
    this.config = context.config;
    this.logger = context.logger;
    this.logger.log('${name} plugin initialized');
  }

  async destroy() {
    this.logger.log('${name} plugin destroyed');
  }

  async onHealthCheck() {
    return {
      status: 'healthy',
      checks: [
        {
          name: 'plugin-status',
          status: 'pass',
          message: 'Plugin is running normally'
        }
      ],
      lastCheck: new Date(),
      uptime: Date.now()
    };
  }

  getRoutes() {
    return [
      {
        path: '/hello',
        method: 'GET',
        handler: 'hello'
      }
    ];
  }

  getControllers() {
    const plugin = this;
    
    class ${this.toPascalCase(name)}Controller {
      async hello(req, res) {
        return {
          message: 'Hello from ${name} plugin!',
          plugin: plugin.name,
          version: plugin.version
        };
      }
    }

    return [${this.toPascalCase(name)}Controller];
  }

  async validateConfig(config) {
    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  }

  getConfigSchema() {
    return {
      type: 'object',
      properties: {
        // Define your configuration schema here
      }
    };
  }
}

module.exports = ${this.toPascalCase(name)}Plugin;
`;
    
    await fs.writeFile(path.join(pluginDir, 'index.js'), indexTemplate);
    
    // Create package.json
    const packageJson = {
      name: `plugin-${name}`,
      version: '1.0.0',
      description: options.description || `${name} plugin`,
      main: 'index.js',
      scripts: {
        test: 'echo "No tests specified for plugin"'
      },
      author: options.author,
      license: options.license,
      dependencies: {},
      devDependencies: {}
    };
    
    await fs.writeJson(path.join(pluginDir, 'package.json'), packageJson, { spaces: 2 });
    
    // Create README.md
    const readme = `# ${name} Plugin

## Description
${options.description || `${name} plugin`}

## Installation
\`\`\`bash
plugin-cli install ${name}
\`\`\`

## Usage
After installation, the plugin will be available at:
\`\`\`
GET /plugin/${name}/hello
\`\`\`

## Configuration
Add your configuration documentation here.

## API Endpoints
- \`GET /plugin/${name}/hello\` - Returns a hello message

## Development
\`\`\`bash
# Build the plugin
plugin-cli build ${name}

# Validate the plugin
plugin-cli validate ${name}

# Publish the plugin
plugin-cli publish ${name}
\`\`\`

## License
${options.license}
`;
    
    await fs.writeFile(path.join(pluginDir, 'README.md'), readme);
    
    console.log(`✅ Plugin created successfully: ${pluginDir}`);
    console.log(`📝 Next steps:`);
    console.log(`   1. cd ${pluginDir}`);
    console.log(`   2. Edit index.js to implement your plugin logic`);
    console.log(`   3. Run: plugin-cli build ${name}`);
    console.log(`   4. Run: plugin-cli publish ${name}`);
  }

  async buildPlugin(plugin, options) {
    const PluginBuilder = require('./build-plugin');
    const builder = new PluginBuilder(options);
    
    try {
      if (plugin) {
        await builder.buildPlugin(plugin);
      } else {
        await builder.buildAll();
      }
    } catch (error) {
      console.error('❌ Build failed:', error.message);
      process.exit(1);
    }
  }

  async searchPlugins(query, options) {
    try {
      const params = {
        query,
        limit: parseInt(options.limit),
        offset: parseInt(options.offset)
      };
      
      if (options.author) params.author = options.author;
      if (options.verified) params.verified = true;
      
      const response = await axios.get(`${this.apiUrl}/registry/search`, { params });
      
      const plugins = response.data.data;
      
      if (plugins.length === 0) {
        console.log('No plugins found matching your query.');
        return;
      }
      
      console.log(`Found ${plugins.length} plugins:`);
      console.log();
      
      plugins.forEach(plugin => {
        console.log(`📦 ${plugin.name} (${plugin.version})`);
        console.log(`   Author: ${plugin.author}`);
        console.log(`   Description: ${plugin.description}`);
        console.log(`   Downloads: ${plugin.downloads}`);
        console.log(`   Rating: ${plugin.rating}/5`);
        if (plugin.verified) console.log(`   ✅ Verified`);
        console.log();
      });
    } catch (error) {
      console.error('❌ Search failed:', error.message);
      process.exit(1);
    }
  }

  async installPlugin(plugin, options) {
    try {
      console.log(`📦 Installing plugin: ${plugin}${options.version ? `@${options.version}` : ''}`);
      
      const body = {};
      if (options.version) body.version = options.version;
      
      const response = await axios.post(`${this.apiUrl}/registry/plugins/${plugin}/install`, body);
      
      console.log(`✅ Plugin installed successfully: ${plugin}`);
      console.log(`   Version: ${response.data.data.version}`);
      console.log(`   Status: ${response.data.data.status}`);
    } catch (error) {
      console.error('❌ Installation failed:', error.response?.data?.error || error.message);
      process.exit(1);
    }
  }

  async uninstallPlugin(plugin) {
    try {
      console.log(`🗑️  Uninstalling plugin: ${plugin}`);
      
      await axios.delete(`${this.apiUrl}/registry/plugins/${plugin}/uninstall`);
      
      console.log(`✅ Plugin uninstalled successfully: ${plugin}`);
    } catch (error) {
      console.error('❌ Uninstallation failed:', error.response?.data?.error || error.message);
      process.exit(1);
    }
  }

  async updatePlugin(plugin, options) {
    try {
      console.log(`🔄 Updating plugin: ${plugin}${options.version ? ` to ${options.version}` : ''}`);
      
      const body = {};
      if (options.version) body.version = options.version;
      
      const response = await axios.put(`${this.apiUrl}/registry/plugins/${plugin}/update`, body);
      
      console.log(`✅ Plugin updated successfully: ${plugin}`);
      console.log(`   Version: ${response.data.data.version}`);
      console.log(`   Status: ${response.data.data.status}`);
    } catch (error) {
      console.error('❌ Update failed:', error.response?.data?.error || error.message);
      process.exit(1);
    }
  }

  async listPlugins() {
    try {
      const response = await axios.get(`${this.apiUrl}/api/plugins`);
      
      const plugins = response.data;
      
      if (plugins.length === 0) {
        console.log('No plugins installed.');
        return;
      }
      
      console.log(`Installed plugins (${plugins.length}):`);
      console.log();
      
      plugins.forEach(plugin => {
        console.log(`📦 ${plugin.name} (${plugin.version})`);
        console.log(`   Description: ${plugin.description}`);
        console.log(`   Author: ${plugin.author}`);
        console.log(`   Status: ${plugin.status}`);
        console.log(`   Created: ${new Date(plugin.created).toLocaleDateString()}`);
        console.log();
      });
    } catch (error) {
      console.error('❌ Failed to list plugins:', error.message);
      process.exit(1);
    }
  }

  async publishPlugin(plugin, options) {
    try {
      console.log(`📤 Publishing plugin: ${plugin}`);
      
      const pluginPath = path.join(process.cwd(), 'dist', plugin);
      if (!await fs.pathExists(pluginPath)) {
        console.error(`❌ Plugin not found: ${pluginPath}`);
        console.log('💡 Build the plugin first: plugin-cli build ' + plugin);
        return;
      }
      
      // Create zip file
      const zip = new AdmZip();
      zip.addLocalFolder(pluginPath);
      
      const zipBuffer = zip.toBuffer();
      
      // Read manifest for metadata
      const manifest = await fs.readJson(path.join(pluginPath, 'plugin.manifest.json'));
      
      // Prepare form data
      const form = new FormData();
      form.append('plugin', zipBuffer, `${plugin}.zip`);
      form.append('name', manifest.name);
      form.append('version', manifest.version);
      form.append('description', manifest.description);
      form.append('author', manifest.author);
      form.append('license', manifest.license);
      
      if (options.tags) {
        form.append('tags', JSON.stringify(options.tags.split(',')));
      }
      
      if (options.category) {
        form.append('category', options.category);
      }
      
      const response = await axios.post(`${this.apiUrl}/registry/publish`, form, {
        headers: form.getHeaders()
      });
      
      console.log(`✅ Plugin published successfully: ${plugin}`);
      console.log(`   Version: ${response.data.data.version}`);
      console.log(`   Registry ID: ${response.data.data.id}`);
    } catch (error) {
      console.error('❌ Publish failed:', error.response?.data?.error || error.message);
      process.exit(1);
    }
  }

  async getPluginInfo(plugin) {
    try {
      const response = await axios.get(`${this.apiUrl}/registry/plugins/${plugin}`);
      
      const info = response.data.data;
      
      console.log(`📦 ${info.name} (${info.version})`);
      console.log(`   Description: ${info.description}`);
      console.log(`   Author: ${info.author}`);
      console.log(`   License: ${info.license}`);
      console.log(`   Downloads: ${info.downloads}`);
      console.log(`   Rating: ${info.rating}/5`);
      console.log(`   Size: ${(info.size / 1024).toFixed(2)} KB`);
      console.log(`   Created: ${new Date(info.createdAt).toLocaleDateString()}`);
      console.log(`   Updated: ${new Date(info.updatedAt).toLocaleDateString()}`);
      if (info.verified) console.log(`   ✅ Verified`);
      if (info.tags?.length > 0) {
        console.log(`   Tags: ${info.tags.join(', ')}`);
      }
      console.log(`   Node Version: ${info.compatibility.nodeVersion}`);
      console.log(`   Platform Version: ${info.compatibility.platformVersion}`);
    } catch (error) {
      console.error('❌ Failed to get plugin info:', error.response?.data?.error || error.message);
      process.exit(1);
    }
  }

  async validatePlugin(plugin) {
    try {
      console.log(`🔍 Validating plugin: ${plugin}`);
      
      const pluginPath = path.join(process.cwd(), 'plugin-source', plugin);
      if (!await fs.pathExists(pluginPath)) {
        console.error(`❌ Plugin not found: ${pluginPath}`);
        return;
      }
      
      // Check required files
      const requiredFiles = ['plugin.manifest.json', 'index.js'];
      for (const file of requiredFiles) {
        const filePath = path.join(pluginPath, file);
        if (!await fs.pathExists(filePath)) {
          console.error(`❌ Required file missing: ${file}`);
          return;
        }
      }
      
      // Validate manifest
      const manifest = await fs.readJson(path.join(pluginPath, 'plugin.manifest.json'));
      const requiredFields = ['name', 'version', 'description', 'main'];
      
      for (const field of requiredFields) {
        if (!manifest[field]) {
          console.error(`❌ Required field missing in manifest: ${field}`);
          return;
        }
      }
      
      // Validate version format
      const versionRegex = /^\d+\.\d+\.\d+$/;
      if (!versionRegex.test(manifest.version)) {
        console.error(`❌ Invalid version format: ${manifest.version}`);
        return;
      }
      
      // Check if main file exists
      const mainFilePath = path.join(pluginPath, manifest.main);
      if (!await fs.pathExists(mainFilePath)) {
        console.error(`❌ Main file not found: ${manifest.main}`);
        return;
      }
      
      console.log(`✅ Plugin validation passed: ${plugin}`);
      console.log(`   Name: ${manifest.name}`);
      console.log(`   Version: ${manifest.version}`);
      console.log(`   Description: ${manifest.description}`);
      console.log(`   Main file: ${manifest.main}`);
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      process.exit(1);
    }
  }

  toPascalCase(str) {
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    }).replace(/\s+/g, '').replace(/[-_]/g, '');
  }

  run() {
    this.program.parse();
  }
}

// Run CLI
if (require.main === module) {
  const cli = new PluginCLI();
  cli.run();
}

module.exports = PluginCLI;