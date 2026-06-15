/**
 * TokenManager.ts
 * Manages session tokens for the Pro Web UI and API server.
 */

import * as crypto from 'crypto';

interface SessionToken {
  token: string;
  createdAt: number;
  expiresAt: number;
  metadata?: Record<string, unknown>;
}

export class TokenManager {
  private tokens: Map<string, SessionToken> = new Map();
  private readonly ttlMs: number;

  constructor(ttlMs: number = 24 * 60 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  /**
   * Generate a new session token.
   */
  generate(metadata?: Record<string, unknown>): string {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();

    this.tokens.set(token, {
      token,
      createdAt: now,
      expiresAt: now + this.ttlMs,
      metadata,
    });

    this.cleanup();
    return token;
  }

  /**
   * Validate a token. Returns true if valid and not expired.
   */
  validate(token: string): boolean {
    const session = this.tokens.get(token);
    if (!session) return false;
    if (Date.now() > session.expiresAt) {
      this.tokens.delete(token);
      return false;
    }
    return true;
  }

  /**
   * Revoke a token.
   */
  revoke(token: string): void {
    this.tokens.delete(token);
  }

  /**
   * Remove all expired tokens.
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, session] of this.tokens) {
      if (now > session.expiresAt) this.tokens.delete(key);
    }
  }

  get activeCount(): number {
    this.cleanup();
    return this.tokens.size;
  }
}
