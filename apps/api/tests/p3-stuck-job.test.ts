/**
 * P3 (D-060): cuu job KET.
 *
 * Lo hong truoc muc nay: worker chet giua chung - het bo nho, container bi thay, may khoi dong
 * lai - thi job no dang cam nam o `processing` VINH VIEN. `claimQueued` chi nhin `queued` nen
 * khong worker nao nhan lai, va khong co gi danh dau no that bai. Man hinh nguoi dung bao
 * "dang xu ly" mai mai, va phan muc dung da giu thi khong bao gio duoc tra lai.
 *
 * Bo test nay kiem bon dieu, va ca bon deu la dieu co the hong RIENG:
 *   1. job ket ĐUOC cuu va chay xong that;
 *   2. job dang chay binh thuong KHONG bi cuop - nho nhip tim;
 *   3. job DOC (job lam worker chet) dung han sau `maxAttempts`, khong lap vo tan;
 *   4. chay lai KHONG tinh tien hai lan.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { join } from 'node:path';
import { ERROR_CODES } from '@mediaclear/contracts';
import { attest, createJob, createProject, createWorkspace, makeApp, signIn, uploadFixture, validateAsset } from './helpers.js';
import { JobWorker } from '../src/worker/job-worker.js';
import { PostgresPersistence } from '../src/persistence/postgres.js';
import { runMigrations } from '../src/db/migrate.js';
import type { PersistencePort } from '../src/persistence/port.js';

const URL = process.env.MEDIACLEAR_TEST_DATABASE_URL;
const MIGRATIONS = join(import.meta.dirname, '../../../db/migrations');

async function readyJob(persistence?: PersistencePort) {
  const { app, ctx } = await makeApp(persistence ? { persistence } : {});
  const token = await signIn(app, `owner-${Date.now()}-${Math.random()}@matbao.com`);
  const ws = await createWorkspace(app, token, 'Studio');
  const project = await createProject(app, token, ws, 'Du an');
  const uploaded = await uploadFixture(app, token, ws, project, 'sample.png', {
    mimeType: 'image/png',
    mediaType: 'image',
  });
  await validateAsset(app, token, ws, uploaded.assetId);
  await attest(app, token, ws, uploaded.assetId);
  const created = await createJob(app, token, ws, uploaded.assetId, { operations: ['blur'] });
  return { app, ctx, ws, jobId: created.body.data.job.id as string };
}

function agoMs(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

/**
 * Dung lai canh worker chet giua chung: job DA o `processing` va `updatedAt` dung tu lau.
 * Khong co cach nao khac de dung lai canh nay - khong the that su giet mot tien trinh trong test.
 */
async function ketTu(ctx: Awaited<ReturnType<typeof readyJob>>['ctx'], ws: string, jobId: string, opts: { truocMs: number; attemptCount?: number }) {
  const job = await ctx.persistence.jobs.findById(ws, jobId);
  if (!job) throw new Error('khong tim thay job vua tao');
  await ctx.persistence.jobs.update({
    ...job,
    state: 'processing',
    attemptCount: opts.attemptCount ?? job.attemptCount,
    updatedAt: agoMs(opts.truocMs),
  });
}

describe('P3 (D-060) — job ket o `processing` duoc cuu', () => {
  it('job ket ĐUOC nhan lai va chay xong - truoc muc nay no nam mai mai', async () => {
    const { app, ctx, ws, jobId } = await readyJob();
    await ketTu(ctx, ws, jobId, { truocMs: 3_600_000 });

    // Chung minh lo hong co that: hang doi khong con thay job nay nua.
    expect(await ctx.persistence.jobs.claimQueued(new Date().toISOString())).toBeNull();

    const worker = new JobWorker(ctx, { maxCycles: 3, idleDelayMs: 1, staleAfterMs: 60_000 });
    await worker.start();

    const sau = await ctx.persistence.jobs.findById(ws, jobId);
    expect(sau?.state, 'job ket khong duoc cuu - nguoi dung van thay "dang xu ly"').toBe('completed');
    expect(sau?.outputAssetId).not.toBeNull();
    expect(worker.stats.reclaimed).toBe(1);

    // Viec he thong tu lam sau lung nguoi dung phai co dau vet.
    const audit = (await ctx.persistence.audit.listByWorkspace(ws)).items;
    expect(audit.map((e) => e.eventType)).toContain('processing_job_reclaimed');
    await app.close();
  });

  it('job dang chay BINH THUONG khong bi cuop', async () => {
    const { app, ctx, ws, jobId } = await readyJob();
    // Moi cham 1 giay truoc, nguong la 60 giay => van dang chay.
    await ketTu(ctx, ws, jobId, { truocMs: 1_000 });

    const worker = new JobWorker(ctx, { maxCycles: 2, idleDelayMs: 1, staleAfterMs: 60_000 });
    await worker.start();

    expect(worker.stats.reclaimed, 'cuop mat job cua worker dang song => render hai lan').toBe(0);
    expect((await ctx.persistence.jobs.findById(ws, jobId))?.state).toBe('processing');
    await app.close();
  });

  it('nhip tim dap that trong luc chay - day la thu lam "im lang lau" khac "chay lau"', async () => {
    const { app, ctx, ws, jobId } = await readyJob();
    let nhip = 0;
    const thatSu = ctx.persistence.jobs.touch.bind(ctx.persistence.jobs);
    ctx.persistence.jobs.touch = async (w: string, id: string, now: string) => {
      nhip += 1;
      return thatSu(w, id, now);
    };
    // Lam job chay cham hon nhip tim, neu khong thi khong co nhip nao kip dap.
    const doc = ctx.storage.getObject.bind(ctx.storage);
    ctx.storage.getObject = async (ref: Parameters<typeof doc>[0]) => {
      await new Promise((r) => setTimeout(r, 40));
      return doc(ref);
    };

    const worker = new JobWorker(ctx, { maxCycles: 2, idleDelayMs: 1, heartbeatMs: 5 });
    await worker.start();

    expect(nhip, 'khong co nhip nao => job dai se bi coi la ket va render lan hai').toBeGreaterThan(0);
    expect((await ctx.persistence.jobs.findById(ws, jobId))?.state).toBe('completed');
    await app.close();
  });

  it('job DOC dung han sau `maxAttempts` thay vi lap vo tan, va duoc TRA lai phan da giu', async () => {
    const { app, ctx, ws, jobId } = await readyJob();
    // Da duoc cuu 2 lan roi ma van ket => lan nay la lan vuot tran.
    await ketTu(ctx, ws, jobId, { truocMs: 3_600_000, attemptCount: 2 });

    const worker = new JobWorker(ctx, { maxCycles: 3, idleDelayMs: 1, staleAfterMs: 60_000, maxAttempts: 2 });
    await worker.start();

    const sau = await ctx.persistence.jobs.findById(ws, jobId);
    expect(sau?.state, 'job doc van duoc chay lai => moi lan cuu lai giet them mot worker').toBe('failed');
    expect(sau?.reasonCode).toBe(ERROR_CODES.MCP_JOB_MAX_ATTEMPTS_EXCEEDED);
    expect(worker.stats.abandoned).toBe(1);
    // Khong chay thi khong duoc giu tien: phai co but toan hoan tra, va tuyet doi khong co but toan tinh tien.
    const ledger = await ctx.persistence.usage.listByWorkspace(ws);
    expect(ledger.filter((e) => e.entryType === 'release')).toHaveLength(1);
    expect(ledger.filter((e) => e.entryType === 'commit')).toHaveLength(0);
    await app.close();
  });

  it('job chet SAU khi da tinh tien: chay lai KHONG tinh lan hai', async () => {
    const { app, ctx, ws, jobId } = await readyJob();
    // Chay tron ven mot lan => da co but toan commit.
    await new JobWorker(ctx, { maxCycles: 2, idleDelayMs: 1 }).start();
    expect((await ctx.persistence.usage.listByWorkspace(ws)).filter((e) => e.entryType === 'commit')).toHaveLength(1);

    // Roi dung lai canh: worker chet dung sau khi tinh tien, truoc khi kip ghi `completed`.
    await ketTu(ctx, ws, jobId, { truocMs: 3_600_000 });

    const worker = new JobWorker(ctx, { maxCycles: 3, idleDelayMs: 1, staleAfterMs: 60_000 });
    await worker.start();

    expect(worker.stats.reclaimed).toBe(1);
    const ledger = await ctx.persistence.usage.listByWorkspace(ws);
    expect(ledger.filter((e) => e.entryType === 'commit'), 'chay lai tinh tien hai lan').toHaveLength(1);
    await app.close();
  });

  it('job dang CHO duoc uu tien hon job ket - viec chac chan truoc, viec nghi ngo sau', async () => {
    const { app, ctx, ws, jobId } = await readyJob();
    await ketTu(ctx, ws, jobId, { truocMs: 3_600_000 });
    // Job thu hai, dang xep hang binh thuong.
    const cho = await ctx.persistence.jobs.findById(ws, jobId);
    await ctx.persistence.jobs.create({
      ...cho!, id: 'job_dang_cho', state: 'queued', attemptCount: 1,
      idempotencyKey: 'key_dang_cho', outputAssetId: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });

    const worker = new JobWorker(ctx, { maxCycles: 1, idleDelayMs: 1, staleAfterMs: 60_000 });
    const outcome = await worker.runOnce();
    expect(outcome?.jobId).toBe('job_dang_cho');
    expect(worker.stats.reclaimed).toBe(0);
    await app.close();
  });
});

if (URL) {
  const pools: Pool[] = [];
  afterAll(async () => {
    await Promise.all(pools.map((p) => p.end()));
  });

  describe('P3 (D-060) — cuu job ket tren PostgreSQL THAT', { timeout: 30_000 }, () => {
    async function pgPersistence(): Promise<PersistencePort> {
      const schema = `mcp_s_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      const admin = new Pool({ connectionString: URL });
      await admin.query(`CREATE SCHEMA "${schema}"`);
      await admin.end();
      const pool = new Pool({ connectionString: URL, options: `-c search_path=${schema}` });
      pools.push(pool);
      await runMigrations(pool, MIGRATIONS);
      return new PostgresPersistence(pool, { id: `postgres-stuck-${schema}` });
    }

    it('job ket duoc cuu va chay xong tren PostgreSQL that', async () => {
      const { app, ctx, ws, jobId } = await readyJob(await pgPersistence());
      await ketTu(ctx, ws, jobId, { truocMs: 3_600_000 });
      const worker = new JobWorker(ctx, { maxCycles: 3, idleDelayMs: 1, staleAfterMs: 60_000 });
      await worker.start();
      expect((await ctx.persistence.jobs.findById(ws, jobId))?.state).toBe('completed');
      await app.close();
    });

    it('BA worker cung thay mot job ket: dung MOT ben nhan duoc (SKIP LOCKED)', async () => {
      const { app, ctx, ws, jobId } = await readyJob(await pgPersistence());
      await ketTu(ctx, ws, jobId, { truocMs: 3_600_000 });

      const workers = [0, 1, 2].map(() => new JobWorker(ctx, { maxCycles: 1, idleDelayMs: 1, staleAfterMs: 60_000 }));
      const results = await Promise.all(workers.map((w) => w.runOnce()));
      expect(results.filter((r) => r !== null), 'hai worker cung cuu mot job => render hai lan').toHaveLength(1);

      const ledger = await ctx.persistence.usage.listByWorkspace(ws);
      expect(ledger.filter((e) => e.entryType === 'commit')).toHaveLength(1);
      expect((await ctx.persistence.jobs.findById(ws, jobId))?.state).toBe('completed');
      await app.close();
    });
  });
}
