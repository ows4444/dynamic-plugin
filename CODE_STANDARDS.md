# Code Standards & Configuration

This document outlines the code standards, linting, and formatting configuration for the Dynamic Plugin System project.

## 🔧 Code Quality Tools

### ESLint Configuration
- **Config File**: `eslint.config.mjs` (ESLint v9+ flat config)
- **TypeScript Support**: Full TypeScript type checking enabled
- **Framework**: Optimized for NestJS development
- **Plugin Security**: Special rules for plugin development security

### Prettier Configuration  
- **Config File**: `.prettierrc`
- **Consistent Formatting**: Automated code formatting on save
- **File Type Support**: TypeScript, JSON, Markdown, YAML, Shell scripts
- **Monorepo Optimized**: Different settings for different file types

## 📋 Key Rules & Standards

### TypeScript Rules
- ✅ **Type Safety**: Strict TypeScript checking enabled
- ⚠️ **`any` Usage**: Warnings for explicit `any` usage (allowed in tests)
- 🚫 **Unsafe Operations**: Errors for unsafe TypeScript operations
- ✅ **Modern Syntax**: Prefer nullish coalescing (`??`) over logical OR (`||`)
- ✅ **Optional Chaining**: Enforce optional chaining where applicable

### NestJS Specific
- ✅ **Parameter Properties**: Allowed for dependency injection
- ✅ **Empty Constructors**: Allowed for NestJS services
- ✅ **Decorators**: Full decorator support

### Security Rules (Plugin Development)
- 🚫 **`eval()`**: Prohibited
- 🚫 **`new Function()`**: Prohibited  
- 🚫 **Dynamic Imports**: Restricted
- 🚫 **Script URLs**: Prohibited

### Code Organization
- ✅ **Import Sorting**: Automatic import organization
- ✅ **Consistent Naming**: Enforced naming conventions
- ✅ **Error Handling**: Proper error throwing patterns

## 🎯 VS Code Integration

### Required Extensions
- **ESLint**: `dbaeumer.vscode-eslint`
- **Prettier**: `esbenp.prettier-vscode`
- **TypeScript**: `ms-vscode.vscode-typescript-next`
- **Error Lens**: `usernamehw.errorlens` (recommended)

### Auto-formatting
- **Format on Save**: Enabled
- **Auto Import Organization**: Enabled
- **ESLint Auto-fix**: Enabled on save

## 📁 File Structure Standards

### Ignore Patterns
```
# Build outputs
dist/
node_modules/

# Plugin storage (runtime)
apps/plugin-host/plugins/
apps/plugin-registry/storage/

# Environment files
.env*

# Generated files
*.d.ts.map
*.tsbuildinfo
```

### File Naming
- **TypeScript Files**: `kebab-case.ts`
- **Test Files**: `*.spec.ts` or `*.test.ts`
- **Config Files**: `*.config.ts`
- **Interface Files**: `*.interface.ts`

## 🚀 Development Workflow

### Pre-commit Checks
```bash
# Lint and auto-fix
npm run lint

# Format code  
npm run format

# Run tests
npm test

# Build project
npm run build
```

### Debugging
- **Plugin Host**: Debug configuration included
- **Plugin Registry**: Debug configuration included
- **Plugin Builder**: Debug configuration included
- **Tests**: Debug current file or all tests

## 📊 Code Quality Metrics

### ESLint Rules Summary
- **Errors**: 275 rules that must be fixed
- **Warnings**: 715 rules that should be addressed
- **Security**: 8+ security-specific rules
- **TypeScript**: 15+ TypeScript-specific rules

### Formatting Standards
- **Line Width**: 80 characters
- **Indentation**: 2 spaces
- **Quotes**: Single quotes for strings
- **Semicolons**: Required
- **Trailing Commas**: Always

## 🔄 Continuous Integration

### Recommended CI Steps
1. **Install Dependencies**: `npm ci`
2. **Lint Check**: `npm run lint`
3. **Format Check**: `npx prettier --check .`
4. **Type Check**: `npm run build`
5. **Run Tests**: `npm test`

## 🎨 File-Specific Overrides

### JSON Files
- **Line Width**: 120 characters
- **Tab Width**: 2 spaces

### Markdown Files  
- **Line Width**: 100 characters
- **Prose Wrap**: Always
- **Tab Width**: 2 spaces

### Shell Scripts
- **Tab Width**: 4 spaces
- **No Tabs**: Use spaces only

### Test Files
- **Relaxed Rules**: `any` usage allowed
- **Console Logs**: Allowed in tests
- **Unsafe Operations**: Warnings only

## 🛠 Maintenance

### Updating Dependencies
```bash
# Update ESLint
npm update @typescript-eslint/eslint-plugin @typescript-eslint/parser

# Update Prettier  
npm update prettier

# Update NestJS
npm update @nestjs/core @nestjs/common
```

### Custom Rules
Add project-specific rules in `eslint.config.mjs`:
```javascript
{
  rules: {
    // Your custom rules here
  }
}
```

## 📚 References

- [ESLint Configuration Guide](https://eslint.org/docs/latest/use/configure/)
- [TypeScript ESLint Rules](https://typescript-eslint.io/rules/)
- [Prettier Configuration](https://prettier.io/docs/en/configuration.html)
- [NestJS Style Guide](https://docs.nestjs.com/)

---

This configuration ensures consistent, secure, and maintainable code across the entire Dynamic Plugin System project.