import { Project, SyntaxKind, SourceFile, Node, FunctionLikeDeclaration } from 'ts-morph';

// Configuration
const CONFIG = {
  DRY_RUN: process.env.DRY_RUN === 'true',
  VERBOSE: process.env.VERBOSE !== 'false',
  PARALLEL: true,
  MAX_FIXES_PER_FILE: 1000,
  IGNORED_PATTERNS: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/*.d.ts', '**/coverage/**', '**/*.spec.ts', '**/*.test.ts'],
};

// Project initialization with enhanced configuration
const initializeProject = (): Project => {
  return new Project({
    tsConfigFilePath: './tsconfig.json',
    manipulationSettings: {
      useTrailingCommas: true,
    },
  });
};

const project = initializeProject();

// Get source files with intelligent filtering
const getAllSourceFiles = (): SourceFile[] => {
  const allFiles = project.getSourceFiles(['src/**/*.ts', 'libs/**/*.ts', 'apps/**/*.ts']);
  return allFiles.filter((file) => {
    const filePath = file.getFilePath();
    return !CONFIG.IGNORED_PATTERNS.some((pattern) => filePath.includes(pattern.replace(/\*\*/g, '').replace(/\*/g, '')));
  });
};

const files = getAllSourceFiles();

type Fix = {
  pos: number;
  end: number;
  replacement: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  category: 'performance' | 'style' | 'maintainability' | 'correctness' | 'security';
};

type FixStats = {
  filesProcessed: number;
  totalFixes: number;
  fixesByCategory: Record<string, number>;
  fixesByReason: Record<string, number>;
  errors: string[];
  warnings: string[];
};

// Enhanced logging functions
function logFix(file: SourceFile, reason: string, count: number) {
  if (count > 0) {
    console.log(`[fix] ${file.getBaseName()}: ${count} × ${reason}`);
  }
}

function initializeStats(): FixStats {
  return {
    filesProcessed: 0,
    totalFixes: 0,
    fixesByCategory: {},
    fixesByReason: {},
    errors: [],
    warnings: [],
  };
}

function updateStats(stats: FixStats, fixes: Fix[], fileName: string): void {
  stats.filesProcessed++;
  stats.totalFixes += fixes.length;

  fixes.forEach((fix) => {
    stats.fixesByCategory[fix.category] = (stats.fixesByCategory[fix.category] || 0) + 1;
    stats.fixesByReason[fix.reason] = (stats.fixesByReason[fix.reason] || 0) + 1;
  });
}

function isThenable(type: ReturnType<typeof Node.prototype.getType>): boolean {
  const thenProp = type.getProperty('then');
  return (
    !!thenProp &&
    thenProp.getDeclarations().some((decl: any) => {
      const sigs = decl?.getType?.()?.getCallSignatures?.();
      return sigs?.length > 0;
    })
  );
}

function findAsyncFunctionsWithoutAwait(file: SourceFile): Fix[] {
  const fixes: Fix[] = [];

  const asyncFns = file
    .getDescendants()
    .filter((node) => {
      return Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node) || Node.isFunctionExpression(node) || Node.isArrowFunction(node);
    })
    .filter((fn) => (fn as FunctionLikeDeclaration).hasModifier(SyntaxKind.AsyncKeyword));

  for (const fn of asyncFns) {
    const body = fn.getBody();
    if (!body) continue;

    const hasAwait = body.getDescendantsOfKind(SyntaxKind.AwaitExpression).length > 0;
    if (!hasAwait) {
      const asyncKeyword = fn.getFirstModifierByKind(SyntaxKind.AsyncKeyword);
      if (asyncKeyword) {
        fixes.push({
          pos: asyncKeyword.getStart(),
          end: asyncKeyword.getEnd() + 1, // +1 for space
          replacement: '',
          reason: 'remove-unnecessary-async',
          priority: 'medium',
          category: 'maintainability',
        });
      }
    }
  }

  return fixes;
}

// function isParameterUsed(parameter: any): boolean {
//   const parameterName = parameter.getNameNode().getText();
//   const functionNode = parameter.getParent();

//   if (!functionNode) return true;

//   const body = functionNode.getBody?.();
//   if (!body) return true;

//   // Check if parameter name appears in the function body
//   const bodyText = body.getFullText();
//   return bodyText.includes(parameterName);
// }

// function findUnusedParameters(file: SourceFile): Fix[] {
//   const fixes: Fix[] = [];

//   try {
//     const parameters = file.getDescendantsOfKind(SyntaxKind.Parameter);

//     for (const parameter of parameters) {
//       const nameNode = parameter.getNameNode();
//       const parameterName = nameNode.getText();

//       if (isParameterUsed(parameter) || parameterName.startsWith('_')) {
//         continue;
//       }

//       fixes.push({
//         pos: nameNode.getStart(),
//         end: nameNode.getEnd(),
//         replacement: `_${parameterName}`,
//         reason: 'prefix-unused-parameter',
//         priority: 'low',
//         category: 'style',
//       });
//     }
//   } catch (error: any) {
//     console.warn(`[warn] Failed to check parameters in ${file.getBaseName()}: ${error.message}`);
//   }

//   return fixes;
// }

async function applyFixesToFile(file: SourceFile, stats: FixStats): Promise<void> {
  try {
    const fixes = {
      await: findUnnecessaryAwait(file),
      nullish: findNullishCoalescing(file),
      async: findAsyncFunctionsWithoutAwait(file),
      // unusedParams: findUnusedParameters(file),
      imports: findUnusedImports(file),
      console: findConsoleStatements(file),
      typeAnnotations: findRedundantTypeAnnotations(file),
      equality: findNonStrictEquality(file),
    };

    const allFixes = [...fixes.await, ...fixes.nullish, ...fixes.async /* ...fixes.unusedParams */, ...fixes.imports, ...fixes.console, ...fixes.typeAnnotations, ...fixes.equality]
      .sort((a, b) => b.pos - a.pos)
      .slice(0, CONFIG.MAX_FIXES_PER_FILE);

    if (allFixes.length === 0) return;

    // Apply fixes
    applyFixesToSource(file, allFixes);
    logAllFixes(file, fixes);
    updateStats(stats, allFixes, file.getBaseName());

    if (CONFIG.VERBOSE) {
      console.log(`✔ Processed ${file.getBaseName()} (${allFixes.length} changes)`);
    }
  } catch (error: any) {
    const errorMsg = `Failed to process ${file.getBaseName()}: ${error.message}`;
    stats.errors.push(errorMsg);
    console.error(`[error] ${errorMsg}`);
  }
}

function findUnnecessaryAwait(file: SourceFile): Fix[] {
  const fixes: Fix[] = [];

  try {
    file.getDescendantsOfKind(SyntaxKind.AwaitExpression).forEach((expr) => {
      const awaited = expr.getExpression();
      const type = awaited.getType();

      if (!isThenable(type)) {
        fixes.push({
          pos: expr.getStart(),
          end: expr.getEnd(),
          replacement: awaited.getText(),
          reason: 'remove-unnecessary-await',
          priority: 'high',
          category: 'performance',
        });
      }
    });
  } catch (err: any) {
    console.warn(`[warn] Failed to check await expressions in ${file.getBaseName()}: ${err.message}`);
  }

  return fixes;
}

function findNullishCoalescing(file: SourceFile): Fix[] {
  const fixes: Fix[] = [];

  try {
    file.getDescendantsOfKind(SyntaxKind.BinaryExpression).forEach((expr) => {
      try {
        if (expr.getOperatorToken().getText() !== '||') return;

        const left = expr.getLeft();
        const right = expr.getRight();
        const leftType = left.getType();

        if (leftType.isNullable() || leftType.isUndefined()) {
          fixes.push({
            pos: expr.getStart(),
            end: expr.getEnd(),
            replacement: `${left.getText()} ?? ${right.getText()}`,
            reason: 'use-nullish-coalescing',
            priority: 'medium',
            category: 'correctness',
          });
        }
      } catch (err: any) {
        console.warn(`[warn] Skipped binary expression in ${file.getBaseName()}: ${err.message}`);
      }
    });
  } catch (err: any) {
    console.error(`[error] Failed to analyze binary expressions in ${file.getBaseName()}: ${err.message}`);
  }

  return fixes;
}

// New comprehensive fix functions
function findUnusedImports(file: SourceFile): Fix[] {
  const fixes: Fix[] = [];

  try {
    const imports = file.getImportDeclarations();

    for (const importDecl of imports) {
      const namedImports = importDecl.getNamedImports();
      const unusedImports: string[] = [];

      for (const namedImport of namedImports) {
        const importName = namedImport.getName();
        const usages = file.getDescendantsOfKind(SyntaxKind.Identifier).filter((id) => id.getText() === importName && id !== namedImport.getNameNode());

        if (usages.length === 0) {
          unusedImports.push(importName);
        }
      }

      if (unusedImports.length > 0 && unusedImports.length === namedImports.length) {
        // Remove entire import if all imports are unused
        fixes.push({
          pos: importDecl.getStart(),
          end: importDecl.getEnd() + 1, // Include newline
          replacement: '',
          reason: 'remove-unused-imports',
          priority: 'medium',
          category: 'maintainability',
        });
      }
    }
  } catch (error: any) {
    console.warn(`[warn] Failed to check imports in ${file.getBaseName()}: ${error.message}`);
  }

  return fixes;
}

function findConsoleStatements(file: SourceFile): Fix[] {
  const fixes: Fix[] = [];

  try {
    file.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((callExpr) => {
      const expr = callExpr.getExpression();

      if (Node.isPropertyAccessExpression(expr)) {
        const objName = expr.getExpression().getText();
        const propName = expr.getName();

        if (objName === 'console' && ['log', 'debug', 'info', 'warn'].includes(propName)) {
          // Find the statement containing this call
          const statement = callExpr.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
          if (statement) {
            fixes.push({
              pos: statement.getStart(),
              end: statement.getEnd() + 1, // Include newline
              replacement: '',
              reason: 'remove-console-statements',
              priority: 'low',
              category: 'style',
            });
          }
        }
      }
    });
  } catch (error: any) {
    console.warn(`[warn] Failed to check console statements in ${file.getBaseName()}: ${error.message}`);
  }

  return fixes;
}

function findRedundantTypeAnnotations(file: SourceFile): Fix[] {
  const fixes: Fix[] = [];

  try {
    file.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach((varDecl) => {
      const typeNode = varDecl.getTypeNode();
      const initializer = varDecl.getInitializer();

      if (typeNode && initializer) {
        const inferredType = initializer.getType().getText();
        const annotatedType = typeNode.getText();

        // Simple check for obvious redundant annotations
        if (
          inferredType === annotatedType ||
          (annotatedType === 'string' && Node.isStringLiteral(initializer)) ||
          (annotatedType === 'number' && Node.isNumericLiteral(initializer)) ||
          (annotatedType === 'boolean' && (initializer.getKind() === SyntaxKind.TrueKeyword || initializer.getKind() === SyntaxKind.FalseKeyword))
        ) {
          fixes.push({
            pos: typeNode.getStart() - 1, // Include the colon
            end: typeNode.getEnd(),
            replacement: '',
            reason: 'remove-redundant-types',
            priority: 'low',
            category: 'style',
          });
        }
      }
    });
  } catch (error: any) {
    console.warn(`[warn] Failed to check type annotations in ${file.getBaseName()}: ${error.message}`);
  }

  return fixes;
}

function findNonStrictEquality(file: SourceFile): Fix[] {
  const fixes: Fix[] = [];

  try {
    file.getDescendantsOfKind(SyntaxKind.BinaryExpression).forEach((binaryExpr) => {
      const operator = binaryExpr.getOperatorToken();
      const operatorText = operator.getText();

      if (operatorText === '==' || operatorText === '!=') {
        const strictOperator = operatorText === '==' ? '===' : '!==';

        fixes.push({
          pos: operator.getStart(),
          end: operator.getEnd(),
          replacement: strictOperator,
          reason: 'use-strict-equality',
          priority: 'high',
          category: 'correctness',
        });
      }
    });
  } catch (error: any) {
    console.warn(`[warn] Failed to check equality operators in ${file.getBaseName()}: ${error.message}`);
  }

  return fixes;
}

function applyFixesToSource(file: SourceFile, fixes: Fix[]): void {
  let sourceText = file.getFullText();

  for (const fix of fixes) {
    sourceText = sourceText.slice(0, fix.pos) + fix.replacement + sourceText.slice(fix.end);
  }

  if (CONFIG.DRY_RUN) {
    console.log(`[dry-run] ${file.getFilePath()}`);
    console.log(`  Would apply ${fixes.length} fixes`);
  } else {
    file.replaceWithText(sourceText);
    // Save changes to disk
    file.saveSync();
  }
}

function logAllFixes(file: SourceFile, fixes: Record<string, Fix[]>): void {
  logFix(file, 'remove-unnecessary-await', fixes.await.length);
  logFix(file, 'use-nullish-coalescing', fixes.nullish.length);
  logFix(file, 'remove-unnecessary-async', fixes.async.length);
  logFix(file, 'prefix-unused-parameter', fixes.unusedParams.length);
  logFix(file, 'remove-unused-imports', fixes.imports?.length || 0);
  logFix(file, 'remove-console-statements', fixes.console?.length || 0);
  logFix(file, 'remove-redundant-types', fixes.typeAnnotations?.length || 0);
  logFix(file, 'use-strict-equality', fixes.equality?.length || 0);
}

function printStats(stats: FixStats): void {
  console.log('\n📊 Fix Statistics:');
  console.log(`  Files processed: ${stats.filesProcessed}`);
  console.log(`  Total fixes applied: ${stats.totalFixes}`);

  if (Object.keys(stats.fixesByCategory).length > 0) {
    console.log('\n  Fixes by category:');
    Object.entries(stats.fixesByCategory)
      .sort(([, a], [, b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`    ${category}: ${count}`);
      });
  }

  if (Object.keys(stats.fixesByReason).length > 0) {
    console.log('\n  Most common fixes:');
    Object.entries(stats.fixesByReason)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .forEach(([reason, count]) => {
        console.log(`    ${reason}: ${count}`);
      });
  }

  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errors encountered: ${stats.errors.length}`);
    stats.errors.slice(0, 3).forEach((error) => console.log(`    ${error}`));
    if (stats.errors.length > 3) {
      console.log(`    ... and ${stats.errors.length - 3} more`);
    }
  }

  if (stats.warnings.length > 0) {
    console.log(`\n⚠️  Warnings: ${stats.warnings.length}`);
  }
}

async function processFilesInParallel(files: SourceFile[], stats: FixStats): Promise<void> {
  const chunkSize = Math.ceil(files.length / 4); // Process in 4 chunks
  const chunks: SourceFile[][] = [];

  for (let i = 0; i < files.length; i += chunkSize) {
    chunks.push(files.slice(i, i + chunkSize));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      for (const file of chunk) {
        await applyFixesToFile(file, stats);
      }
    }),
  );
}

async function runFixes(): Promise<void> {
  const stats = initializeStats();
  const startTime = Date.now();

  console.log(`🔍 Running enhanced code quality fixes on ${files.length} file(s)...`);
  console.log(`📁 Patterns: ${CONFIG.IGNORED_PATTERNS.length} ignored`);
  console.log(`⚙️  Mode: ${CONFIG.DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`⚡ Parallel: ${CONFIG.PARALLEL ? 'ENABLED' : 'DISABLED'}\n`);

  if (CONFIG.PARALLEL && files.length > 10) {
    await processFilesInParallel(files, stats);
  } else {
    for (const file of files) {
      await applyFixesToFile(file, stats);
    }
  }

  const duration = Date.now() - startTime;
  printStats(stats);

  console.log(`\n✅ Code quality fixes completed in ${duration}ms`);

  if (!CONFIG.DRY_RUN && stats.totalFixes > 0) {
    // Save all changes to disk\n    await project.save();\n    console.log('\\n💡 Tip: Run your linter and tests to verify the changes.');
  }
}

runFixes().catch((err) => {
  console.error(`🚨 Unexpected error: ${err.message}`);
  process.exit(1);
});
