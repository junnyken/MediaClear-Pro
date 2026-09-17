/**
 * Workstream C — MCP-40…44 chay trong duong job THAT, khong phai service doc lap.
 *
 * Diem khac biet so voi `p4-tracking-gate.test.ts`: o day job di qua `executeClaimedJob` nhu mot
 * job that, va trang thai cuoi cung duoc doc lai TU CO SO DU LIEU chu khong tu gia tri tra ve.
 */
import { describe, expect, it } from 'vitest';
import { ffmpegAvailable } from '../src/media/ffmpeg.js';
import { executeClaimedJob } from '../src/services/run-job.js';
import { executeTrackedVideoJob } from '../src/services/run-tracked-video-job.js';
import { DeterministicTrackingProvider } from '../src/providers/tracking.js';
import { attest, createJob, createProject, createWorkspace, makeApp, signIn, uploadFixture, validateAsset } from './helpers.js';

const hasFfmpeg = await ffmpegAvailable();

async function trackedJob(fixture = 'video-with-audio.mp4') {
  const { app, ctx } = await makeApp();
  const token = await signIn(app, `o-${Date.now()}-${Math.random()}@matbao.com`);
  const ws = await createWorkspace(app, token, 'Studio');
  const prj = await createProject(app, token, ws, 'Du an');
  const up = await uploadFixture(app, token, ws, prj, fixture, { mimeType: 'video/mp4', mediaType: 'video' });
  await validateAsset(app, token, ws, up.assetId);
  await attest(app, token, ws, up.assetId);
  const created = await createJob(app, token, ws, up.assetId, { operations: ['tracked_inpaint'] });
  return { app, ctx, ws, token, created, assetId: up.assetId };
}

describe.skipIf(!hasFfmpeg)('Workstream C — Phase 4 trong duong job that', () => {
  it('job `tracked_inpaint` duoc NHAN, khong bi chan ngay o buoc tao', async () => {
    const { app, created } = await trackedJob();
    expect(created.status, JSON.stringify(created.body).slice(0, 300)).toBe(200);
    expect(created.body.data.job.state).toBe('queued');
    await app.close();
  });

  it('chay het duong: timeline duoc LUU, frame duoc luu, va so frame khop tep that', async () => {
    const { app, ctx, ws, created } = await trackedJob();
    const jobId = created.body.data.job.id as string;
    const claimed = await ctx.persistence.jobs.claimQueued(ctx.now().toISOString());
    await executeClaimedJob(ctx, claimed!);

    const timeline = await ctx.persistence.jobFrames.findTimeline(ws, jobId);
    expect(timeline, 'MCP-40 bi bo qua — khong co timeline nao duoc luu').not.toBeNull();
    expect(timeline!.expectedFrameCount).toBe(10); // do that bang ffprobe tren fixture

    const frames = await ctx.persistence.jobFrames.listFrames(ws, jobId);
    expect(frames).toHaveLength(timeline!.expectedFrameCount);
    await app.close();
  });

  it('toan bo frame dat => completed, va co output DA DOC LAI', async () => {
    const { app, ctx, ws, created } = await trackedJob();
    const jobId = created.body.data.job.id as string;
    const claimed = await ctx.persistence.jobs.claimQueued(ctx.now().toISOString());
    await executeClaimedJob(ctx, claimed!);

    const job = await ctx.persistence.jobs.findById(ws, jobId);
    expect(job?.state).toBe('completed');
    expect(job?.outputAssetId).not.toBeNull();
    const output = await ctx.persistence.outputs.findByJob(ws, jobId);
    expect(output?.validated, 'bao completed ma output chua doc lai').toBe(true);
    await app.close();
  });

  it('MOT frame confidence thap => review_required, KHONG completed', async () => {
    const { app, ctx, ws, created } = await trackedJob();
    ctx.trackingProvider = new DeterministicTrackingProvider({ occludedFrames: [4] });
    const jobId = created.body.data.job.id as string;
    const claimed = await ctx.persistence.jobs.claimQueued(ctx.now().toISOString());
    await executeClaimedJob(ctx, claimed!);

    const job = await ctx.persistence.jobs.findById(ws, jobId);
    expect(job?.state, '9/10 frame tot KHONG duoc coi la du').toBe('review_required');
    expect(job?.outputAssetId, 'khong duoc xuat output khi chua qua cong').toBeNull();
    const frames = await ctx.persistence.jobFrames.listFrames(ws, jobId);
    expect(frames.filter((f) => f.state === 'frame_low_confidence')).toHaveLength(1);
    await app.close();
  });

  it('provider QUA HAN => frame_failed va job KHONG completed', async () => {
    const { app, ctx, ws, created } = await trackedJob();
    ctx.trackingProvider = new DeterministicTrackingProvider({ timeoutFrames: [2] });
    const jobId = created.body.data.job.id as string;
    const claimed = await ctx.persistence.jobs.claimQueued(ctx.now().toISOString());
    await executeClaimedJob(ctx, claimed!);

    const job = await ctx.persistence.jobs.findById(ws, jobId);
    expect(job?.state).not.toBe('completed');
    const frames = await ctx.persistence.jobFrames.listFrames(ws, jobId);
    expect(frames.find((f) => f.frameIndex === 2)?.state).toBe('frame_failed');
    expect(frames.find((f) => f.frameIndex === 2)?.box, 'qua han ma van dien vi tri').toBeNull();
    await app.close();
  });

  it('TEP GOC khong bi ghi de (bat bien I-1)', async () => {
    const { app, ctx, ws, created } = await trackedJob();
    const jobId = created.body.data.job.id as string;
    const src = await ctx.persistence.sourceFiles.findById(ws, (await ctx.persistence.jobs.findById(ws, jobId))!.sourceFileId);
    const before = await ctx.storage.getObject({ bucket: ctx.bucket, key: src!.storageKey });

    const claimed = await ctx.persistence.jobs.claimQueued(ctx.now().toISOString());
    await executeClaimedJob(ctx, claimed!);

    const after = await ctx.storage.getObject({ bucket: ctx.bucket, key: src!.storageKey });
    expect(Buffer.from(after).equals(Buffer.from(before))).toBe(true);
    await app.close();
  });

  it('frame HONG DECODE trong tep that => khong completed, va frame hong nam trong tong so', async () => {
    const { app, ctx, ws, created } = await trackedJob('video-corrupt-frame.mp4');
    const jobId = created.body.data.job.id as string;
    const claimed = await ctx.persistence.jobs.claimQueued(ctx.now().toISOString());
    await executeClaimedJob(ctx, claimed!);

    const timeline = await ctx.persistence.jobFrames.findTimeline(ws, jobId);
    expect(timeline!.undecodableFrames, 'frame hong bien mat khoi tong so').toBe(1);
    const job = await ctx.persistence.jobs.findById(ws, jobId);
    expect(job?.state).not.toBe('completed');
    await app.close();
  });

  it('guard TU CHOI thi KHONG duoc tra ve `completed` — va phai cham DUNG nhanh tu choi', async () => {
    /*
     * Canh that: job bi HUY trong khi worker dang chay no. `cancelled` la trang thai terminal, nen
     * `canTransition` tu choi MOI chuyen doi tiep theo.
     *
     * Phien ban truoc cua phep kiem nay ep `markValidated` nem loi, va tu coi la dat khi co ngoai
     * le — nen no KHONG BAO GIO cham toi nhanh `!transition.allowed`. Doi chung am chung minh dieu
     * do: dot bien "guard bi tu choi nhung van tra completed" van XANH. Phep kiem nay khong co
     * duong thoat bang ngoai le nua.
     */
    const { app, ctx, ws, created } = await trackedJob();
    const jobId = created.body.data.job.id as string;
    const claimed = await ctx.persistence.jobs.claimQueued(ctx.now().toISOString());

    // Doi tuong job dua vao pipeline mang trang thai terminal => guard PHAI tu choi.
    const huy = { ...claimed!, state: 'cancelled' as const };
    const outcome = await executeTrackedVideoJob(ctx, huy, ctx.trackingProvider);

    expect(outcome.state, 'guard tu choi ma caller van khai `completed`').not.toBe('completed');
    const job = await ctx.persistence.jobs.findById(ws, jobId);
    expect(job?.state, 'job trong co so du lieu bi danh dau xong trong khi guard da tu choi').not.toBe('completed');
    await app.close();
  });

  it('output KHONG kiem duoc thi khong bao gio `completed` (bat bien I-2)', async () => {
    const { app, ctx, ws, created } = await trackedJob();
    const jobId = created.body.data.job.id as string;
    ctx.persistence.outputs.markValidated = async () => { throw new Error('gia lap: khong kiem duoc output'); };

    const claimed = await ctx.persistence.jobs.claimQueued(ctx.now().toISOString());
    await executeClaimedJob(ctx, claimed!).catch(() => undefined);

    const job = await ctx.persistence.jobs.findById(ws, jobId);
    expect(job?.state, 'bao xong trong khi output chua kiem duoc').not.toBe('completed');
    await app.close();
  });

});
