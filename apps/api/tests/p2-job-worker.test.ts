/**
 * P2-MCP-28: worker tu chay job.
 *
 * Phep thu quan trong nhat: HAI worker chay song song khong duoc cung nhan mot job. Neu cung
 * nhan, mot tep bi xu ly hai lan va muc dung bi tinh hai lan.
 *
 * Chay tren CA HAI adapter luu tru. Ban PostgreSQL moi thuc su kiem duoc `FOR UPDATE SKIP LOCKED`.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { join } from 'node:path';
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

describe('P2-MCP-28 — worker tu chay job', () => {
  it('KHONG con phai goi tay: worker tu nhan job queued va chay xong', async () => {
    const { app, ctx, ws, jobId } = await readyJob();
    expect((await ctx.persistence.jobs.findById(ws, jobId))?.state).toBe('queued');

    const worker = new JobWorker(ctx, { maxCycles: 3, idleDelayMs: 1 });
    await worker.start();

    expect((await ctx.persistence.jobs.findById(ws, jobId))?.state).toBe('completed');
    expect(worker.stats.completed).toBe(1);
    await app.close();
  });

  it('khong con gi de lam thi tra null, KHONG quay vong', async () => {
    const { app, ctx } = await makeApp();
    const worker = new JobWorker(ctx, { maxCycles: 2, idleDelayMs: 1 });
    expect(await worker.runOnce()).toBeNull();
    const stats = await worker.start();
    expect(stats.claimed).toBe(0);
    await app.close();
  });

  it('nhan job roi thi job KHONG con o hang doi (nhan hai lan khong lay lai duoc)', async () => {
    const { app, ctx, jobId } = await readyJob();
    const first = await ctx.persistence.jobs.claimQueued(new Date().toISOString());
    expect(first?.id).toBe(jobId);
    expect(first?.state).toBe('processing');
    // Lan hai khong con gi: job da roi khoi hang doi.
    expect(await ctx.persistence.jobs.claimQueued(new Date().toISOString())).toBeNull();
    await app.close();
  });

  it('HAI worker chay SONG SONG chi mot ben nhan duoc job', async () => {
    const { app, ctx, ws, jobId } = await readyJob();
    const a = new JobWorker(ctx, { maxCycles: 1, idleDelayMs: 1 });
    const b = new JobWorker(ctx, { maxCycles: 1, idleDelayMs: 1 });

    // Chay dong thoi, khong cho ben nay xong roi moi chay ben kia.
    const [ra, rb] = await Promise.all([a.runOnce(), b.runOnce()]);
    const nhanDuoc = [ra, rb].filter((r) => r !== null);
    expect(nhanDuoc, 'hai worker cung nhan mot job => tep bi xu ly hai lan').toHaveLength(1);

    // Va muc dung chi duoc tinh MOT lan.
    const ledger = await ctx.persistence.usage.listByWorkspace(ws);
    expect(ledger.filter((e) => e.entryType === 'commit')).toHaveLength(1);
    expect((await ctx.persistence.jobs.findById(ws, jobId))?.state).toBe('completed');
    await app.close();
  });

  it('worker dung duoc, va dung SAU KHI xong job hien tai', async () => {
    const { app, ctx, ws, jobId } = await readyJob();
    const worker = new JobWorker(ctx, { idleDelayMs: 1 });
    const running = worker.start();
    // Cho toi khi job xong roi moi yeu cau dung.
    for (let i = 0; i < 200; i += 1) {
      const job = await ctx.persistence.jobs.findById(ws, jobId);
      if (job?.state === 'completed') break;
      await new Promise((r) => setTimeout(r, 10));
    }
    worker.stop();
    const stats = await running;
    expect(stats.completed).toBe(1);
    expect(worker.isRunning).toBe(false);
    await app.close();
  });

  it('mot job hong KHONG lam chet worker', async () => {
    const { app, ctx } = await readyJob();
    const worker = new JobWorker(ctx, { maxCycles: 2, idleDelayMs: 1 });
    // Ep `claimQueued` nem loi o vong dau.
    let called = 0;
    const real = ctx.persistence.jobs.claimQueued.bind(ctx.persistence.jobs);
    ctx.persistence.jobs.claimQueued = async (now: string) => {
      called += 1;
      if (called === 1) throw new Error('loi gia lap');
      return real(now);
    };
    const stats = await worker.start();
    expect(stats.cycles).toBe(2);
    // Vong hai van chay duoc: worker khong chet vi vong mot.
    expect(stats.completed).toBe(1);
    await app.close();
  });
});

if (URL) {
  const pools: Pool[] = [];
  afterAll(async () => {
    await Promise.all(pools.map((p) => p.end()));
  });

  describe('P2-MCP-28 — nhan job tren PostgreSQL THAT (FOR UPDATE SKIP LOCKED)', { timeout: 30_000 }, () => {
    async function pgPersistence(): Promise<PersistencePort> {
      const schema = `mcp_w_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      const admin = new Pool({ connectionString: URL });
      await admin.query(`CREATE SCHEMA "${schema}"`);
      await admin.end();
      const pool = new Pool({ connectionString: URL, options: `-c search_path=${schema}` });
      pools.push(pool);
      await runMigrations(pool, MIGRATIONS);
      return new PostgresPersistence(pool, { id: `postgres-worker-${schema}` });
    }

    it('worker chay xong job tren PostgreSQL that', async () => {
      const { app, ctx, ws, jobId } = await readyJob(await pgPersistence());
      const worker = new JobWorker(ctx, { maxCycles: 3, idleDelayMs: 1 });
      await worker.start();
      expect((await ctx.persistence.jobs.findById(ws, jobId))?.state).toBe('completed');
      await app.close();
    });

    it('BA worker chay song song: dung MOT ben nhan duoc, muc dung tinh dung mot lan', async () => {
      const { app, ctx, ws, jobId } = await readyJob(await pgPersistence());
      const workers = [0, 1, 2].map(() => new JobWorker(ctx, { maxCycles: 1, idleDelayMs: 1 }));
      const results = await Promise.all(workers.map((w) => w.runOnce()));
      expect(results.filter((r) => r !== null), 'SKIP LOCKED khong chan duoc').toHaveLength(1);

      const ledger = await ctx.persistence.usage.listByWorkspace(ws);
      expect(ledger.filter((e) => e.entryType === 'commit')).toHaveLength(1);
      expect((await ctx.persistence.jobs.findById(ws, jobId))?.state).toBe('completed');
      await app.close();
    });
  });
}
