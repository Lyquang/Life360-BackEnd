#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const outputDir = path.join(root, 'codex', 'context');
const skeletonPath = path.join(outputDir, 'codebase-skeleton.md');
const graphPath = path.join(outputDir, 'module-graph.json');

const ignoredDirs = new Set([
  '.git',
  '.github',
  '.codex',
  'codex/context',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.cache',
]);

const ignoredFiles = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '.env',
]);

const sourceExts = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function isIgnored(relPath) {
  const normalized = toPosix(relPath);
  if (!normalized) return false;
  if (ignoredFiles.has(path.basename(normalized))) return true;
  return normalized.split('/').some((_, index, parts) => {
    const prefix = parts.slice(0, index + 1).join('/');
    return ignoredDirs.has(prefix) || ignoredDirs.has(parts[index]);
  });
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(root, fullPath);
    if (isIgnored(relPath)) continue;

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (entry.isFile()) files.push(toPosix(relPath));
  }

  return files.sort();
}

function readSource(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

function collectMatches(source, regex, mapper) {
  const matches = [];
  let match;
  while ((match = regex.exec(source)) !== null) {
    matches.push(mapper(match, lineNumberAt(source, match.index)));
  }
  return matches;
}

function parseImports(source, fromFile) {
  const imports = [
    ...collectMatches(source, /require\(['"]([^'"]+)['"]\)/g, (match, line) => ({
      specifier: match[1],
      line,
    })),
    ...collectMatches(source, /from\s+['"]([^'"]+)['"]/g, (match, line) => ({
      specifier: match[1],
      line,
    })),
  ];

  return imports.map((item) => ({
    ...item,
    resolved: resolveImport(fromFile, item.specifier),
  }));
}

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(root, path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.js`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.tsx`,
    path.join(base, 'index.js'),
    path.join(base, 'index.ts'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return toPosix(path.relative(root, candidate));
    }
  }

  return null;
}

function parseSignatures(source) {
  const signatures = [];
  const patterns = [
    /(?:^|\n)(async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g,
    /(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(async\s*)?\(([^)]*)\)\s*=>/g,
    /(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(async\s*)?([A-Za-z_$][\w$]*)?\s*=>/g,
    /(?:^|\n)class\s+([A-Za-z_$][\w$]*)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const text = match[0].trim().replace(/\s+/g, ' ');
      signatures.push({ line: lineNumberAt(source, match.index), text });
    }
  }

  return signatures.sort((a, b) => a.line - b.line);
}

function parseExports(source) {
  const exports = [];
  exports.push(...collectMatches(source, /module\.exports\s*=\s*([A-Za-z_$][\w$]*)/g, (match, line) => ({
    line,
    text: `module.exports = ${match[1]}`,
  })));
  exports.push(...collectMatches(source, /exports\.([A-Za-z_$][\w$]*)\s*=/g, (match, line) => ({
    line,
    text: `exports.${match[1]}`,
  })));
  exports.push(...collectMatches(source, /module\.exports\s*=\s*\{([^}]+)\}/g, (match, line) => ({
    line,
    text: `module.exports = { ${match[1].replace(/\s+/g, ' ').trim()} }`,
  })));
  exports.push(...collectMatches(source, /export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g, (match, line) => ({
    line,
    text: `export ${match[1]}`,
  })));
  return exports.sort((a, b) => a.line - b.line);
}

function renderTree(files) {
  return files.map((file) => `- ${file}`).join('\n');
}

function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  const files = walk(root);
  const sourceFiles = files.filter((file) => sourceExts.has(path.extname(file)));
  const graph = {};

  const sections = sourceFiles.map((file) => {
    const source = readSource(file);
    const imports = parseImports(source, file);
    const signatures = parseSignatures(source);
    const exports = parseExports(source);

    graph[file] = {
      imports,
      importedBy: [],
      exports,
      signatures,
    };

    const importsText = imports.length
      ? imports.map((item) => `  - L${item.line}: ${item.specifier}${item.resolved ? ` -> ${item.resolved}` : ''}`).join('\n')
      : '  - none';
    const exportsText = exports.length
      ? exports.map((item) => `  - L${item.line}: ${item.text}`).join('\n')
      : '  - none';
    const signaturesText = signatures.length
      ? signatures.map((item) => `  - L${item.line}: ${item.text}`).join('\n')
      : '  - none';

    return [
      `## ${file}`,
      '',
      'Imports:',
      importsText,
      '',
      'Exports:',
      exportsText,
      '',
      'Signatures:',
      signaturesText,
    ].join('\n');
  });

  for (const [file, meta] of Object.entries(graph)) {
    for (const item of meta.imports) {
      if (item.resolved && graph[item.resolved]) {
        graph[item.resolved].importedBy.push(file);
      }
    }
  }

  const content = [
    '# Codebase Skeleton',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## File Tree',
    '',
    renderTree(files),
    '',
    '## Source Skeleton',
    '',
    ...sections,
    '',
  ].join('\n');

  fs.writeFileSync(skeletonPath, content);
  fs.writeFileSync(graphPath, `${JSON.stringify(graph, null, 2)}\n`);

  console.log(`Wrote ${path.relative(root, skeletonPath)}`);
  console.log(`Wrote ${path.relative(root, graphPath)}`);
}

main();
