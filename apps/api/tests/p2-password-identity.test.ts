/**
 * P2-MCP-25: xac thuc that + phien luu trong database.
 *
 * Chay tren CA HAI adapter luu tru. Phep thu quan trong nhat: dung MOT the hien provider MOI
 * (mo phong tien trinh vua khoi dong lai) de doc phien do the hien CU cap - truoc day phep
 * nay LUON that bai vi phien nam trong bo nho tien trinh.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { join } from 'node:path';
import { ERROR_CODES } from '@mediaclear/contracts';
import { InMemoryPersistence } from '../src/persistence/in-memory.js';
import { PostgresPersistence } from '../src/persistence/postgres.js';
import { runMigrations } from '../src/db/migrate.js';
import { PasswordIdentityProvider } from '../src/auth/identity.js';
import type { PersistencePort } from '../src/persistence/port.js';

const URL = process.env.MEDIACLEAR_TEST_DATABASE_URL;
const MIGRATIONS = join(import.meta.dirname, '../../../db/migrations');
const TTL = 3600;
const PASS = 'mat-khau-du-dai-1';

function suite(label: string, make: () => Promise<PersistencePort>): void {
  describe(`PasswordIdentityProvider — ${label}`, () => {
    it('dang ky roi dang nhap lai duoc', async () => {
      const db = await make();
      const auth = new PasswordIdentityProvider(db, TTL);
      const reg = await auth.register({ email: 'a@matbao.com', password: PASS });
      expect(reg.ok).toBe(true);

      const signIn = await auth.signInWithPassword({ email: 'a@matbao.com', password: PASS });
      expect(signIn.ok).toBe(true);
      if (signIn.ok) expect(signIn.user.email).toBe('a@matbao.com');
    });

    it('MAT KHAU SAI khong vao duoc', async () => {
      const db = await make();
      const auth = new PasswordIdentityProvider(db, TTL);
      await auth.register({ email: 'a@matbao.com', password: PASS });
      const bad = await auth.signInWithPassword({ email: 'a@matbao.com', password: 'sai-mat-khau-1' });
      expect(bad.ok).toBe(false);
      if (!bad.ok) expect(bad.error.code).toBe(ERROR_CODES.MCP_AUTH_INVALID_CREDENTIALS);
    });

    it('EMAIL KHONG TON TAI tra CUNG mot ma loi voi mat khau sai (khong do duoc email)', async () => {
      const db = await make();
      const auth = new PasswordIdentityProvider(db, TTL);
      await auth.register({ email: 'a@matbao.com', password: PASS });
      const khongCo = await auth.signInWithPassword({ email: 'khong-co@matbao.com', password: PASS });
      const saiPass = await auth.signInWithPassword({ email: 'a@matbao.com', password: 'sai-mat-khau-1' });
      expect(khongCo.ok).toBe(false);
      expect(saiPass.ok).toBe(false);
      if (!khongCo.ok && !saiPass.ok) expect(khongCo.error.code).toBe(saiPass.error.code);
    });

    it('dang ky TRUNG email cung tra ma loi do - khong xac nhan email ton tai', async () => {
      const db = await make();
      const auth = new PasswordIdentityProvider(db, TTL);
      await auth.register({ email: 'a@matbao.com', password: PASS });
      const lai = await auth.register({ email: 'a@matbao.com', password: 'mat-khau-khac-1' });
      expect(lai.ok).toBe(false);
      if (!lai.ok) expect(lai.error.code).toBe(ERROR_CODES.MCP_AUTH_INVALID_CREDENTIALS);
    });

    it('mat khau qua ngan bi tu choi', async () => {
      const db = await make();
      const auth = new PasswordIdentityProvider(db, TTL);
      const r = await auth.register({ email: 'b@matbao.com', password: 'ngan' });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe(ERROR_CODES.MCP_AUTH_PASSWORD_TOO_SHORT);
    });

    it('PHIEN SONG SOT qua "khoi dong lai": the hien MOI doc duoc phien cua the hien cu', async () => {
      const db = await make();
      const cu = new PasswordIdentityProvider(db, TTL);
      const reg = await cu.register({ email: 'c@matbao.com', password: PASS });
      expect(reg.ok).toBe(true);
      if (!reg.ok) return;

      // Tien trinh "khoi dong lai": provider moi, khong con gi trong bo nho.
      const moi = new PasswordIdentityProvider(db, TTL);
      const resolved = await moi.resolveSession(reg.session.token);
      expect(resolved?.userId).toBe(reg.user.id);
    });

    it('thu hoi roi thi token het tac dung', async () => {
      const db = await make();
      const auth = new PasswordIdentityProvider(db, TTL);
      const reg = await auth.register({ email: 'd@matbao.com', password: PASS });
      if (!reg.ok) throw new Error('dang ky that bai');
      expect(await auth.resolveSession(reg.session.token)).not.toBeNull();
      await auth.revoke(reg.session.token);
      expect(await auth.resolveSession(reg.session.token)).toBeNull();
    });

    it('phien HET HAN thi khong dung duoc nua', async () => {
      const db = await make();
      const auth = new PasswordIdentityProvider(db, 1);
      const reg = await auth.register({ email: 'e@matbao.com', password: PASS });
      if (!reg.ok) throw new Error('dang ky that bai');
      const sau = Date.now() + 5000;
      expect(await auth.resolveSession(reg.session.token, sau)).toBeNull();
    });

    it('token BIA khong vao duoc', async () => {
      const db = await make();
      const auth = new PasswordIdentityProvider(db, TTL);
      await auth.register({ email: 'f@matbao.com', password: PASS });
      expect(await auth.resolveSession('token-bia-hoan-toan')).toBeNull();
    });

    it('database CHI luu hash, khong luu token ro', async () => {
      const db = await make();
      const auth = new PasswordIdentityProvider(db, TTL);
      const reg = await auth.register({ email: 'g@matbao.com', password: PASS });
      if (!reg.ok) throw new Error('dang ky that bai');
      const rows = await db.sessions.listByUser(reg.user.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.tokenHash).not.toBe(reg.session.token);
      expect(rows[0]?.tokenHash).not.toContain(reg.session.token);
    });

    it('tu khai la provider production', async () => {
      const db = await make();
      expect(new PasswordIdentityProvider(db, TTL).isProductionProvider).toBe(true);
    });
  });
}

suite('InMemoryPersistence', async () => new InMemoryPersistence());

if (URL) {
  const pools: Pool[] = [];
  afterAll(async () => {
    await Promise.all(pools.map((p) => p.end()));
  });
  suite('PostgresPersistence (PostgreSQL THAT)', async () => {
    const schema = `mcp_auth_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const admin = new Pool({ connectionString: URL });
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.end();
    const pool = new Pool({ connectionString: URL, options: `-c search_path=${schema}` });
    pools.push(pool);
    await runMigrations(pool, MIGRATIONS);
    return new PostgresPersistence(pool, { id: `postgres-auth-${schema}` });
  });
}
