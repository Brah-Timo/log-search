/**
 * AlertEngine.ts
 * Real-time alert engine (Pro feature).
 * Watches a log file for new content and triggers alerts when rules match.
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import * as chokidar from 'chokidar';
import { Notifier } from './Notifier';
import type { AlertRule, AlertMatch, AlertChannel } from '../../types/ConfigTypes';

export interface AlertEngineOptions {
  channel?: AlertChannel;
  printToConsole?: boolean;
}

export class AlertEngine extends EventEmitter {
  private rules: AlertRule[];
  private notifiers: Notifier[];
  private watcher: chokidar.FSWatcher | null = null;
  private lastSize: number = 0;
  private printToConsole: boolean;

  constructor(rules: AlertRule[], options: AlertEngineOptions = {}) {
    super();
    this.rules = rules;
    this.printToConsole = options.printToConsole ?? true;

    if (options.channel) {
      this.notifiers = [new Notifier(options.channel)];
    } else {
      this.notifiers = [];
    }
  }

  /**
   * Start watching a file and triggering alerts on matches.
   */
  start(filePath: string): void {
    const resolvedPath = path.resolve(filePath);

    // Get current file size as starting point (don't alert on existing content)
    try {
      this.lastSize = fs.statSync(resolvedPath).size;
    } catch {
      this.lastSize = 0;
    }

    this.watcher = chokidar.watch(resolvedPath, {
      persistent: true,
      usePolling: false,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    this.watcher.on('change', async (changedPath, stats) => {
      if (!stats) return;

      const newSize = stats.size;
      if (newSize <= this.lastSize) return;

      const newContent = await this.readNewBytes(changedPath, this.lastSize, newSize);
      this.lastSize = newSize;

      const newLines = newContent.split('\n').filter(Boolean);

      for (const line of newLines) {
        for (const rule of this.rules) {
          if (this.matchesRule(line, rule)) {
            const match: AlertMatch = {
              rule: rule.name,
              line,
              timestamp: new Date().toISOString(),
              severity: rule.severity,
              filePath: resolvedPath,
            };

            // Emit event
            this.emit('alert', match);

            // Console output
            if (this.printToConsole) {
              const emoji = match.severity === 'critical' ? '🚨' : match.severity === 'warning' ? '⚠️' : 'ℹ️';
              console.log(`${emoji} [${match.timestamp}] ALERT: ${match.rule}`);
              console.log(`   ${match.line.slice(0, 200)}`);
            }

            // Send notifications
            const cooldownMs = (rule.cooldownSeconds ?? 60) * 1000;
            for (const notifier of this.notifiers) {
              notifier.send(match, cooldownMs).catch((err) =>
                this.emit('error', err)
              );
            }
          }
        }
      }
    });

    this.watcher.on('error', (err) => this.emit('error', err));

    if (this.printToConsole) {
      console.log(
        `\n🔔 Alert engine started. Watching: ${resolvedPath}\n` +
        `   ${this.rules.length} rule(s) active.\n` +
        `   Press Ctrl+C to stop.\n`
      );
    }
  }

  /**
   * Stop watching.
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    if (this.printToConsole) {
      console.log('\n🛑 Alert engine stopped.');
    }
  }

  /**
   * Add a notifier channel at runtime.
   */
  addNotifier(notifier: Notifier): void {
    this.notifiers.push(notifier);
  }

  private matchesRule(line: string, rule: AlertRule): boolean {
    if (rule.pattern instanceof RegExp) {
      return rule.pattern.test(line);
    }
    return line.toLowerCase().includes(rule.pattern.toLowerCase());
  }

  private readNewBytes(filePath: string, start: number, end: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = fs.createReadStream(filePath, { start, end: end - 1 });
      stream.on('data', (c: any) => chunks.push(c));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      stream.on('error', reject);
    });
  }
}
