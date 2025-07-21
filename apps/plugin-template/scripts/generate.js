#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');
const inquirer = require('inquirer');
const chalk = require('chalk');

// Register Handlebars helpers
handlebars.registerHelper('pascalCase', (str) => {
  return str.replace(/(?:^|-)(\w)/g, (match, letter) => letter.toUpperCase()).replace(/-/g, '');
});

handlebars.registerHelper('camelCase', (str) => {
  const pascal = str.replace(/(?:^|-)(\w)/g, (match, letter) => letter.toUpperCase()).replace(/-/g, '');
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
});

handlebars.registerHelper('kebabCase', (str) => {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().replace(/\s+/g, '-');
});

handlebars.registerHelper('JSON.stringify', (obj) => {
  return JSON.stringify(obj, null, 2);
});

const PLUGIN_TYPES = {
  'service': {
    description: 'A service plugin that provides business logic and data processing',
    defaultPermissions: ['database.read', 'database.write', 'cache.read', 'cache.write'],
  },
  'integration': {
    description: 'An integration plugin that connects to external services',
    defaultPermissions: ['network.request', 'cache.read', 'cache.write'],
  },
  'middleware': {
    description: 'A middleware plugin that processes requests and responses',
    defaultPermissions: ['events.listen', 'events.emit'],
  },
  'utility': {
    description: 'A utility plugin that provides helper functions and tools',
    defaultPermissions: ['cache.read'],
  },
  'auth': {
    description: 'An authentication plugin that handles user authentication',
    defaultPermissions: ['database.read', 'database.write', 'network.request'],
  },
};

async function promptForPluginDetails() {
  console.log(chalk.blue.bold('\n🔧 Plugin Generator\n'));
  console.log(chalk.gray('This wizard will help you generate a new plugin from a template.\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Plugin name (kebab-case):',
      validate: (input) => {
        if (!input) return 'Plugin name is required';
        if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(input)) {
          return 'Plugin name must be in kebab-case (e.g., my-awesome-plugin)';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'description',
      message: 'Plugin description:',
      validate: (input) => input ? true : 'Description is required',
    },
    {
      type: 'list',
      name: 'pluginType',
      message: 'Plugin type:',
      choices: Object.entries(PLUGIN_TYPES).map(([key, value]) => ({
        name: `${key} - ${value.description}`,
        value: key,
      })),
    },
    {
      type: 'input',
      name: 'author',
      message: 'Author name:',
      default: process.env.USER ?? process.env.USERNAME ?? 'Unknown',
    },
    {
      type: 'input',
      name: 'version',
      message: 'Initial version:',
      default: '1.0.0',
      validate: (input) => {
        if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(input)) {
          return 'Version must follow semantic versioning (e.g., 1.0.0)';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'apiVersion',
      message: 'Plugin API version:',
      default: '1.0.0',
    },
    {
      type: 'checkbox',
      name: 'features',
      message: 'Select features to include:',
      choices: [
        { name: 'Database integration (TypeORM)', value: 'database' },
        { name: 'Caching support', value: 'cache' },
        { name: 'Configuration service', value: 'config' },
        { name: 'Health check endpoint', value: 'healthCheck' },
        { name: 'Metrics endpoint', value: 'metrics' },
        { name: 'Custom middleware', value: 'middleware' },
        { name: 'Security guards', value: 'guards' },
        { name: 'Lifecycle hooks', value: 'lifecycleHooks' },
      ],
    },
    {
      type: 'checkbox',
      name: 'additionalPermissions',
      message: 'Additional permissions needed:',
      choices: [
        'filesystem.read',
        'filesystem.write',
        'system.env',
        'system.process',
        'events.emit',
        'events.listen',
      ],
    },
    {
      type: 'input',
      name: 'outputPath',
      message: 'Output directory:',
      default: (answers) => `../plugins/${answers.name}`,
    },
  ]);

  // Combine default permissions with additional ones
  const pluginTypePermissions = PLUGIN_TYPES[answers.pluginType].defaultPermissions;
  answers.permissions = [...new Set([...pluginTypePermissions, ...answers.additionalPermissions])];

  // Set feature flags
  answers.useDatabase = answers.features.includes('database');
  answers.useCache = answers.features.includes('cache');
  answers.includeConfig = answers.features.includes('config');
  answers.includeHealthCheck = answers.features.includes('healthCheck');
  answers.includeMetrics = answers.features.includes('metrics');
  answers.includeMiddleware = answers.features.includes('middleware');
  answers.includeGuards = answers.features.includes('guards');
  answers.includeLifecycleHooks = answers.features.includes('lifecycleHooks');
  answers.isPlugin = true;

  // Set dependencies based on features
  answers.dependencies = {
    '@nestjs/common': '^10.0.0',
    '@nestjs/core': '^10.0.0',
    'reflect-metadata': '^0.1.13',
    'rxjs': '^7.8.0',
  };

  if (answers.useDatabase) {
    answers.dependencies['@nestjs/typeorm'] = '^10.0.0';
    answers.dependencies['typeorm'] = '^0.3.0';
  }

  if (answers.useCache) {
    answers.dependencies['@nestjs/cache-manager'] = '^2.0.0';
    answers.dependencies['cache-manager'] = '^5.0.0';
  }

  if (answers.includeConfig) {
    answers.dependencies['@nestjs/config'] = '^3.0.0';
  }

  return answers;
}

async function generateFromTemplate(templatePath, outputPath, context) {
  try {
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const template = handlebars.compile(templateContent);
    const generated = template(context);
    
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, generated);
    
    console.log(chalk.green(`✓ Generated: ${path.relative(process.cwd(), outputPath)}`));
  } catch (error) {
    console.error(chalk.red(`✗ Failed to generate ${outputPath}: ${error.message}`));
    throw error;
  }
}

async function generatePlugin(answers) {
  const { name, outputPath } = answers;
  const absoluteOutputPath = path.resolve(outputPath);
  const templatesDir = path.join(__dirname, '..', 'templates');
  
  console.log(chalk.blue(`\n📁 Creating plugin in: ${absoluteOutputPath}\n`));

  try {
    // Ensure output directory exists
    await fs.mkdir(absoluteOutputPath, { recursive: true });

    // Create directory structure
    const directories = [
      'src',
      'src/dto',
      'src/interfaces',
      'src/entities',
      'src/guards',
      'src/middleware',
      'src/config',
      'test',
      'test/unit',
      'test/e2e',
    ];

    for (const dir of directories) {
      await fs.mkdir(path.join(absoluteOutputPath, dir), { recursive: true });
    }

    // Generate main files from templates
    const templateFiles = [
      {
        template: 'controller.template.ts',
        output: `src/${answers.kebabCase || name}.controller.ts`,
      },
      {
        template: 'service.template.ts',
        output: `src/${answers.kebabCase || name}.service.ts`,
      },
      {
        template: 'module.template.ts',
        output: `src/${answers.kebabCase || name}.module.ts`,
      },
    ];

    // Generate from templates
    for (const { template, output } of templateFiles) {
      const templatePath = path.join(templatesDir, template);
      const outputFilePath = path.join(absoluteOutputPath, output);
      await generateFromTemplate(templatePath, outputFilePath, answers);
    }

    // Generate additional files
    await generateAdditionalFiles(absoluteOutputPath, answers);

    console.log(chalk.green.bold('\n✅ Plugin generated successfully!\n'));
    console.log(chalk.yellow('Next steps:'));
    console.log(chalk.gray(`  1. cd ${outputPath}`));
    console.log(chalk.gray('  2. npm install'));
    console.log(chalk.gray('  3. npm run build'));
    console.log(chalk.gray('  4. npm run test'));
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Failed to generate plugin:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

async function generateAdditionalFiles(outputPath, answers) {
  const { name } = answers;
  
  // Generate package.json
  const packageJson = {
    name: `@plugins/${name}`,
    version: answers.version,
    description: answers.description,
    main: `dist/${name}.module.js`,
    scripts: {
      build: 'tsc',
      'build:watch': 'tsc --watch',
      test: 'jest',
      'test:watch': 'jest --watch',
      'test:cov': 'jest --coverage',
      lint: 'eslint src --ext .ts',
      'lint:fix': 'eslint src --ext .ts --fix',
    },
    dependencies: answers.dependencies,
    devDependencies: {
      '@nestjs/testing': '^10.0.0',
      '@types/jest': '^29.0.0',
      '@types/node': '^20.0.0',
      '@typescript-eslint/eslint-plugin': '^6.0.0',
      '@typescript-eslint/parser': '^6.0.0',
      'eslint': '^8.0.0',
      'jest': '^29.0.0',
      'ts-jest': '^29.0.0',
      'typescript': '^5.0.0',
    },
    author: answers.author,
    license: 'MIT',
    keywords: ['plugin', 'nestjs', answers.pluginType],
  };

  await fs.writeFile(
    path.join(outputPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Generate plugin.manifest.json
  const manifest = {
    name,
    version: answers.version,
    description: answers.description,
    author: answers.author,
    license: 'MIT',
    pluginType: answers.pluginType,
    apiVersion: answers.apiVersion,
    main: `dist/${name}.module.js`,
    permissions: answers.permissions,
    engines: {
      host: '>=1.0.0',
      node: '>=18.0.0',
    },
    keywords: ['plugin', 'nestjs', answers.pluginType],
    routes: [
      {
        path: `/${name}`,
        method: 'GET',
        handler: 'findAll',
      },
      {
        path: `/${name}/:id`,
        method: 'GET',
        handler: 'findOne',
      },
      {
        path: `/${name}`,
        method: 'POST',
        handler: 'create',
      },
      {
        path: `/${name}/:id`,
        method: 'PUT',
        handler: 'update',
      },
      {
        path: `/${name}/:id`,
        method: 'DELETE',
        handler: 'remove',
      },
    ],
  };

  if (answers.includeHealthCheck) {
    manifest.routes.push({
      path: `/${name}/health/check`,
      method: 'GET',
      handler: 'healthCheck',
    });
  }

  if (answers.includeMetrics) {
    manifest.routes.push({
      path: `/${name}/metrics/stats`,
      method: 'GET',
      handler: 'getStats',
    });
  }

  await fs.writeFile(
    path.join(outputPath, 'plugin.manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  // Generate TypeScript config
  const tsConfig = {
    compilerOptions: {
      module: 'commonjs',
      declaration: true,
      removeComments: true,
      emitDecoratorMetadata: true,
      experimentalDecorators: true,
      allowSyntheticDefaultImports: true,
      target: 'ES2020',
      sourceMap: true,
      outDir: './dist',
      baseUrl: './',
      incremental: true,
      skipLibCheck: true,
      strictNullChecks: false,
      noImplicitAny: false,
      strictBindCallApply: false,
      forceConsistentCasingInFileNames: false,
      noFallthroughCasesInSwitch: false,
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist', 'test'],
  };

  await fs.writeFile(
    path.join(outputPath, 'tsconfig.json'),
    JSON.stringify(tsConfig, null, 2)
  );

  // Generate README.md
  const readme = `# ${answers.name.charAt(0).toUpperCase() + answers.name.slice(1)} Plugin

${answers.description}

## Features

${answers.features.map(feature => `- ${feature}`).join('\n')}

## Installation

\`\`\`bash
npm install
npm run build
\`\`\`

## Usage

This plugin provides the following endpoints:

- \`GET /${name}\` - List all items
- \`GET /${name}/:id\` - Get a specific item
- \`POST /${name}\` - Create a new item
- \`PUT /${name}/:id\` - Update an item
- \`DELETE /${name}/:id\` - Delete an item
${answers.includeHealthCheck ? `- \`GET /${name}/health/check\` - Health check` : ''}
${answers.includeMetrics ? `- \`GET /${name}/metrics/stats\` - Get statistics` : ''}

## Configuration

Configure the plugin by setting environment variables or updating the configuration service.

## Development

\`\`\`bash
# Run tests
npm test

# Run linter
npm run lint

# Build the plugin
npm run build
\`\`\`

## License

MIT
`;

  await fs.writeFile(path.join(outputPath, 'README.md'), readme);

  console.log(chalk.green('✓ Generated: package.json'));
  console.log(chalk.green('✓ Generated: plugin.manifest.json'));
  console.log(chalk.green('✓ Generated: tsconfig.json'));
  console.log(chalk.green('✓ Generated: README.md'));
}

async function main() {
  try {
    const answers = await promptForPluginDetails();
    await generatePlugin(answers);
  } catch (error) {
    if (error.isTtyError) {
      console.error(chalk.red('Could not render prompt in this environment'));
    } else {
      console.error(chalk.red('An error occurred:'), error.message);
    }
    process.exit(1);
  }
}

// Run the generator
if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

module.exports = {
  generatePlugin,
  promptForPluginDetails,
};