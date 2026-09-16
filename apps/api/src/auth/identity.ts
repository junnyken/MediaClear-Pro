/**
 * IdentityProvider - cong danh tinh (MCP-10 Phase 1).
 *
 * Q-14 (auth provider production) VAN DANG MO: Phase 1 khong duoc chot IdP nao.
 * Vi vay chi co DevIdentityProvider, tu khai `isProductionProvider = false`, va
 * /healthz phai lo dieu do ra. Khi owner chot Q-14 thi them mot implementation
 * cua chinh port nay, khong sua domain.
 */
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { ERROR_CODES, apiError, type ApiError, type User } from '@mediaclear/contracts';
import type { PersistencePort } from '../persistence/port.js';
import { newId, nowIso } from '../ids.js';
import { PASSWORD_MIN_LENGTH, hashPassword, passwordTooShort, verifyPassword } from './password.js';

export interface SessionInfo {
  token: string;
  userId: string;
  expiresAt: string;
}

export type SignInResult =
  | { ok: true; session: SessionInfo; user: User }
  | { ok: false; error: ApiError };

export interface IdentityProvider {
  readonly id: string;
  readonly isProductionProvider: boolean;
  /**
   * Phase 1 (dev): khong co mat khau - day KHONG phai xac thuc that.
   * P2-MCP-25: ban production nhan them `password`.
   */
  signIn(input: { email: string; displayName?: string }): Promise<{ session: SessionInfo; user: User }>;
  resolveSession(token: string, nowMs?: number): Promise<{ userId: string } | null>;
  revoke(token: string): Promise<void>;
}

/**
 * P2-MCP-25: cong xac thuc THAT. Tach rieng khoi `IdentityProvider` de khong ep
 * DevIdentityProvider phai gia vo co dang ky va mat khau.
 */
export interface PasswordIdentityPort extends IdentityProvider {
  register(input: { email: string; password: string; displayName?: string }): Promise<SignInResult>;
  signInWithPassword(input: { email: string; password: string }): Promise<SignInResult>;
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

  /**
   * `now` PHAI la cung mot dong ho voi phan con lai cua ung dung.
   * Dung Date.now() truc tiep o day se tao ra hai nguon thoi gian trong cung mot
   * tien trinh: phien tao theo dong ho nay nhung duoc kiem theo dong ho kia.
   */
  constructor(
    private readonly persistence: PersistencePort,
    private readonly sessionTtlSeconds: number,
    private readonly now: () => Date = () => new Date(),
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
    const expiresAtMs = this.now().getTime() + this.sessionTtlSeconds * 1000;
    this.sessions.push({ tokenHash: hashToken(token), userId: user.id, expiresAtMs });
    return {
      session: { token, userId: user.id, expiresAt: new Date(expiresAtMs).toISOString() },
      user,
    };
  }

  async resolveSession(token: string, nowMs: number = this.now().getTime()): Promise<{ userId: string } | null> {
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

/**
 * PasswordIdentityProvider - xac thuc that (P2-MCP-25, owner decision Q-14).
 *
 * Khac DevIdentityProvider o hai diem quyet dinh:
 *   1. CO mat khau. Go mot email bat ky khong con la duong vao.
 *   2. Phien nam trong DATABASE, khong trong bo nho tien trinh => SONG SOT qua khoi dong lai.
 *      Day dung la lo hong tim ra o P2-MCP-23: du lieu ben vung roi nhung phien thi chua.
 *
 * Token chi ton tai o dang ro DUNG MOT LAN - luc tra ve cho client. Trong database chi co hash.
 */
export class PasswordIdentityProvider implements PasswordIdentityPort {
  readonly id = 'password-phase2';
  readonly isProductionProvider = true;

  constructor(
    private readonly persistence: PersistencePort,
    private readonly sessionTtlSeconds: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async register(input: { email: string; password: string; displayName?: string }): Promise<SignInResult> {
    const email = input.email.trim().toLowerCase();
    if (email.length === 0 || !email.includes('@')) {
      return { ok: false, error: apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { field: 'email' }) };
    }
    if (passwordTooShort(input.password)) {
      return {
        ok: false,
        error: apiError(ERROR_CODES.MCP_AUTH_PASSWORD_TOO_SHORT, { minLength: PASSWORD_MIN_LENGTH }),
      };
    }
    const existing = await this.persistence.users.findByEmail(email);
    if (existing) {
      // KHONG noi "email nay da ton tai" bang mot ma loi rieng: do la mot kenh do email.
      // Nguoi that su so huu email van dang nhap duoc, nen ho khong mat gi.
      return { ok: false, error: apiError(ERROR_CODES.MCP_AUTH_INVALID_CREDENTIALS) };
    }
    const user = await this.persistence.users.create({
      id: newId('usr'),
      email,
      displayName: input.displayName?.trim() || email.split('@')[0] || email,
      defaultLocale: 'vi',
      createdAt: this.now().toISOString(),
    });
    await this.persistence.users.setPassword(user.id, await hashPassword(input.password), this.now().toISOString());
    return { ok: true, ...(await this.issueSession(user)) };
  }

  async signInWithPassword(input: { email: string; password: string }): Promise<SignInResult> {
    const email = input.email.trim().toLowerCase();
    const user = await this.persistence.users.findByEmail(email);
    const stored = user ? await this.persistence.users.findPasswordHash(user.id) : null;
    // Luon chay verify de thoi gian tra loi khong to ra email co ton tai hay khong.
    const okPassword = await verifyPassword(input.password, stored);
    if (!user || !okPassword) {
      return { ok: false, error: apiError(ERROR_CODES.MCP_AUTH_INVALID_CREDENTIALS) };
    }
    return { ok: true, ...(await this.issueSession(user)) };
  }

  /** Cong nay khong dung duoc khi khong co mat khau - de tranh mo lai duong dev. */
  async signIn(): Promise<{ session: SessionInfo; user: User }> {
    throw new Error('PasswordIdentityProvider yeu cau mat khau: dung signInWithPassword()');
  }

  async resolveSession(token: string, nowMs = this.now().getTime()): Promise<{ userId: string } | null> {
    const row = await this.persistence.sessions.findByTokenHash(hashToken(token).toString('base64'));
    if (!row) return null;
    if (row.revokedAt !== null) return null;
    if (new Date(row.expiresAt).getTime() < nowMs) return null;
    return { userId: row.userId };
  }

  async revoke(token: string): Promise<void> {
    await this.persistence.sessions.revoke(hashToken(token).toString('base64'), this.now().toISOString());
  }

  private async issueSession(user: User): Promise<{ session: SessionInfo; user: User }> {
    const token = randomBytes(32).toString('base64url');
    const issuedAt = this.now().getTime();
    const expiresAt = new Date(issuedAt + this.sessionTtlSeconds * 1000).toISOString();
    await this.persistence.sessions.create({
      id: newId('ses'),
      userId: user.id,
      tokenHash: hashToken(token).toString('base64'),
      createdAt: new Date(issuedAt).toISOString(),
      expiresAt,
      revokedAt: null,
    });
    return { session: { token, userId: user.id, expiresAt }, user };
  }
}

/**
 * CompositeIdentityProvider - hai duong vao song song (P2-MCP-25).
 *
 * Ly do ton tai: `/v1/auth/dev-session` (dev_only) va `/v1/auth/sign-in` (that) cap ra hai loai
 * token khac nhau, nhung MOI cho kiem quyen chi goi DUNG MOT cho de doi token ra nguoi dung.
 * Neu chi giu mot provider thi mot trong hai duong se hong.
 *
 * `isProductionProvider` = TRUE khi va chi khi cua dev DA DONG. Neu cua dev con mo thi du co
 * mat khau, he thong van khong duoc tu nhan la xac thuc production - vi van co duong vao khong
 * can mat khau.
 */
export class CompositeIdentityProvider implements IdentityProvider {
  readonly id: string;

  constructor(
    private readonly password: PasswordIdentityPort,
    private readonly dev: IdentityProvider,
    private readonly devAuthEnabled: boolean,
  ) {
    this.id = devAuthEnabled ? `${password.id}+${dev.id}` : password.id;
  }

  get isProductionProvider(): boolean {
    return !this.devAuthEnabled;
  }

  /** Chi duong dev goi den day; route dev-session da tu kiem `devAuthEnabled` truoc do. */
  async signIn(input: { email: string; displayName?: string }): Promise<{ session: SessionInfo; user: User }> {
    return this.dev.signIn(input);
  }

  async resolveSession(token: string, nowMs?: number): Promise<{ userId: string } | null> {
    return (await this.password.resolveSession(token, nowMs)) ?? (await this.dev.resolveSession(token, nowMs));
  }

  async revoke(token: string): Promise<void> {
    await this.password.revoke(token);
    await this.dev.revoke(token);
  }
}
