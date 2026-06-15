#!/usr/bin/env node
/**
 * benchmark.js
 * Benchmarks log-search vs grep on a generated log file.
 * Usage: node scripts/benchmark.js [log_file] [query]
 */
'use strict';

const { execSync, spawnSync } = require('child_process');
const path = require('path');

const LOG_FILE = process.argv[2] ?? path.join(__dirname, '..', 'test-logs', 'test-100mb.log');
const QUERY = process.argv[3] ?? 'ERROR';

console.log('\n📊 log-search Benchmark');
console.log('═'.repeat(50));
console.log(`  File:  ${LOG_FILE}`);
console.log(`  Query: ${QUERY}\n`);

// grep benchmark
let grepTime = 0;
try {
  const t0 = Date.now();
  const r = spawnSync('grep', ['-c', QUERY, LOG_FILE]);
  grepTime = Date.now() - t0;
  const matches = parseInt(r.stdout.toString().trim(), 10);
  console.log(`  grep:        ${grepTime}ms  (${matches} matches)`);
} catch {
  console.log('  grep:        not available');
}

// log-search benchmark (first run — builds index)
try {
  const t1 = Date.now();
  spawnSync('node', [path.join(__dirname, '..', 'dist', 'cli', 'main.js'), 'search', LOG_FILE, QUERY, '--limit', '10', '--json'], { stdio: 'pipe' });
  const firstRun = Date.now() - t1;
  console.log(`  log-search (cold): ${firstRun}ms  (includes index build)`);
} catch {}

// log-search benchmark (second run — uses index)
try {
  const t2 = Date.now();
  const r2 = spawnSync('node', [path.join(__dirname, '..', 'dist', 'cli', 'main.js'), 'search', LOG_FILE, QUERY, '--limit', '1000', '--json'], { stdio: 'pipe' });
  const secondRun = Date.now() - t2;
  let matches = '?';
  try { matches = JSON.parse(r2.stdout.toString()).totalMatches; } catch {}
  console.log(`  log-search (hot):  ${secondRun}ms  (${matches} matches, indexed)`);
  if (grepTime > 0) {
    console.log(`\n  🚀 Speedup: ${(grepTime / secondRun).toFixed(0)}x faster than grep`);
  }
} catch {}

console.log('');
