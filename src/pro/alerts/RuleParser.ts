/**
 * RuleParser.ts
 * Parses alert rule definitions from a YAML-like config or JSON.
 */

import type { AlertRule } from '../../types/ConfigTypes';

export interface RuleDefinition {
  name: string;
  pattern: string;
  severity?: 'info' | 'warning' | 'critical';
  cooldown?: number;
  channel?: Record<string, unknown>;
}

export class RuleParser {
  /**
   * Parse an array of rule definitions into AlertRule objects.
   */
  parse(definitions: RuleDefinition[]): AlertRule[] {
    return definitions.map((def) => this.parseRule(def));
  }

  /**
   * Parse a single rule definition.
   */
  parseRule(def: RuleDefinition): AlertRule {
    if (!def.name || def.name.trim().length === 0) {
      throw new Error('Alert rule must have a non-empty name');
    }

    if (!def.pattern || def.pattern.trim().length === 0) {
      throw new Error(`Alert rule "${def.name}" must have a pattern`);
    }

    // Determine if pattern is regex or string
    let pattern: string | RegExp = def.pattern;
    if (def.pattern.startsWith('/') && def.pattern.lastIndexOf('/') > 0) {
      const lastSlash = def.pattern.lastIndexOf('/');
      const regexBody = def.pattern.slice(1, lastSlash);
      const flags = def.pattern.slice(lastSlash + 1);
      try {
        pattern = new RegExp(regexBody, flags);
      } catch (err) {
        throw new Error(`Invalid regex in rule "${def.name}": ${err}`);
      }
    }

    return {
      name: def.name.trim(),
      pattern,
      severity: def.severity ?? 'warning',
      cooldownSeconds: def.cooldown ?? 60,
    };
  }

  /**
   * Parse rules from a JSON string.
   */
  parseJson(json: string): AlertRule[] {
    let defs: RuleDefinition[];
    try {
      defs = JSON.parse(json);
    } catch (err) {
      throw new Error(`Invalid JSON alert config: ${err}`);
    }

    if (!Array.isArray(defs)) {
      throw new Error('Alert config must be a JSON array of rule objects');
    }

    return this.parse(defs);
  }

  /**
   * Validate a rule definition without converting it.
   * Returns null if valid, or an error message if invalid.
   */
  validate(def: RuleDefinition): string | null {
    if (!def.name?.trim()) return 'Missing name';
    if (!def.pattern?.trim()) return 'Missing pattern';
    if (def.severity && !['info', 'warning', 'critical'].includes(def.severity)) {
      return `Invalid severity: ${def.severity}`;
    }
    if (def.pattern.startsWith('/')) {
      try {
        const lastSlash = def.pattern.lastIndexOf('/');
        new RegExp(def.pattern.slice(1, lastSlash), def.pattern.slice(lastSlash + 1));
      } catch (err) {
        return `Invalid regex: ${err}`;
      }
    }
    return null;
  }
}
