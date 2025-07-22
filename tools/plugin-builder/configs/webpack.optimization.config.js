const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const CompressionPlugin = require('compression-webpack-plugin');

/**
 * Optimized webpack configuration for plugin builds
 * Focuses on bundle size reduction, tree shaking, and performance
 */
module.exports = (options = {}) => {
  const {
    entry = './src/index.ts',
    outputPath = './dist',
    pluginName = 'plugin',
    target = 'node',
    mode = 'production',
    analyze = false,
    compression = true,
  } = options;

  const isProduction = mode === 'production';

  return {
    mode,
    target,
    entry,
    
    output: {
      path: path.resolve(outputPath),
      filename: `${pluginName}.bundle.js`,
      library: {
        type: 'commonjs2',
      },
      clean: true,
      pathinfo: false, // Reduce bundle size in production
    },

    resolve: {
      extensions: ['.ts', '.js', '.json'],
      alias: {
        '@': path.resolve('./src'),
        '@lib': path.resolve('../../libs'),
      },
      // Optimize module resolution
      modules: ['node_modules'],
      symlinks: false,
    },

    module: {
      rules: [
        {
          test: /\.ts$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: true, // Faster builds
                compilerOptions: {
                  module: 'esnext', // Enable tree shaking
                  moduleResolution: 'node',
                  target: 'es2020',
                  strict: true,
                  esModuleInterop: true,
                  skipLibCheck: true,
                  forceConsistentCasingInFileNames: true,
                  // Remove type-only imports for better tree shaking
                  importsNotUsedAsValues: 'remove',
                },
              },
            },
          ],
          exclude: /node_modules/,
        },
        {
          test: /\.js$/,
          enforce: 'pre',
          use: ['source-map-loader'],
          exclude: /node_modules/,
        },
      ],
    },

    optimization: {
      minimize: isProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: isProduction, // Remove console logs in production
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.debug', 'console.trace'],
              passes: 2, // Multiple compression passes
            },
            mangle: {
              safari10: true,
            },
            format: {
              comments: false, // Remove comments
            },
          },
          extractComments: false,
        }),
      ],
      
      // Tree shaking configuration
      usedExports: true,
      sideEffects: false,
      
      // Split chunks for better caching (if applicable)
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
          nestjs: {
            test: /[\\/]node_modules[\\/]@nestjs/,
            name: 'nestjs',
            chunks: 'all',
            priority: 20,
          },
        },
      },
    },

    plugins: [
      // Define environment variables
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(mode),
        __PRODUCTION__: isProduction,
        __DEVELOPMENT__: !isProduction,
      }),

      // Ignore moment.js locales to reduce bundle size
      new webpack.IgnorePlugin({
        resourceRegExp: /^\.\/locale$/,
        contextRegExp: /moment$/,
      }),

      // Module concatenation for better tree shaking
      new webpack.optimize.ModuleConcatenationPlugin(),

      // Compression for production builds
      ...(compression && isProduction ? [
        new CompressionPlugin({
          algorithm: 'gzip',
          test: /\.(js|css|html|svg)$/,
          threshold: 8192,
          minRatio: 0.8,
        }),
      ] : []),

      // Bundle analyzer (optional)
      ...(analyze ? [
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: 'bundle-analysis.html',
        }),
      ] : []),
    ],

    externals: {
      // Exclude NestJS core modules (should be provided by host)
      '@nestjs/core': 'commonjs2 @nestjs/core',
      '@nestjs/common': 'commonjs2 @nestjs/common',
      '@nestjs/platform-express': 'commonjs2 @nestjs/platform-express',
      'rxjs': 'commonjs2 rxjs',
      'reflect-metadata': 'commonjs2 reflect-metadata',
      
      // Exclude common Node.js modules
      'fs': 'commonjs2 fs',
      'path': 'commonjs2 path',
      'os': 'commonjs2 os',
      'crypto': 'commonjs2 crypto',
      'http': 'commonjs2 http',
      'https': 'commonjs2 https',
      'util': 'commonjs2 util',
      'events': 'commonjs2 events',
      
      // Exclude large libraries that should be shared
      'lodash': 'commonjs2 lodash',
      'axios': 'commonjs2 axios',
      'moment': 'commonjs2 moment',
    },

    performance: {
      maxEntrypointSize: 512000, // 500KB
      maxAssetSize: 512000,
      hints: isProduction ? 'warning' : false,
    },

    devtool: isProduction ? 'source-map' : 'eval-source-map',

    stats: {
      colors: true,
      hash: false,
      timings: true,
      chunks: false,
      chunkModules: false,
      modules: false,
      children: false,
      version: true,
      warnings: true,
      errors: true,
      errorDetails: true,
      moduleTrace: true,
      usedExports: true,
      providedExports: true,
      optimizationBailout: true,
    },

    cache: {
      type: 'filesystem',
      cacheDirectory: path.resolve('.webpack-cache'),
      buildDependencies: {
        config: [__filename],
      },
    },

    experiments: {
      // Enable top-level await for better async handling
      topLevelAwait: true,
    },
  };
};

/**
 * Preset configurations for different plugin types
 */
module.exports.presets = {
  /**
   * Lightweight plugin configuration
   */
  lightweight: (options = {}) => module.exports({
    ...options,
    optimization: {
      ...module.exports(options).optimization,
      splitChunks: false, // No chunk splitting for lightweight plugins
    },
    performance: {
      maxEntrypointSize: 256000, // 250KB
      maxAssetSize: 256000,
    },
  }),

  /**
   * Feature-rich plugin configuration
   */
  featureRich: (options = {}) => module.exports({
    ...options,
    performance: {
      maxEntrypointSize: 1024000, // 1MB
      maxAssetSize: 1024000,
    },
  }),

  /**
   * Development configuration with hot reloading
   */
  development: (options = {}) => module.exports({
    ...options,
    mode: 'development',
    optimization: {
      minimize: false,
      usedExports: true,
      sideEffects: false,
    },
    devtool: 'eval-cheap-module-source-map',
    cache: {
      type: 'memory',
    },
  }),
};