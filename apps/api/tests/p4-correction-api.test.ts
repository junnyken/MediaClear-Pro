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

/**
 * `Q-P4-05` / `D-074` — duong API phai THUC SU tinh lai frame lan can.
 *
 * Truoc `D-074` ham nay ghi cung `reinterpolated: []` cho moi lan sua, du no khong he tinh gi.
 * Khong test nao bat duoc, vi khong test nao doi chieu o do voi trang thai THAT cua cac frame ben
 * canh — chung chi doc chinh o do va thay no khop voi chinh no.
 */
describe.skipIf(!hasFfmpeg)('D-074 — API tinh lai frame lan can THAT', () => {
  const BOX = { x: 0.42, y: 0.2, width: 0.25, height: 0.25 };

  it('`reinterpolated` khong con rong, va KHOP voi frame thuc su doi trong kho', async () => {
    const { app, ctx, ws, jobId, token } = await ranTrackedJob();
    const actor = await actorOf(ctx, ws, token);

    const truoc = await ctx.persistence.jobFrames.listFrames(ws, jobId);
    const target = 4;
    expect(truoc.length, 'moc thu can timeline du dai de co lan can hai ben').toBeGreaterThan(7);

    const r = await correctJobFrame(ctx, actor, jobId, target, BOX);
    expect(r.ok).toBe(true);

    const corrections = await ctx.persistence.jobFrames.listCorrections(ws, jobId);
    const audit = corrections[corrections.length - 1]!;
    expect(audit.reinterpolated, 'API van ghi o trong').not.toEqual([]);

    /*
     * Doi chieu voi KHO, khong voi chinh o `reinterpolated`. Day la cho phep do cu bi vo hieu:
     * doc lai chinh con so minh vua ghi thi no luon khop.
     */
    const sau = await ctx.persistence.jobFrames.listFrames(ws, jobId);
    const doiThatSu = sau
      .filter((f) => {
        const cu = truoc.find((x) => x.frameIndex === f.frameIndex)!;
        return f.frameIndex !== target && JSON.stringify(cu.box) !== JSON.stringify(f.box);
      })
      .map((f) => f.frameIndex)
      .sort((a, b) => a - b);

    expect([...audit.reinterpolated].sort((a, b) => a - b)).toEqual(doiThatSu);
    for (const i of audit.reinterpolated) {
      const f = sau.find((x) => x.frameIndex === i)!;
      expect(f.source, `frame ${i} duoc khai la tinh lai nhung nguon van la gia tri do duoc`).toBe('interpolated');
      expect(f.confidence, 'hop da doi ma con giu so confidence cu').toBeNull();
    }
    await app.close();
  });

  it('AUDIT giu gia tri TRUOC va SAU cua tung frame lan can, khong chi danh sach chi so', async () => {
    const { app, ctx, ws, jobId, token } = await ranTrackedJob();
    const actor = await actorOf(ctx, ws, token);
    const truoc = await ctx.persistence.jobFrames.listFrames(ws, jobId);

    await correctJobFrame(ctx, actor, jobId, 4, BOX);
    const audit = (await ctx.persistence.jobFrames.listCorrections(ws, jobId)).at(-1)!;

    expect(audit.neighbours.length).toBe(audit.reinterpolated.length);
    for (const n of audit.neighbours) {
      const cu = truoc.find((x) => x.frameIndex === n.frameIndex)!;
      expect(n.beforeBox, 've "truoc" trong ho so khong khop trang thai that truoc do').toEqual(cu.box);
      expect(n.beforeState).toBe(cu.state);
      expect(n.beforeSource).toBe(cu.source);
      expect(n.afterSource).toBe('interpolated');
      expect(n.afterBox, 've "sau" bi bo trong').not.toBeNull();
    }
    await app.close();
  });

  it('AUDIT ghi ket qua cong chan va so doan nhay o CA HAI ve — va ve "sau" phai DO THAT', async () => {
    const { app, ctx, ws, jobId, token } = await ranTrackedJob();
    const actor = await actorOf(ctx, ws, token);

    /*
     * Sua tao cu NHAY co chu dinh. Khong the chi kiem `not.toBeNull()`: mot ve "sau" bi bo trong
     * bang `0` cung khac `null`, nen phep kiem do van xanh khi phep do bi go han ra.
     *
     * Do dung la dieu doi chung am `NC5` da chung minh: go `detectFlicker` khoi duong ghi ho so
     * ma bo test van xanh het. Phep kiem phai doi mot con so CO NGHIA, khong phai mot o khac null.
     */
    await correctJobFrame(ctx, actor, jobId, 4, { x: 0.75, y: 0.7, width: 0.2, height: 0.2 });
    const audit = (await ctx.persistence.jobFrames.listCorrections(ws, jobId)).at(-1)!;

    expect(audit.gateVerdictBefore, 'ho so chi co ve "sau" thi khong tra loi duoc "tot len hay xau di"').toBe('completed');
    expect(audit.gateVerdictAfter, 've "sau" khong phan anh cu nhay vua tao ra').not.toBe('completed');
    expect(audit.flickerBefore).toBe(0);
    expect(audit.flickerAfter, 'so doan nhay o ve "sau" khong duoc do that').toBeGreaterThan(0);
    await app.close();
  });

  it('SUA TAO CU NHAY: cong chan chay lai va TU CHOI `completed`', async () => {
    const { app, ctx, ws, jobId, token } = await ranTrackedJob();
    const actor = await actorOf(ctx, ws, token);

    const truoc = await getJobFrames(ctx, actor, jobId);
    expect(truoc.ok && truoc.data.gate.verdict, 'moc khoi dau phai la mot job da dat').toBe('completed');

    // Day mask di that xa so voi lan can => vuot tran van toc cua MCP-43.
    const r = await correctJobFrame(ctx, actor, jobId, 4, { x: 0.75, y: 0.7, width: 0.2, height: 0.2 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.data.gate.verdict, 'sua tao cu nhay ma cong chan van noi da dat').not.toBe('completed');
    expect(r.data.gate.reasons).toContain('flicker_unreviewed');
    expect(r.data.gate.counts.flicker_unreviewed).toBeGreaterThan(0);
    await app.close();
  });

  it('phan hoi mang `lastCorrection` DOC LAI TU KHO, khong phai ke hoach trong bo nho', async () => {
    const { app, ctx, ws, jobId, token } = await ranTrackedJob();
    const actor = await actorOf(ctx, ws, token);

    const r = await correctJobFrame(ctx, actor, jobId, 4, BOX);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const luu = (await ctx.persistence.jobFrames.listCorrections(ws, jobId)).at(-1)!;
    expect(r.data.lastCorrection).not.toBeNull();
    expect(r.data.lastCorrection!.frameIndex).toBe(luu.frameIndex);
    expect(r.data.lastCorrection!.reinterpolated).toEqual(luu.reinterpolated);

    // Va duong DOC phai thay dung cai do — hai duong khong duoc lech nhau.
    const doc = await getJobFrames(ctx, actor, jobId);
    expect(doc.ok && doc.data.lastCorrection).toEqual(r.data.lastCorrection);
    await app.close();
  });

  it('GHI LA MOT GIAO DICH: kho hong giua chung thi KHONG de lai timeline nua cu nua moi', async () => {
    const { app, ctx, ws, jobId, token } = await ranTrackedJob();
    const actor = await actorOf(ctx, ws, token);
    const truoc = await ctx.persistence.jobFrames.listFrames(ws, jobId);
    const auditTruoc = await ctx.persistence.jobFrames.listCorrections(ws, jobId);

    // Ep tang luu tru hong DUNG giua loat ghi.
    const that = ctx.persistence.jobFrames.applyCorrectionAtomically.bind(ctx.persistence.jobFrames);
    ctx.persistence.jobFrames.applyCorrectionAtomically = async () => {
      throw new Error('kho hong giua chung');
    };
    const r = await correctJobFrame(ctx, actor, jobId, 4, BOX).catch(() => ({ ok: false as const }));
    ctx.persistence.jobFrames.applyCorrectionAtomically = that;

    expect(r.ok, 'kho hong ma van bao thanh cong').toBe(false);
    const sau = await ctx.persistence.jobFrames.listFrames(ws, jobId);
    expect(sau, 'frame da doi trong khi lan ghi that bai').toEqual(truoc);
    expect(await ctx.persistence.jobFrames.listCorrections(ws, jobId)).toHaveLength(auditTruoc.length);
    await app.close();
  });
});
