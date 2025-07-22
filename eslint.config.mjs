// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'eslint.config.mjs',
      '**/*.template.ts',
      'dist/**/*',
      'node_modules/**/*',
      'coverage/**/*',
      '**/*.js',
      'webpack.config.js',
      'jest.config.js',
      'apps/*/dist/**/*',
      'libs/*/dist/**/*',
      'tools/*/dist/**/*',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
        ...globals.browser, // For plugin development
      },
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // TypeScript-specific rules
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'warn',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      
      // Enhanced TypeScript rules for better type safety
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-meaningless-void-operator': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/prefer-readonly-parameter-types': 'off', // Too strict for NestJS
      '@typescript-eslint/no-confusing-void-expression': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'error',
      
      // NestJS specific rules
      '@typescript-eslint/parameter-properties': 'off',
      '@typescript-eslint/no-empty-function': ['error', { allow: ['constructors'] }],
      
      // General rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'no-duplicate-imports': 'error',
      'no-useless-constructor': 'off', // TypeScript handles this
      
      // Plugin development specific security rules
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-implied-eval': 'error',
      'no-script-url': 'error',
      'no-caller': 'error',
      'no-extend-native': 'error',
      'no-extra-bind': 'error',
      'no-invalid-this': 'error',
      'no-multi-spaces': 'error',
      'no-multi-str': 'error',
      'no-global-assign': 'error',
      
      // Import ordering (note: requires eslint-plugin-import to be installed)
      // 'import/order': ['error', {
      //   'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      //   'pathGroups': [
      //     { 'pattern': '@app/**', 'group': 'internal' },
      //     { 'pattern': '@lib/**', 'group': 'internal' },
      //     { 'pattern': '@shared/**', 'group': 'internal' },
      //     { 'pattern': '@domain/**', 'group': 'internal' }
      //   ],
      //   'newlines-between': 'always',
      //   'alphabetize': { 'order': 'asc', 'caseInsensitive': true }
      // }],
      
      // Naming conventions
      '@typescript-eslint/naming-convention': [
        'error',
        { 'selector': 'interface', 'format': ['PascalCase'] },
        { 'selector': 'typeAlias', 'format': ['PascalCase'] },
        { 'selector': 'class', 'format': ['PascalCase'] },
        { 'selector': 'method', 'format': ['camelCase'] },
        { 'selector': 'property', 'format': ['camelCase'] },
        { 'selector': 'variable', 'format': ['camelCase', 'UPPER_CASE'] },
        { 'selector': 'parameter', 'format': ['camelCase'], 'leadingUnderscore': 'allow' },
        { 'selector': 'enumMember', 'format': ['UPPER_CASE'] }
      ],
      
      // Code organization  
      'sort-imports': ['error', {
        ignoreCase: true,
        ignoreDeclarationSort: true,
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
        allowSeparatedGroups: true,
      }],
      
      // Error handling
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'error',
      
      // Performance
      'no-await-in-loop': 'warn',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      'no-undef': 'off', // TypeScript handles this
    },
  },
);