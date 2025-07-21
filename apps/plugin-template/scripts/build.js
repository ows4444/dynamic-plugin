#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

async function buildPlugin(pluginPath = process.cwd()) {
  console.log(chalk.blue.bold('\n🔨 Building Plugin...\n'));

  try {
    // Check if we're in a plugin directory
    const manifestPath = path.join(pluginPath, 'plugin.manifest.json');
    const packagePath = path.join(pluginPath, 'package.json');

    const [manifestExists, packageExists] = await Promise.all([
      fs.access(manifestPath).then(() => true).catch(() => false),
      fs.access(packagePath).then(() => true).catch(() => false),
    ]);

    if (!manifestExists || !packageExists) {
      console.error(chalk.red('❌ Not a plugin directory. Missing plugin.manifest.json or package.json'));
      process.exit(1);
    }

    // Load plugin info
    const [manifest, packageJson] = await Promise.all([
      fs.readFile(manifestPath, 'utf-8').then(JSON.parse),
      fs.readFile(packagePath, 'utf-8').then(JSON.parse),
    ]);

    console.log(chalk.cyan(`Plugin: ${manifest.name}@${manifest.version}`));
    console.log(chalk.gray(`Description: ${manifest.description}`));
    console.log(chalk.gray(`Type: ${manifest.pluginType}\n`));

    // Install dependencies if node_modules doesn't exist
    const nodeModulesExists = await fs.access(path.join(pluginPath, 'node_modules'))
      .then(() => true).catch(() => false);

    if (!nodeModulesExists) {
      console.log(chalk.yellow('📦 Installing dependencies...'));
      execSync('npm install', { 
        cwd: pluginPath, 
        stdio: 'inherit' 
      });
    }

    // Run TypeScript compilation
    console.log(chalk.yellow('🔧 Compiling TypeScript...'));
    execSync('npx tsc', { 
      cwd: pluginPath, 
      stdio: 'inherit' 
    });

    // Run tests
    console.log(chalk.yellow('🧪 Running tests...'));
    try {
      execSync('npm test', { 
        cwd: pluginPath, 
        stdio: 'inherit' 
      });
    } catch (error) {
      console.log(chalk.orange('⚠️  Tests failed, but continuing build...'));
    }

    // Copy manifest to dist
    const distManifestPath = path.join(pluginPath, 'dist', 'plugin.manifest.json');
    await fs.mkdir(path.dirname(distManifestPath), { recursive: true });
    await fs.copyFile(manifestPath, distManifestPath);

    // Copy package.json to dist
    const distPackagePath = path.join(pluginPath, 'dist', 'package.json');
    await fs.copyFile(packagePath, distPackagePath);

    console.log(chalk.green.bold('\n✅ Plugin built successfully!\n'));
    console.log(chalk.gray('Built files:'));
    console.log(chalk.gray('  - dist/'));
    console.log(chalk.gray('  - dist/plugin.manifest.json'));
    console.log(chalk.gray('  - dist/package.json'));

  } catch (error) {
    console.error(chalk.red.bold('\n❌ Build failed:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

// Run build if called directly
if (require.main === module) {
  const pluginPath = process.argv[2] || process.cwd();
  buildPlugin(pluginPath).catch(console.error);
}

module.exports = { buildPlugin };