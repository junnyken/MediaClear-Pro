/**
 * P2-MCP-32: phan trang nhat ky kiem toan.
 *
 * Truoc muc nay `listByWorkspace` chi co `limit` va tra mang: nhat ky dai hon `limit` thi phan
 * con lai KHONG CO DUONG NAO doc toi. Voi mot ban ghi dung de doi chieu ve sau, "khong doc toi
 * duoc" nghia la khong dung duoc.
 *
 * Phep thu quan trong nhat: di HET cac trang phai ra dung tap hop ban dau - khong thieu mot muc,
 * khong lap mot muc. Chi kiem "trang dau co du 2 muc" thi mot con tro nhay coc van xanh.
 *
 * Chay tren CA HAI adapter. Ban in-memory TUNG sap xep khong co khoa phu `id`, nen voi cac su
 * kien cung moc thoi gian thu tu la tuy y - dung loai loi ma bo test hai-adapter sinh ra de bat.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { join } from 'node:path';
import { InMemoryPersistence } from '../src/persistence/in-memory.js';
import { PostgresPersistence } from '../src/persistence/postgres.js';
import { runMigrations } from '../src/db/migrate.js';
import type { PersistencePort } from '../src/persistence/port.js';
import type { AuditEvent } from '../src/persistence/types.js';

const URL = process.env.MEDIACLEAR_TEST_DATABASE_URL;
const MIGRATIONS = join(import.meta.dirname, '../../../db/migrations');
const WS = 'wsp_nhat_ky';

function event(n: number, occurredAt: string): AuditEvent {
  return {
    id: `aud_${String(n).padStart(4, '0')}`,
    workspaceId: WS,
    actorUserId: null,
    eventType: 'processing_job_created',
    subjectType: 'job',
    subjectId: `job_${n}`,
    detail: { n },
    occurredAt,
  };
}

/** Doc HET moi trang, tra ra danh sach id theo dung thu tu da doc. */
async function readAllPages(db: PersistencePort, limit: number): Promise<string[]> {
  const seen: string[] = [];
  let cursor: string | null = null;
  for (let guard = 0; guard < 50; guard++) {
    const page = await db.audit.listByWorkspace(WS, { limit, cursor });
    seen.push(...page.items.map((e) => e.id));
    if (!page.nextCursor) return seen;
    cursor = page.nextCursor;
  }
  throw new Error('khong bao gio het trang - con tro khong tien');
}

function contractSuite(label: string, make: () => Promise<PersistencePort>): void {
  describe(`Phan trang nhat ky — ${label}`, () => {
    it('di HET cac trang ra dung tap hop, khong thieu khong lap', async () => {
      const db = await make();
      const total = 17;
      for (let i = 0; i < total; i++) {
        await db.audit.append(event(i, new Date(Date.UTC(2026, 8, 16, 10, 0, i)).toISOString()));
      }
      const ids = await readAllPages(db, 5);
      expect(ids).toHaveLength(total);
      expect(new Set(ids).size, 'co muc bi lap').toBe(total);
    });

    it('MOI NHAT TRUOC - trang dau la su kien gan nhat', async () => {
      const db = await make();
      for (let i = 0; i < 5; i++) {
        await db.audit.append(event(i, new Date(Date.UTC(2026, 8, 16, 10, 0, i)).toISOString()));
      }
      const page = await db.audit.listByWorkspace(WS, { limit: 2 });
      expect(page.items.map((e) => e.id)).toEqual(['aud_0004', 'aud_0003']);
    });

    it('CUNG MOC THOI GIAN van co thu tu on dinh - khong nhay, khong lap', async () => {
      const db = await make();
      // Tat ca CUNG mot moc: khong co khoa phu thi thu tu la tuy y va con tro se hong.
      const same = new Date(Date.UTC(2026, 8, 16, 10, 0, 0)).toISOString();
      const total = 9;
      for (let i = 0; i < total; i++) await db.audit.append(event(i, same));

      const ids = await readAllPages(db, 2);
      expect(ids, 'thieu hoac lap muc khi cung moc thoi gian').toHaveLength(total);
      expect(new Set(ids).size).toBe(total);
      // Thu tu phai giam dan theo id - on dinh giua hai lan doc.
      expect(ids).toEqual([...ids].sort().reverse());
    });

    it('doc lai voi CUNG con tro cho CUNG ket qua - con tro khong phu thuoc lan doc', async () => {
      const db = await make();
      for (let i = 0; i < 6; i++) {
        await db.audit.append(event(i, new Date(Date.UTC(2026, 8, 16, 10, 0, i)).toISOString()));
      }
      const first = await db.audit.listByWorkspace(WS, { limit: 2 });
      const a = await db.audit.listByWorkspace(WS, { limit: 2, cursor: first.nextCursor });
      const b = await db.audit.listByWorkspace(WS, { limit: 2, cursor: first.nextCursor });
      expect(a.items.map((e) => e.id)).toEqual(b.items.map((e) => e.id));
    });

    it('het du lieu thi nextCursor la null, khong phai chuoi rong', async () => {
      const db = await make();
      await db.audit.append(event(1, new Date(Date.UTC(2026, 8, 16, 10, 0, 0)).toISOString()));
      const page = await db.audit.listByWorkspace(WS, { limit: 10 });
      expect(page.nextCursor).toBeNull();
    });

    it('con tro HONG thi doc tu dau, khong nem loi va khong tra rong', async () => {
      const db = await make();
      for (let i = 0; i < 3; i++) {
        await db.audit.append(event(i, new Date(Date.UTC(2026, 8, 16, 10, 0, i)).toISOString()));
      }
      const page = await db.audit.listByWorkspace(WS, { limit: 10, cursor: 'khong-phai-con-tro' });
      expect(page.items).toHaveLength(3);
    });

    it('workspace khac khong lot vao trang nao', async () => {
      const db = await make();
      await db.audit.append(event(1, new Date(Date.UTC(2026, 8, 16, 10, 0, 0)).toISOString()));
      await db.audit.append({ ...event(2, new Date(Date.UTC(2026, 8, 16, 10, 0, 1)).toISOString()), workspaceId: 'wsp_khac' });
      const ids = await readAllPages(db, 1);
      expect(ids).toEqual(['aud_0001']);
    });
  });
}

contractSuite('InMemoryPersistence', async () => new InMemoryPersistence());

if (URL) {
  const pools: Pool[] = [];
  let n = 0;
  contractSuite('PostgresPersistence (PostgreSQL THAT)', async () => {
    const schema = `audit_page_${Date.now()}_${n++}`;
    const pool = new Pool({ connectionString: URL });
    pools.push(pool);
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    await pool.query(`SET search_path TO ${schema}`);
    pool.on('connect', (c) => void c.query(`SET search_path TO ${schema}`));
    await runMigrations(pool, MIGRATIONS);
    await pool.query(
      `INSERT INTO users (id, email, display_name, default_locale, created_at)
       VALUES ('usr_np', 'np@matbao.com', 'NP', 'vi', now()) ON CONFLICT DO NOTHING`,
    );
    await pool.query(
      `INSERT INTO workspaces (id, name, owner_user_id, created_at)
       VALUES ($1, 'Nhat ky', 'usr_np', now()), ('wsp_khac', 'Khac', 'usr_np', now())
       ON CONFLICT DO NOTHING`,
      [WS],
    );
    return new PostgresPersistence(pool);
  });
  afterAll(async () => {
    for (const p of pools) await p.end();
  });
} else {
  describe.skip('Phan trang nhat ky — PostgresPersistence (thieu MEDIACLEAR_TEST_DATABASE_URL)', () => {
    it('bo qua', () => undefined);
  });
}
