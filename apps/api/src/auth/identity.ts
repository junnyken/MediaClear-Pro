/**
 * IdentityProvider - cong danh tinh (MCP-10 Phase 1).
 *
 * Q-14 (auth provider production) VAN DANG MO: Phase 1 khong duoc chot IdP nao.
 * Vi vay chi co DevIdentityProvider, tu khai `isProductionProvider = false`, va
 * /healthz phai lo dieu do ra. Khi owner chot Q-14 thi them mot implementation
 * cua chinh port nay, khong sua domain.
 */
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import type { User } from '@mediaclear/contracts';
import type { PersistencePort } from '../persistence/port.js';
import { newId, nowIso } from '../ids.js';

export interface SessionInfo {
  token: string;
  userId: string;
  expiresAt: string;
}

export interface IdentityProvider {
  readonly id: string;
  readonly isProductionProvider: boolean;
  /** Phase 1 (dev): khong co mat khau - day KHONG phai xac thuc that. */
  signIn(input: { email: string; displayName?: string }): Promise<{ session: SessionInfo; user: User }>;
  resolveSession(token: string, nowMs?: number): Promise<{ userId: string } | null>;
  revoke(token: string): Promise<void>;
}

interface StoredSession {
  /** Chi luu HASH cua token: log/dump bo nho khong lam lo token dung duoc. */
  tokenHash: Buffer;
  userId: string;
  expiresAtMs: number;
}

function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

export class DevIdentityProvider implements IdentityProvider {
  readonly id = 'dev-in-memory';
  readonly isProductionProvider = false;

  private readonly sessions: StoredSession[] = [];

  constructor(
    private readonly persistence: PersistencePort,
    private readonly sessionTtlSeconds: number,
  ) {}

  async signIn(input: { email: string; displayName?: string }): Promise<{ session: SessionInfo; user: User }> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.persistence.users.findByEmail(email);
    const user =
      existing ??
      (await this.persistence.users.create({
        id: newId('usr'),
        email,
        displayName: input.displayName?.trim() || email.split('@')[0] || email,
        defaultLocale: 'vi',
        createdAt: nowIso(),
      }));

    const token = randomBytes(32).toString('base64url');
    const expiresAtMs = Date.now() + this.sessionTtlSeconds * 1000;
    this.sessions.push({ tokenHash: hashToken(token), userId: user.id, expiresAtMs });
    return {
      session: { token, userId: user.id, expiresAt: new Date(expiresAtMs).toISOString() },
      user,
    };
  }

  async resolveSession(token: string, nowMs: number = Date.now()): Promise<{ userId: string } | null> {
    const wanted = hashToken(token);
    for (const session of this.sessions) {
      if (session.tokenHash.length !== wanted.length) continue;
      if (!timingSafeEqual(session.tokenHash, wanted)) continue;
      if (session.expiresAtMs < nowMs) return null;
      return { userId: session.userId };
    }
    return null;
  }

  async revoke(token: string): Promise<void> {
    const wanted = hashToken(token);
    const index = this.sessions.findIndex(
      (s) => s.tokenHash.length === wanted.length && timingSafeEqual(s.tokenHash, wanted),
    );
    if (index >= 0) this.sessions.splice(index, 1);
  }
}
