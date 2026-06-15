#!/usr/bin/env node
/**
 * generate-large-log.js
 * Generates a large realistic log file for benchmarking and testing.
 * Usage: node scripts/generate-large-log.js [size_mb] [output_path]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SIZE_MB = parseInt(process.argv[2] ?? '100', 10);
const OUTPUT = process.argv[3] ?? path.join(__dirname, '..', 'test-logs', `test-${SIZE_MB}mb.log`);
const TARGET_BYTES = SIZE_MB * 1024 * 1024;

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });

const LEVELS = ['INFO', 'INFO', 'INFO', 'WARN', 'ERROR', 'DEBUG'];
const PATHS = ['/api/users', '/api/orders', '/api/products', '/health', '/api/auth', '/api/payments'];
const METHODS = ['GET', 'POST', 'PUT', 'DELETE'];
const IPS = ['127.0.0.1', '192.168.1.1', '10.0.0.1', '172.16.0.1'];
const MESSAGES = [
  'Request completed successfully',
  'Database query executed',
  'Cache miss — fetching from DB',
  'Connection timeout after 30s',
  'Authentication failed: invalid token',
  'Rate limit exceeded for IP',
  'Payment processing initiated',
  'Order created successfully',
  'User session expired',
  'Background job completed',
];

const stream = fs.createWriteStream(OUTPUT);
let written = 0;
let lineNum = 0;

process.stdout.write(`Generating ${SIZE_MB}MB log file to ${OUTPUT}...\n`);

function writeLine() {
  while (written < TARGET_BYTES) {
    const date = new Date(Date.now() - Math.random() * 30 * 24 * 3600 * 1000);
    const ts = date.toISOString();
    const level = LEVELS[Math.floor(Math.random() * LEVELS.length)];
    const ip = IPS[Math.floor(Math.random() * IPS.length)];
    const method = METHODS[Math.floor(Math.random() * METHODS.length)];
    const urlPath = PATHS[Math.floor(Math.random() * PATHS.length)];
    const status = level === 'ERROR' ? (Math.random() > 0.5 ? 500 : 503) : 200;
    const duration = Math.floor(Math.random() * 5000);
    const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

    lineNum++;
    const line = `${ts} [${level}] ${ip} ${method} ${urlPath} ${status} ${duration}ms - ${msg} (req=${lineNum})\n`;

    if (!stream.write(line)) {
      written += Buffer.byteLength(line);
      stream.once('drain', writeLine);
      return;
    }
    written += Buffer.byteLength(line);

    if (lineNum % 100000 === 0) {
      process.stdout.write(`  ${(written / 1024 / 1024).toFixed(0)}MB / ${SIZE_MB}MB written...\r`);
    }
  }

  stream.end(() => {
    process.stdout.write(`\n✓ Done! ${lineNum.toLocaleString()} lines written to ${OUTPUT}\n`);
  });
}

writeLine();
