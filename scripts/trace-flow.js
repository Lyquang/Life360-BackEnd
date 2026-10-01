#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const graphPath = path.join(root, 'codex', 'context', 'module-graph.json');
const ignoredDirs = new Set(['.git', '.codex', 'codex/context', 'node_modules', 'dist', 'build', 'coverage']);
const sourceExts = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function isIgnored(relPath) {
  const normalized = toPosix(relPath);
  return normalized.split('/').some((part, index, parts) => {
    const prefix = parts.slice(0, index + 1).join('/');
    return ignoredDirs.has(part) || ignoredDirs.has(prefix);
  });
}

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const relPath = toPosix(path.relative(root, fullPath));
    if (isIgnored(relPath)) continue;
    if (entry.isDirectory()) files.push(...walk(fullPath));
    if (entry.isFile() && sourceExts.has(path.extname(entry.name))) files.push(relPath);
  }
  return files.sort();
}

function loadGraph() {
  if (!fs.existsSync(graphPath)) {
    console.error('No module graph found. Run: npm run context:skeleton');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(graphPath, 'utf8'));
}

function printFileTrace(graph, file) {
  const normalized = toPosix(file);
  const meta = graph[normalized];
  if (!meta) {
    console.error(`File not found in graph: ${normalized}`);
    process.exit(1);
  }

  console.log(`# Trace: ${normalized}`);
  console.log('\nImports:');
  for (const item of meta.imports) {
    console.log(`- L${item.line}: ${item.specifier}${item.resolved ? ` -> ${item.resolved}` : ''}`);
  }

  console.log('\nImported by:');
  for (const importer of meta.importedBy || []) {
    console.log(`- ${importer}`);
  }

  console.log('\nSignatures:');
  for (const item of meta.signatures || []) {
    console.log(`- L${item.line}: ${item.text}`);
  }
}

function printTermTrace(term) {
  const files = walk(root);
  const needle = term.toLowerCase();
  const results = [];

  for (const file of files) {
    const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n');
    const matches = [];
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(needle)) {
        matches.push({ line: index + 1, text: line.trim() });
      }
    });
    if (matches.length) results.push({ file, matches });
  }

  console.log(`# Search trace: ${term}`);
  for (const result of results) {
    console.log(`\n## ${result.file}`);
    for (const match of result.matches.slice(0, 8)) {
      console.log(`- L${match.line}: ${match.text}`);
    }
    if (result.matches.length > 8) {
      console.log(`- ... ${result.matches.length - 8} more matches`);
    }
  }
}

function usage() {
  console.log('Usage:');
  console.log('  npm run context:trace -- --file src/presentation/http/controllers/chatController.js');
  console.log('  npm run context:trace -- --term conversationId');
}

const args = process.argv.slice(2);
const fileIndex = args.indexOf('--file');
const termIndex = args.indexOf('--term');

if (fileIndex !== -1 && args[fileIndex + 1]) {
  printFileTrace(loadGraph(), args[fileIndex + 1]);
} else if (termIndex !== -1 && args[termIndex + 1]) {
  printTermTrace(args[termIndex + 1]);
} else {
  usage();
}
