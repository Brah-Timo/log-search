/**
 * Notifier.ts
 * Sends alert notifications to configured channels.
 * Supports Slack, Discord, Email (SMTP), Webhook, and PagerDuty.
 */

import type { AlertMatch, AlertChannel } from '../../types/ConfigTypes';

export class Notifier {
  private channel: AlertChannel;
  private lastNotified: Map<string, number> = new Map();

  constructor(channel: AlertChannel) {
    this.channel = channel;
  }

  /**
   * Send an alert notification.
   * Respects cooldown to avoid notification storms.
   */
  async send(match: AlertMatch, cooldownMs: number = 60_000): Promise<void> {
    const key = `${match.rule}-${match.severity}`;
    const lastTime = this.lastNotified.get(key) ?? 0;

    if (Date.now() - lastTime < cooldownMs) {
      return; // Still in cooldown
    }

    this.lastNotified.set(key, Date.now());

    switch (this.channel.type) {
      case 'slack':
        await this.sendSlack(match);
        break;
      case 'discord':
        await this.sendDiscord(match);
        break;
      case 'webhook':
        await this.sendWebhook(match);
        break;
      case 'pagerduty':
        await this.sendPagerDuty(match);
        break;
      case 'email':
        await this.sendEmail(match);
        break;
    }
  }

  // ─── Slack ────────────────────────────────────────────────────────────────

  private async sendSlack(match: AlertMatch): Promise<void> {
    if (this.channel.type !== 'slack') return;

    const color = match.severity === 'critical' ? '#FF0000' : match.severity === 'warning' ? '#FFA500' : '#36a64f';
    const emoji = match.severity === 'critical' ? '🚨' : match.severity === 'warning' ? '⚠️' : 'ℹ️';

    const payload = {
      attachments: [
        {
          color,
          title: `${emoji} log-search Alert: ${match.rule}`,
          text: `\`\`\`${match.line.slice(0, 1000)}\`\`\``,
          fields: [
            { title: 'Severity', value: match.severity.toUpperCase(), short: true },
            { title: 'Time', value: match.timestamp, short: true },
            ...(match.filePath ? [{ title: 'File', value: match.filePath, short: false }] : []),
          ],
          footer: 'log-search Pro',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    await this.httpPost(this.channel.webhookUrl, payload);
  }

  // ─── Discord ──────────────────────────────────────────────────────────────

  private async sendDiscord(match: AlertMatch): Promise<void> {
    if (this.channel.type !== 'discord') return;

    const color = match.severity === 'critical' ? 16711680 : match.severity === 'warning' ? 16753920 : 3580392;
    const emoji = match.severity === 'critical' ? '🚨' : match.severity === 'warning' ? '⚠️' : 'ℹ️';

    const payload = {
      embeds: [
        {
          title: `${emoji} Alert: ${match.rule}`,
          description: `\`\`\`\n${match.line.slice(0, 1000)}\n\`\`\``,
          color,
          fields: [
            { name: 'Severity', value: match.severity.toUpperCase(), inline: true },
            { name: 'Time', value: match.timestamp, inline: true },
          ],
          footer: { text: 'log-search Pro' },
        },
      ],
    };

    await this.httpPost(this.channel.webhookUrl, payload);
  }

  // ─── Generic Webhook ──────────────────────────────────────────────────────

  private async sendWebhook(match: AlertMatch): Promise<void> {
    if (this.channel.type !== 'webhook') return;

    const payload = {
      source: 'log-search',
      alert: match,
    };

    await this.httpPost(this.channel.url, payload, this.channel.headers);
  }

  // ─── PagerDuty ────────────────────────────────────────────────────────────

  private async sendPagerDuty(match: AlertMatch): Promise<void> {
    if (this.channel.type !== 'pagerduty') return;

    const severity = match.severity === 'critical' ? 'critical' : match.severity === 'warning' ? 'warning' : 'info';

    const payload = {
      routing_key: this.channel.integrationKey,
      event_action: 'trigger',
      dedup_key: `log-search-${match.rule}`,
      payload: {
        summary: `[log-search] ${match.rule}: ${match.line.slice(0, 200)}`,
        source: match.filePath ?? 'log-search',
        severity,
        timestamp: match.timestamp,
        custom_details: { line: match.line, rule: match.rule },
      },
    };

    await this.httpPost('https://events.pagerduty.com/v2/enqueue', payload);
  }

  // ─── Email (stub — requires nodemailer in production) ─────────────────────

  private async sendEmail(match: AlertMatch): Promise<void> {
    if (this.channel.type !== 'email') return;
    // In a real implementation, this would use nodemailer or a transactional email API
    console.log(`[log-search Pro] Email alert to ${this.channel.to.join(', ')}: ${match.rule}`);
  }

  // ─── HTTP helper ──────────────────────────────────────────────────────────

  private async httpPost(
    url: string,
    body: unknown,
    headers?: Record<string, string>
  ): Promise<void> {
    const fetch = (await import('node-fetch')).default;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Notification failed: ${res.status} ${res.statusText}`);
    }
  }
}
