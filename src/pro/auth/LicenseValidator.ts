/**
 * LicenseValidator.ts
 * Validates Pro license keys.
 * License format: LSEARCH-XXXX-XXXX-XXXX-XXXX (base-32 encoded payload)
 */

import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import type { ProConfig, ProFeature } from '../../types/ConfigTypes';

const LICENSE_RE = /^LSEARCH-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const PRO_CONFIG_PATH = path.join(os.homedir(), '.log-search', 'pro.json');

// All Pro features
const ALL_FEATURES: ProFeature[] = ['web-ui', 'alerts', 'multi-file', 'api-server', 'reports', 'team-sharing'];

export class LicenseValidator {
  /**
   * Validate a license key format and save it locally.
   */
  async activate(licenseKey: string): Promise<ProConfig> {
    if (!LICENSE_RE.test(licenseKey.toUpperCase())) {
      throw new Error(`Invalid license key format. Expected: LSEARCH-XXXX-XXXX-XXXX-XXXX`);
    }

    const config: ProConfig = {
      licenseKey: licenseKey.toUpperCase(),
      activationToken: this.generateActivationToken(licenseKey),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      features: ALL_FEATURES,
    };

    await this.saveConfig(config);
    return config;
  }

  /**
   * Load and verify stored Pro config.
   * Returns null if not activated or expired.
   */
  async verify(): Promise<ProConfig | null> {
    try {
      const config = await this.loadConfig();
      if (!config) return null;

      if (config.expiresAt && new Date(config.expiresAt) < new Date()) {
        return null; // Expired
      }

      return config;
    } catch {
      return null;
    }
  }

  /**
   * Check if a specific Pro feature is available.
   */
  async hasFeature(feature: ProFeature): Promise<boolean> {
    const config = await this.verify();
    if (!config) return false;
    return config.features.includes(feature);
  }

  /**
   * Deactivate Pro license.
   */
  async deactivate(): Promise<void> {
    await this.saveConfig(null);
  }

  private generateActivationToken(key: string): string {
    return crypto
      .createHash('sha256')
      .update(key + os.hostname() + os.platform())
      .digest('hex')
      .slice(0, 32);
  }

  private async loadConfig(): Promise<ProConfig | null> {
    try {
      const raw = await readFile(PRO_CONFIG_PATH, 'utf8');
      return JSON.parse(raw) as ProConfig;
    } catch {
      return null;
    }
  }

  private async saveConfig(config: ProConfig | null): Promise<void> {
    await mkdir(path.dirname(PRO_CONFIG_PATH), { recursive: true });
    await writeFile(
      PRO_CONFIG_PATH,
      config ? JSON.stringify(config, null, 2) : '{}',
      'utf8'
    );
  }
}
