/**
 * MCP-42 o TANG API — `correctJobFrame`.
 *
 * Vi sao can bo test rieng: `applyCorrection` (tang service thuan) da co test, nhung duong API
 * la mot ban hien thuc KHAC — no ghi xuong co so du lieu. Doi chung am cua completion patch da
 * chung minh dieu do: dot bien "correction lam mat audit trail" VAN XANH cho toi khi co bo test
 * nay. Mot lop chan khong co test canh la mot lop chan chua ton tai.
 */
import { describe, expect, it } from 'vitest';
import { correctJobFrame, getJobFrames } from '../src/services/frame-review.js';
import { resolveActor } from '../src/services/access.js';
import { executeClaimedJob } from '../src/services/run-job.js';
import { ffmpegAvailable } from '../src/media/ffmpeg.js';
import { attest, createJob, createProject, createWorkspace, makeApp, signIn, uploadFixture, validateAsset } from './helpers.js';

const hasFfmpeg = await ffmpegAvailable();

async function ranTrackedJob() {
  const { app, ctx } = await makeApp();
  const token = await signIn(app, `o-${Date.now()}-${Math.random()}@matbao.com`);
  const ws = await createWorkspace(app, token, 'Studio');
  const prj = await createProject(app, token, ws, 'Du an');
  const up = await uploadFixture(app, token, ws, prj, 'video-with-audio.mp4', { mimeType: 'video/mp4', mediaType: 'video' });
  await validateAsset(app, token, ws, up.assetId);
  await attest(app, token, ws, up.assetId);
  const created = await createJob(app, token, ws, up.assetId, { operations: ['tracked_inpaint'] });
  const jobId = created.body.data.job.id as string;
  const claimed = await ctx.persistence.jobs.claimQueued(ctx.now().toISOString());
  await executeClaimedJob(ctx, claimed!);

  return { app, ctx, ws, jobId, token };
}

/** Actor THAT: lay tu chinh phien dang nhap vua tao, khong dung mot doi tuong gia. */
async function actorOf(ctx: Awaited<ReturnType<typeof ranTrackedJob>>['ctx'], ws: string, token: string) {
  const resolved = await resolveActor(ctx, token, ws);
  if (!resolved.ok) throw new Error(`khong dung duoc actor: ${JSON.stringify(resolved.error)}`);
  return resolved.data;
}

describe.skipIf(!hasFfmpeg)('MCP-42 tang API — sua keyframe', () => {
  it('GHI AUDIT TRAIL: giu CA truoc lan sau, va la APPEND-ONLY', async () => {
    const { app, ctx, ws, jobId, token } = await ranTrackedJob();
    const actor = await actorOf(ctx, ws, token);

    const truoc = (await ctx.persistence.jobFrames.listFrames(ws, jobId)).find((f) => f.frameIndex === 3)!;

    const r1 = await correctJobFrame(ctx, actor, jobId, 3, { x: 0.4, y: 0.4, width: 0.2, height: 0.2 });
    expect(r1.ok).toBe(true);

    const audit = await ctx.persistence.jobFrames.listCorrections(ws, jobId);
    expect(audit, 'sua ma khong ghi audit => khong doi chieu lai duoc').toHaveLength(1);
    expect(audit[0]!.frameIndex).toBe(3);
    expect(audit[0]!.beforeBox, 'mat ban ghi TRUOC khi sua').toEqual(truoc.box);
    expect(audit[0]!.beforeState).toBe(truoc.state);
    expect(audit[0]!.afterBox).toEqual({ x: 0.4, y: 0.4, width: 0.2, height: 0.2 });
    expect(audit[0]!.actorUserId).toBe(actor.user.id);

    // Sua lan hai: audit phai NOI THEM, khong thay the.
    await correctJobFrame(ctx, actor, jobId, 5, { x: 0.6, y: 0.6, width: 0.2, height: 0.2 });
    const audit2 = await ctx.persistence.jobFrames.listCorrections(ws, jobId);
    expect(audit2, 'audit bi ghi de — lich su bien mat').toHaveLength(2);
    expect(audit2[0]!.frameIndex).toBe(3);
    await app.close();
  });

  it('frame sau khi sua co state va nguon goc RO RANG', async () => {
    const { app, ctx, ws, jobId, token } = await ranTrackedJob();
    const actor = await actorOf(ctx, ws, token);
    await correctJobFrame(ctx, actor, jobId, 2, { x: 0.3, y: 0.3, width: 0.2, height: 0.2 });

    const f = (await ctx.persistence.jobFrames.listFrames(ws, jobId)).find((x) => x.frameIndex === 2)!;
    expect(f.state).toBe('frame_correction_applied');
    expect(f.source).toBe('manual');
    // Nguoi that dat tay vao => do tin cay cua MAY khong con y nghia.
    expect(f.confidence).toBeNull();
    await app.close();
  });

  it('vung che NGOAI khung hinh bi TU CHOI, va khong ghi audit nao', async () => {
    const { app, ctx, ws, jobId, token } = await ranTrackedJob();
    const actor = await actorOf(ctx, ws, token);

    for (const box of [
      { x: 0.9, y: 0.1, width: 0.3, height: 0.2 },   // tran mep phai
      { x: 0.1, y: 0.1, width: 0, height: 0.2 },      // rong = 0
      { x: -0.1, y: 0.1, width: 0.2, height: 0.2 },   // am
    ]) {
      const r = await correctJobFrame(ctx, actor, jobId, 1, box);
      expect(r.ok, `chap nhan vung che sai: ${JSON.stringify(box)}`).toBe(false);
    }
    expect(await ctx.persistence.jobFrames.listCorrections(ws, jobId)).toHaveLength(0);
    await app.close();
  });

  it('frame KHONG ton tai => bao khong tim thay, khong tao dong rac', async () => {
    const { app, ctx, ws, jobId, token } = await ranTrackedJob();
    const actor = await actorOf(ctx, ws, token);
    const r = await correctJobFrame(ctx, actor, jobId, 9999, { x: 0.1, y: 0.1, width: 0.2, height: 0.2 });
    expect(r.ok).toBe(false);
    expect(await ctx.persistence.jobFrames.listCorrections(ws, jobId)).toHaveLength(0);
    await app.close();
  });

  it('`getJobFrames` tra dung so frame va cong chan', async () => {
    const { app, ctx, ws, jobId, token } = await ranTrackedJob();
    const actor = await actorOf(ctx, ws, token);
    const r = await getJobFrames(ctx, actor, jobId);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.frames).toHaveLength(r.data.timeline.expectedFrameCount);
      expect(r.data.gate.verdict).toBe('completed');
    }
    await app.close();
  });
});
