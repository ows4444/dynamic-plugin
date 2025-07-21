#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

// Plugin manifest schema
const manifestSchema = {
  type: 'object',
  required: ['name', 'version', 'description', 'main', 'pluginType', 'apiVersion'],
  properties: {
    name: {
      type: 'string',
      pattern: '^[a-z][a-z0-9-]*[a-z0-9]$',
      minLength: 3,
      maxLength: 50,
    },
    version: {
      type: 'string',
      pattern: '^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$',
    },
    description: {
      type: 'string',
      minLength: 10,
      maxLength: 500,
    },
    main: {
      type: 'string',
    },
    pluginType: {
      type: 'string',
      enum: ['service', 'middleware', 'integration', 'utility', 'auth', 'storage'],
    },
    apiVersion: {
      type: 'string',
    },
    author: {
      oneOf: [
        { type: 'string' },
        {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            url: { type: 'string', format: 'uri' },
          },
          required: ['name'],
        },
      ],
    },
    license: {
      type: 'string',
    },
    permissions: {
      type: 'array',
      items: { type: 'string' },
    },
    routes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          method: { type: 'string' },
          handler: { type: 'string' },
        },
        required: ['path', 'method', 'handler'],
      },
    },
    engines: {
      type: 'object',
      properties: {
        host: { type: 'string' },
        node: { type: 'string' },
      },
    },
  },
};

async function validatePlugin(pluginPath = process.cwd()) {
  console.log(chalk.blue.bold('\n🔍 Validating Plugin...\n'));

  const results = {
    valid: true,
    errors: [],
    warnings: [],
  };

  try {
    // Check required files
    const requiredFiles = [
      'plugin.manifest.json',
      'package.json',
      'tsconfig.json',
      'src',
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(pluginPath, file);
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      
      if (!exists) {
        results.errors.push(`Missing required file: ${file}`);
        results.valid = false;
      }
    }

    if (!results.valid) {
      console.error(chalk.red('❌ Missing required files'));
      return results;
    }

    // Validate manifest
    const manifestPath = path.join(pluginPath, 'plugin.manifest.json');
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    
    let manifest;
    try {
      manifest = JSON.parse(manifestContent);
    } catch (error) {
      results.errors.push('Invalid JSON in plugin.manifest.json');
      results.valid = false;
      console.error(chalk.red('❌ Invalid manifest JSON'));
      return results;
    }

    // Schema validation
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(manifestSchema);
    const valid = validate(manifest);

    if (!valid) {
      results.valid = false;
      validate.errors.forEach(error => {
        results.errors.push(`Manifest ${error.instancePath || 'root'}: ${error.message}`);
      });
    }

    // Custom validations
    await performCustomValidations(pluginPath, manifest, results);

    // Check package.json consistency
    const packagePath = path.join(pluginPath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
    
    if (packageJson.name !== `@plugins/${manifest.name}`) {
      results.warnings.push(`Package name should be @plugins/${manifest.name}`);
    }

    if (packageJson.version !== manifest.version) {
      results.warnings.push('Version mismatch between package.json and manifest');
    }

    // Report results
    if (results.valid && results.warnings.length === 0) {
      console.log(chalk.green.bold('✅ Plugin validation passed!'));
    } else if (results.valid) {
      console.log(chalk.yellow.bold('⚠️  Plugin validation passed with warnings:'));
      results.warnings.forEach(warning => {
        console.log(chalk.yellow(`  - ${warning}`));
      });
    } else {
      console.log(chalk.red.bold('❌ Plugin validation failed:'));
      results.errors.forEach(error => {
        console.log(chalk.red(`  - ${error}`));
      });
      
      if (results.warnings.length > 0) {
        console.log(chalk.yellow('\nWarnings:'));
        results.warnings.forEach(warning => {
          console.log(chalk.yellow(`  - ${warning}`));
        });
      }
    }

  } catch (error) {
    results.valid = false;
    results.errors.push(`Validation error: ${error.message}`);
    console.error(chalk.red.bold('❌ Validation failed:'));
    console.error(chalk.red(error.message));
  }

  return results;
}

async function performCustomValidations(pluginPath, manifest, results) {
  // Check if main entry file exists
  if (manifest.main) {
    const mainPath = path.join(pluginPath, manifest.main);
    const mainExists = await fs.access(mainPath).then(() => true).catch(() => false);
    
    if (!mainExists) {
      // Check if it exists in src/ directory
      const srcMainPath = path.join(pluginPath, 'src', path.basename(manifest.main));
      const srcMainExists = await fs.access(srcMainPath).then(() => true).catch(() => false);
      
      if (!srcMainExists) {
        results.warnings.push(`Main entry file not found: ${manifest.main}`);
      }
    }
  }

  // Check for dangerous permissions
  if (manifest.permissions) {
    const dangerousPermissions = [
      'system.process',
      'filesystem.write',
      'system.env',
    ];
    
    const dangerous = manifest.permissions.filter(p => dangerousPermissions.includes(p));
    if (dangerous.length > 0) {
      results.warnings.push(`Plugin requests dangerous permissions: ${dangerous.join(', ')}`);
    }
  }

  // Check route conflicts
  if (manifest.routes) {
    const systemRoutes = ['/health', '/status', '/metrics', '/admin'];
    
    for (const route of manifest.routes) {
      if (systemRoutes.some(sys => route.path.startsWith(sys))) {
        results.warnings.push(`Route ${route.path} may conflict with system routes`);
      }
    }
  }

  // Check for TypeScript files
  const srcPath = path.join(pluginPath, 'src');
  try {
    const files = await fs.readdir(srcPath, { recursive: true });
    const tsFiles = files.filter(file => file.endsWith('.ts'));
    
    if (tsFiles.length === 0) {
      results.warnings.push('No TypeScript files found in src/ directory');
    }
  } catch (error) {
    // src directory doesn't exist or is not readable
  }

  // Check for tests
  const testPaths = ['test', 'tests', 'spec'];
  let hasTests = false;
  
  for (const testPath of testPaths) {
    const fullTestPath = path.join(pluginPath, testPath);
    const exists = await fs.access(fullTestPath).then(() => true).catch(() => false);
    
    if (exists) {
      hasTests = true;
      break;
    }
  }

  if (!hasTests) {
    results.warnings.push('No test directory found');
  }

  // Check for README
  const readmePath = path.join(pluginPath, 'README.md');
  const readmeExists = await fs.access(readmePath).then(() => true).catch(() => false);
  
  if (!readmeExists) {
    results.warnings.push('Missing README.md file');
  }

  // Check for LICENSE
  const licensePath = path.join(pluginPath, 'LICENSE');
  const licenseExists = await fs.access(licensePath).then(() => true).catch(() => false);
  
  if (!licenseExists) {
    results.warnings.push('Missing LICENSE file');
  }
}

// Run validation if called directly
if (require.main === module) {
  const pluginPath = process.argv[2] || process.cwd();
  validatePlugin(pluginPath).then(results => {
    if (!results.valid) {
      process.exit(1);
    }
  }).catch(console.error);
}

module.exports = { validatePlugin, manifestSchema };