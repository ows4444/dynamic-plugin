import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as typescript from 'typescript';

export interface TreeShakingAnalysis {
  totalExports: number;
  usedExports: number;
  unusedExports: string[];
  sideEffectModules: string[];
  circularDependencies: string[];
  recommendations: string[];
  shakeabilityScore: number; // 0-100
}

export interface ModuleExport {
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'const' | 'enum';
  isUsed: boolean;
  importedBy: string[];
  file: string;
  hasTypeOnlyUsage: boolean;
}

@Injectable()
export class TreeShakingAnalyzer {
  private readonly logger = new Logger(TreeShakingAnalyzer.name);

  /**
   * Analyze tree shaking potential for a plugin
   */
  async analyzeTreeShaking(projectRoot: string): Promise<TreeShakingAnalysis> {
    this.logger.log('Starting tree shaking analysis');

    try {
      const sourceFiles = await this.findSourceFiles(projectRoot);
      const exports = await this.extractExports(sourceFiles);
      await this.analyzeUsage(sourceFiles, exports);
      const sideEffects = await this.detectSideEffects(sourceFiles);
      const circularDeps = await this.detectCircularDependencies(sourceFiles);

      const unusedExports = exports
        .filter(exp => !exp.isUsed && !exp.hasTypeOnlyUsage)
        .map(exp => `${exp.name} (${exp.file})`);

      const shakeabilityScore = this.calculateShakeabilityScore(exports, sideEffects, circularDeps);

      const recommendations = this.generateRecommendations(exports, sideEffects, circularDeps);

      return {
        totalExports: exports.length,
        usedExports: exports.filter(exp => exp.isUsed).length,
        unusedExports,
        sideEffectModules: sideEffects,
        circularDependencies: circularDeps,
        recommendations,
        shakeabilityScore,
      };
    } catch (error) {
      this.logger.error('Tree shaking analysis failed', error);
      throw error;
    }
  }

  /**
   * Generate optimized package.json sideEffects configuration
   */
  async generateSideEffectsConfig(projectRoot: string): Promise<{
    sideEffects: boolean | string[];
    recommendations: string[];
  }> {
    const analysis = await this.analyzeTreeShaking(projectRoot);
    
    if (analysis.sideEffectModules.length === 0) {
      return {
        sideEffects: false,
        recommendations: ['Set "sideEffects": false for optimal tree shaking'],
      };
    }

    // Convert absolute paths to relative patterns
    const sideEffectPatterns = analysis.sideEffectModules.map(module => {
      const relativePath = path.relative(projectRoot, module);
      return relativePath.replace(/\\/g, '/'); // Normalize path separators
    });

    return {
      sideEffects: sideEffectPatterns,
      recommendations: [
        'Configure specific side effect files for better tree shaking',
        'Consider removing side effects from these modules if possible',
      ],
    };
  }

  /**
   * Optimize imports for better tree shaking
   */
  async optimizeImports(filePath: string): Promise<{
    originalImports: string[];
    optimizedImports: string[];
    savings: number;
  }> {
    const content = await fs.readFile(filePath, 'utf-8');
    const sourceFile = typescript.createSourceFile(
      filePath,
      content,
      typescript.ScriptTarget.Latest,
      true,
    );

    const originalImports: string[] = [];
    const optimizedImports: string[] = [];

    const visit = (node: typescript.Node) => {
      if (typescript.isImportDeclaration(node)) {
        const originalImport = node.getFullText().trim();
        originalImports.push(originalImport);

        const optimized = this.optimizeImportStatement(node);
        if (optimized !== originalImport) {
          optimizedImports.push(optimized);
        }
      }
      
      typescript.forEachChild(node, visit);
    };

    visit(sourceFile);

    return {
      originalImports,
      optimizedImports,
      savings: originalImports.length - optimizedImports.length,
    };
  }

  private async findSourceFiles(projectRoot: string): Promise<string[]> {
    const files: string[] = [];
    
    const searchDir = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await searchDir(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
          files.push(fullPath);
        }
      }
    };

    await searchDir(path.join(projectRoot, 'src'));
    return files;
  }

  private async extractExports(sourceFiles: string[]): Promise<ModuleExport[]> {
    const exports: ModuleExport[] = [];

    for (const filePath of sourceFiles) {
      const content = await fs.readFile(filePath, 'utf-8');
      const sourceFile = typescript.createSourceFile(
        filePath,
        content,
        typescript.ScriptTarget.Latest,
        true,
      );

      const visit = (node: typescript.Node) => {
        // Function exports
        if (typescript.isFunctionDeclaration(node) && this.hasExportModifier(node)) {
          exports.push({
            name: node.name?.text ?? 'anonymous',
            type: 'function',
            isUsed: false,
            importedBy: [],
            file: filePath,
            hasTypeOnlyUsage: false,
          });
        }

        // Class exports
        if (typescript.isClassDeclaration(node) && this.hasExportModifier(node)) {
          exports.push({
            name: node.name?.text ?? 'anonymous',
            type: 'class',
            isUsed: false,
            importedBy: [],
            file: filePath,
            hasTypeOnlyUsage: false,
          });
        }

        // Interface exports
        if (typescript.isInterfaceDeclaration(node) && this.hasExportModifier(node)) {
          exports.push({
            name: node.name.text,
            type: 'interface',
            isUsed: false,
            importedBy: [],
            file: filePath,
            hasTypeOnlyUsage: true, // Interfaces are type-only
          });
        }

        // Variable/const exports
        if (typescript.isVariableStatement(node) && this.hasExportModifier(node)) {
          for (const declaration of node.declarationList.declarations) {
            if (typescript.isIdentifier(declaration.name)) {
              exports.push({
                name: declaration.name.text,
                type: (node.declarationList.flags & typescript.NodeFlags.Const) ? 'const' : 'variable',
                isUsed: false,
                importedBy: [],
                file: filePath,
                hasTypeOnlyUsage: false,
              });
            }
          }
        }

        // Enum exports
        if (typescript.isEnumDeclaration(node) && this.hasExportModifier(node)) {
          exports.push({
            name: node.name.text,
            type: 'enum',
            isUsed: false,
            importedBy: [],
            file: filePath,
            hasTypeOnlyUsage: false,
          });
        }

        typescript.forEachChild(node, visit);
      };

      visit(sourceFile);
    }

    return exports;
  }

  private async analyzeUsage(sourceFiles: string[], exports: ModuleExport[]): Promise<void> {
    for (const filePath of sourceFiles) {
      const content = await fs.readFile(filePath, 'utf-8');
      const sourceFile = typescript.createSourceFile(
        filePath,
        content,
        typescript.ScriptTarget.Latest,
        true,
      );

      const visit = (node: typescript.Node) => {
        // Analyze import declarations
        if (typescript.isImportDeclaration(node)) {
          this.analyzeImportUsage(node, exports, filePath);
        }

        // Analyze identifier usage
        if (typescript.isIdentifier(node)) {
          const exportItem = exports.find(exp => exp.name === node.text);
          if (exportItem && exportItem.file !== filePath) {
            exportItem.isUsed = true;
            if (!exportItem.importedBy.includes(filePath)) {
              exportItem.importedBy.push(filePath);
            }
          }
        }

        typescript.forEachChild(node, visit);
      };

      visit(sourceFile);
    }
  }

  private analyzeImportUsage(
    importNode: typescript.ImportDeclaration,
    exports: ModuleExport[],
    filePath: string,
  ): void {
    if (!importNode.importClause) return;

    // Handle named imports
    if (importNode.importClause.namedBindings && 
        typescript.isNamedImports(importNode.importClause.namedBindings)) {
      
      for (const element of importNode.importClause.namedBindings.elements) {
        const importName = element.name.text;
        const exportItem = exports.find(exp => exp.name === importName);
        
        if (exportItem) {
          exportItem.isUsed = true;
          if (!exportItem.importedBy.includes(filePath)) {
            exportItem.importedBy.push(filePath);
          }
        }
      }
    }

    // Handle default imports
    if (importNode.importClause.name) {
      // Default imports are harder to track without module resolution
      // This is a simplified implementation
    }
  }

  private async detectSideEffects(sourceFiles: string[]): Promise<string[]> {
    const sideEffectModules: string[] = [];

    for (const filePath of sourceFiles) {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Simple heuristics for side effects
      const hasSideEffects = 
        content.includes('console.') ||
        content.includes('document.') ||
        content.includes('window.') ||
        content.includes('global.') ||
        content.includes('process.') ||
        content.includes('require(') ||
        content.includes('import(') ||
        /\w+\(\)/.test(content.split('\n')[0] ?? ''); // Top-level function calls

      if (hasSideEffects) {
        sideEffectModules.push(filePath);
      }
    }

    return sideEffectModules;
  }

  private async detectCircularDependencies(sourceFiles: string[]): Promise<string[]> {
    // Simplified circular dependency detection
    // A full implementation would build a dependency graph
    const dependencies = new Map<string, string[]>();
    
    for (const filePath of sourceFiles) {
      const content = await fs.readFile(filePath, 'utf-8');
      const imports = this.extractImportPaths(content, filePath);
      dependencies.set(filePath, imports);
    }

    const circular: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (file: string, path: string[]): void => {
      if (visiting.has(file)) {
        circular.push(`Circular dependency: ${path.join(' -> ')} -> ${file}`);
        return;
      }

      if (visited.has(file)) return;

      visiting.add(file);
      const deps = dependencies.get(file) ?? [];
      
      for (const dep of deps) {
        visit(dep, [...path, file]);
      }
      
      visiting.delete(file);
      visited.add(file);
    };

    for (const file of sourceFiles) {
      if (!visited.has(file)) {
        visit(file, []);
      }
    }

    return circular;
  }

  private extractImportPaths(content: string, currentFile: string): string[] {
    const importRegex = /import.*from\s+['"`]([^'"`]+)['"`]/g;
    const imports: string[] = [];
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      
      // Convert relative imports to absolute paths
      if ((importPath != null) && (importPath.startsWith('./') || importPath.startsWith('../'))) {
        const absolutePath = path.resolve(path.dirname(currentFile), importPath);
        imports.push(absolutePath);
      }
    }

    return imports;
  }

  private hasExportModifier(node: typescript.Node): boolean {
    const nodeWithModifiers = node as typescript.Node & { modifiers?: typescript.ModifiersArray };
    return nodeWithModifiers.modifiers?.some((mod: typescript.Modifier) => mod.kind === typescript.SyntaxKind.ExportKeyword) ?? false;
  }

  private optimizeImportStatement(importNode: typescript.ImportDeclaration): string {
    // This would contain logic to optimize import statements
    // For example, converting default imports to named imports where beneficial
    return importNode.getFullText().trim();
  }

  private calculateShakeabilityScore(
    exports: ModuleExport[],
    sideEffects: string[],
    circularDeps: string[],
  ): number {
    const totalExports = exports.length;
    const usedExports = exports.filter(exp => exp.isUsed).length;
    const unusedExports = totalExports - usedExports;

    // Calculate base score from unused exports
    const unusedRatio = totalExports > 0 ? unusedExports / totalExports : 0;
    let score = unusedRatio * 70; // Max 70 points for unused exports

    // Bonus points for no side effects
    if (sideEffects.length === 0) {
      score += 20;
    } else {
      score += Math.max(0, 20 - (sideEffects.length * 5));
    }

    // Bonus points for no circular dependencies
    if (circularDeps.length === 0) {
      score += 10;
    } else {
      score += Math.max(0, 10 - (circularDeps.length * 2));
    }

    return Math.min(100, Math.max(0, score));
  }

  private generateRecommendations(
    exports: ModuleExport[],
    sideEffects: string[],
    circularDeps: string[],
  ): string[] {
    const recommendations: string[] = [];

    const unusedExports = exports.filter(exp => !exp.isUsed && !exp.hasTypeOnlyUsage);
    if (unusedExports.length > 0) {
      recommendations.push(`Remove ${unusedExports.length} unused exports to improve tree shaking`);
    }

    if (sideEffects.length > 0) {
      recommendations.push(`Remove side effects from ${sideEffects.length} modules or mark them in package.json`);
    }

    if (circularDeps.length > 0) {
      recommendations.push(`Resolve ${circularDeps.length} circular dependencies`);
    }

    const typeOnlyExports = exports.filter(exp => exp.hasTypeOnlyUsage && exp.isUsed);
    if (typeOnlyExports.length > 0) {
      recommendations.push(`Use 'import type' for ${typeOnlyExports.length} type-only imports`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Code is well optimized for tree shaking!');
    }

    return recommendations;
  }
}