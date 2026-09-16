/**
 * P3 (D-062): worker tu chay viec bao tri dinh ky.
 *
 * Lo hong truoc muc nay: `expireReservations` DA co va da dung, nhung CHI chay khi co nguoi goi
 * tay route noi bo - dung cai lo hong ma `P2-MCP-28` da dong cho job. Nguoi dung bo do mot job
 * thi phan muc dung bi giu lai cho toi khi co ai do nho ra ma goi. Tren may that, khong ai goi.
 *
 * Bo test nay kiem ba dieu:
 *   1. worker TU hoan tra, khong can goi tay;
 *   2. chay lai khong hoan tra hai lan;
 *   3. bao tri hong KHONG keo theo viec chay job - viec chinh khong phu thuoc viec phu.
 */
import { describe, expect, it } from 'vitest';
import { EXPIRY_RELEASE_REASON } from '@mediaclear/contracts';
import { attest, createJob, createProject, createWorkspace, makeApp, signIn, uploadFixture, validateAsset } from './helpers.js';
import { JobWorker } from '../src/worker/job-worker.js';

const NUA_GIO_HON = 40 * 60_000;

/** Dong ho DOI DUOC: khoan giu het han sau 30 phut, khong the ngoi cho that 30 phut trong test. */
async function readyJob() {
  let lech = 0;
  const { app, ctx } = await makeApp({ now: () => new Date(Date.now() + lech) });
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
  return {
    app, ctx, ws,
    jobId: created.body.data.job.id as string,
    tuaToi: (ms: number) => { lech = ms; },
  };
}

/**
 * Dua job ra khoi tam voi cua worker de bai toan chi con lai MOT thu: khoan giu.
 * `review_required` la trang thai that (P3-MCP-33) - job cho nguoi xem lai ma khong ai xem.
 */
async function choXemLai(ctx: Awaited<ReturnType<typeof readyJob>>['ctx'], ws: string, jobId: string) {
  const job = await ctx.persistence.jobs.findById(ws, jobId);
  if (!job) throw new Error('khong tim thay job vua tao');
  await ctx.persistence.jobs.update({ ...job, state: 'review_required' });
}

describe('P3 (D-062) — worker tu chay viec bao tri', () => {
  it('khoan giu qua han duoc hoan tra TU DONG, khong can goi tay route noi bo', async () => {
    const { app, ctx, ws, jobId, tuaToi } = await readyJob();
    await choXemLai(ctx, ws, jobId);

    const truoc = await ctx.persistence.usage.listByWorkspace(ws);
    expect(truoc.filter((e) => e.entryType === 'reserve')).toHaveLength(1);
    expect(truoc.filter((e) => e.entryType === 'release')).toHaveLength(0);

    tuaToi(NUA_GIO_HON);
    const worker = new JobWorker(ctx, { maxCycles: 1, idleDelayMs: 1 });
    await worker.start();

    const sau = await ctx.persistence.usage.listByWorkspace(ws);
    const tra = sau.filter((e) => e.entryType === 'release');
    expect(tra, 'khoan giu qua han khong duoc hoan tra - nguoi dung mat suat ma khong dung gi').toHaveLength(1);
    expect(tra[0]?.reasonCode).toBe(EXPIRY_RELEASE_REASON);
    expect(worker.stats.reservationsReleased).toBe(1);
    await app.close();
  });

  it('chay nhieu vong KHONG hoan tra hai lan', async () => {
    const { app, ctx, ws, jobId, tuaToi } = await readyJob();
    await choXemLai(ctx, ws, jobId);
    tuaToi(NUA_GIO_HON);

    // Moi vong deu den han bao tri => bao tri chay ca ba vong.
    const worker = new JobWorker(ctx, { maxCycles: 3, idleDelayMs: 1, maintenanceIntervalMs: 0 });
    await worker.start();

    expect(worker.stats.maintenanceRuns).toBe(3);
    expect(worker.stats.reservationsReleased, 'hoan tra hai lan = tra du suat cho nguoi dung').toBe(1);
    expect((await ctx.persistence.usage.listByWorkspace(ws)).filter((e) => e.entryType === 'release')).toHaveLength(1);
    await app.close();
  });

  it('bao tri HONG khong lam worker bo luot chay job', async () => {
    const { app, ctx, ws, jobId } = await readyJob();
    ctx.persistence.usage.listAll = async () => {
      throw new Error('loi gia lap khi doc so muc dung');
    };

    const worker = new JobWorker(ctx, { maxCycles: 1, idleDelayMs: 1 });
    await worker.start();

    expect(worker.stats.maintenanceRuns).toBe(1);
    expect(
      (await ctx.persistence.jobs.findById(ws, jobId))?.state,
      'mot viec phu hong keo theo mot viec chinh dang tot',
    ).toBe('completed');
    await app.close();
  });

  it('khong chay bao tri day hon `maintenanceIntervalMs`', async () => {
    const { app, ctx } = await makeApp();
    // Vong dau chay ngay (chua chay lan nao), cac vong sau chua toi han mot phut.
    const worker = new JobWorker(ctx, { maxCycles: 5, idleDelayMs: 1, maintenanceIntervalMs: 60_000 });
    await worker.start();
    expect(worker.stats.cycles).toBe(5);
    expect(worker.stats.maintenanceRuns, 'quet so muc dung moi vong lap la dot CPU vo ich').toBe(1);
    await app.close();
  });
});
