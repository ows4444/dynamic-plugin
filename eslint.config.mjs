// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'eslint.config.mjs',
      'scripts/**',
      'dist/**',
      'node_modules/**',
      'jest.*.js',
      'src/**/*.spec.ts',
      'src/**/*.test.ts',
      '*.test.ts',
      'test/**',
      'tests/**',
      'coverage/**',
      '**/*.d.ts',
      'build/**',
      '*.config.js',
      '*.config.ts',
      'migrations/**',
      'seeds/**',
    ],
  },

  // Base configurations
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  eslintPluginPrettierRecommended,

  // Language options
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
        ...globals.es2023,
      },
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Main rules configuration
  {
    rules: {
      // Prettier integration
      'prettier/prettier': [
        'error',
        {
          singleQuote: true,
          trailingComma: 'all',
          printWidth: 200,
          semi: true,
          tabWidth: 2,
          useTabs: false,
        },
      ],

      // TypeScript specific rules - Balanced for productivity
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',

      // Variable and function rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-duplicate-enum-values': 'error',

      // Type annotation rules
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        {
          assertionStyle: 'as',
          objectLiteralTypeAssertions: 'allow-as-parameter',
        },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],

      // NestJS specific rules - Relaxed for development
      '@typescript-eslint/explicit-function-return-type': 'off', // Too strict for NestJS
      '@typescript-eslint/explicit-member-accessibility': 'off', // Too verbose

      // Code quality rules
      '@typescript-eslint/prefer-readonly': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/prefer-string-starts-ends-with': 'warn',
      '@typescript-eslint/prefer-includes': 'warn',
      '@typescript-eslint/prefer-for-of': 'warn',
      '@typescript-eslint/prefer-function-type': 'warn',

      // Error handling
      '@typescript-eslint/prefer-promise-reject-errors': 'error',

      // Array and object rules
      '@typescript-eslint/array-type': ['error', { default: 'array' }],

      // Naming conventions - Practical for NestJS
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'forbid',
        },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'], // Allow PascalCase for class references
          leadingUnderscore: 'allow',
        },
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'function',
          format: ['camelCase'],
        },
        {
          selector: 'method',
          format: ['camelCase'],
        },
        {
          selector: 'property',
          format: ['camelCase', 'snake_case'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'class',
          format: ['PascalCase'],
        },
        {
          selector: 'interface',
          format: ['PascalCase'],
        },
        {
          selector: 'typeAlias',
          format: ['PascalCase'],
        },
        {
          selector: 'enum',
          format: ['PascalCase'],
        },
        {
          selector: 'enumMember',
          format: ['UPPER_CASE'],
        },
        {
          selector: 'typeParameter',
          format: ['PascalCase'],
        },
      ],

      // General JavaScript/TypeScript rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',

      // Import rules
      'sort-imports': [
        'error',
        {
          ignoreCase: true,
          ignoreDeclarationSort: true,
          ignoreMemberSort: false,
          memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
        },
      ],

      // Code style rules
      'prefer-const': 'error',
      'prefer-template': 'error',
      'object-shorthand': 'error',
      'quote-props': ['error', 'as-needed'],

      // Security rules
      'no-script-url': 'error',

      // Performance rules
      'no-await-in-loop': 'warn',
      'prefer-promise-reject-errors': 'error',

      // Complexity rules - Relaxed for complex validation logic
      'complexity': ['warn', 40],
      'max-depth': ['warn', 5],
      'max-lines': ['warn', 800],
      'max-lines-per-function': ['warn', 200],
      'max-params': ['warn', 10],
    },
  },

  // Test-specific overrides
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-member-accessibility': 'off',
      'max-lines-per-function': 'off',
      'max-lines': 'off',
      'no-console': 'off',
      'complexity': 'off',
    },
  },

  // Configuration files overrides
  {
    files: ['*.config.js', '*.config.ts', '*.config.mjs'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      'no-console': 'off',
    },
  },

  // Migration and seed files
  {
    files: ['**/migrations/**/*.ts', '**/seeds/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'max-lines': 'off',
    },
  },

  // Entity/Schema files - relaxed rules for data structures
  {
    files: ['**/*.entity.ts', '**/*.schema.ts', '**/*.dto.ts'],
    rules: {
      '@typescript-eslint/explicit-member-accessibility': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
    },
  },

  // Main application files - allow some flexibility
  {
    files: ['src/main.ts', 'src/app.*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },

  // Pipeline and service files - allow complex logic
  {
    files: ['**/pipelines/**/*.ts', '**/services/**/*.ts'],
    rules: {
      'complexity': ['warn', 25],
      'max-lines-per-function': ['warn', 200],
    },
  },
);
