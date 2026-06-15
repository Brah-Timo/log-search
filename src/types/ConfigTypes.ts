/**
 * ConfigTypes.ts
 * Configuration types for log-search global settings.
 */

export type LogFormat = 'nginx' | 'apache' | 'json' | 'syslog' | 'kubernetes' | 'docker' | 'generic';

export interface GlobalConfig {
  /** Directory to store index files. Default: ~/.log-search/indexes */
  indexDir?: string;
  /** Maximum size of the LRU cache for loaded indexes (number of indexes). Default: 10 */
  maxCacheSize?: number;
  /** Watch mode polling interval (ms). Default: 500 */
  watchInterval?: number;
  /** Enable debug logging. Default: false */
  debug?: boolean;
  /** Pro license key */
  licenseKey?: string;
  /** Default output format */
  defaultOutput?: 'text' | 'json' | 'table';
  /** Color output in terminal. Default: true */
  color?: boolean;
}

export interface ProConfig {
  /** Pro license key */
  licenseKey: string;
  /** Activation token from Pro server */
  activationToken?: string;
  /** License expiry date */
  expiresAt?: string;
  /** Allowed features */
  features: ProFeature[];
}

export type ProFeature =
  | 'web-ui'
  | 'alerts'
  | 'multi-file'
  | 'api-server'
  | 'reports'
  | 'team-sharing';

export interface AlertRule {
  name: string;
  /** String pattern or RegExp to match */
  pattern: string | RegExp;
  severity: 'info' | 'warning' | 'critical';
  /** Notification channel */
  channel?: AlertChannel;
  /** Cooldown in seconds before re-alerting on same rule. Default: 60 */
  cooldownSeconds?: number;
}

export type AlertChannel = SlackChannel | DiscordChannel | EmailChannel | WebhookChannel | PagerDutyChannel;

export interface SlackChannel {
  type: 'slack';
  webhookUrl: string;
}

export interface DiscordChannel {
  type: 'discord';
  webhookUrl: string;
}

export interface EmailChannel {
  type: 'email';
  to: string[];
  smtpConfig?: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
}

export interface WebhookChannel {
  type: 'webhook';
  url: string;
  headers?: Record<string, string>;
}

export interface PagerDutyChannel {
  type: 'pagerduty';
  integrationKey: string;
}

export interface AlertMatch {
  rule: string;
  line: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
  filePath?: string;
}
