import * as path from 'path';
import * as webpack from 'webpack';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';

export interface PluginWebpackOptions {
  pluginName: string;
  pluginPath: string;
  outputPath?: string;
  mode?: 'development' | 'production';
  target?: 'node' | 'web';
  externals?: Record<string, string>;
  minify?: boolean;
  sourceMaps?: boolean;
}

export class PluginWebpackConfigBuilder {
  createConfig(options: PluginWebpackOptions): webpack.Configuration {
    const {
      pluginName,
      pluginPath,
      outputPath = path.join(pluginPath, 'dist'),
      mode = 'production',
      target = 'node',
      externals = {},
      minify = true,
      sourceMaps = false,
    } = options;

    const manifestPath = path.join(pluginPath, 'plugin.manifest.json');
    const packagePath = path.join(pluginPath, 'package.json');

    const config: webpack.Configuration = {
      mode,
      target,
      
      entry: this.resolveEntry(pluginPath),
      
      output: {
        path: outputPath,
        filename: `${pluginName}.bundle.js`,
        library: {
          name: pluginName,
          type: 'commonjs2',
        },
        clean: true,
      },

      resolve: {
        extensions: ['.ts', '.js', '.json'],
        alias: {
          '@': path.join(pluginPath, 'src'),
          '@config': path.join(pluginPath, 'config'),
        },
      },

      module: {
        rules: [
          {
            test: /\.ts$/,
            use: [
              {
                loader: 'ts-loader',
                options: {
                  configFile: path.join(pluginPath, 'tsconfig.json'),
                  transpileOnly: true,
                },
              },
            ],
            exclude: /node_modules/,
          },
          {
            test: /\.js$/,
            use: ['babel-loader'],
            exclude: /node_modules/,
          },
          {
            test: /\.json$/,
            type: 'json',
          },
        ],
      },

      externals: {
        // Common Node.js modules that should not be bundled
        'express': 'commonjs2 express',
        '@nestjs/common': 'commonjs2 @nestjs/common',
        '@nestjs/core': 'commonjs2 @nestjs/core',
        'typeorm': 'commonjs2 typeorm',
        'mongoose': 'commonjs2 mongoose',
        'redis': 'commonjs2 redis',
        ...externals,
      },

      plugins: [
        new webpack.DefinePlugin({
          'process.env.NODE_ENV': JSON.stringify(mode),
          'process.env.PLUGIN_NAME': JSON.stringify(pluginName),
        }),

        // Copy manifest and package.json
        new CopyWebpackPlugin({
          patterns: [
            {
              from: manifestPath,
              to: 'plugin.manifest.json',
            },
            {
              from: packagePath,
              to: 'package.json',
            },
          ],
        }),
      ],

      devtool: sourceMaps ? 'source-map' : false,

      optimization: {
        minimize: minify,
        minimizer: minify ? [
          new TerserPlugin({
            terserOptions: {
              compress: {
                drop_console: mode === 'production',
                drop_debugger: mode === 'production',
              },
              mangle: {
                keep_classnames: true,
                keep_fnames: true,
              },
              output: {
                comments: false,
              },
            },
            extractComments: false,
          }),
        ] : [],
        
        splitChunks: false,
        runtimeChunk: false,
      },

      performance: {
        hints: mode === 'production' ? 'warning' : false,
        maxAssetSize: 2 * 1024 * 1024, // 2MB
        maxEntrypointSize: 2 * 1024 * 1024, // 2MB
      },

      stats: {
        colors: true,
        modules: false,
        chunks: false,
        chunkModules: false,
      },
    };

    return config;
  }

  private resolveEntry(pluginPath: string): string {
    const possibleEntries = [
      path.join(pluginPath, 'src', 'index.ts'),
      path.join(pluginPath, 'src', 'main.ts'),
      path.join(pluginPath, 'src', 'plugin.ts'),
      path.join(pluginPath, 'index.ts'),
      path.join(pluginPath, 'main.ts'),
    ];

    for (const entry of possibleEntries) {
      try {
        require.resolve(entry);
        return entry;
      } catch {
        continue;
      }
    }

    // Fallback to manifest main field or src/index.ts
    try {
      const manifest = require(path.join(pluginPath, 'plugin.manifest.json'));
      if (manifest.main) {
        return path.join(pluginPath, manifest.main);
      }
    } catch {
      // Manifest doesn't exist or is invalid
    }

    return path.join(pluginPath, 'src', 'index.ts');
  }
}