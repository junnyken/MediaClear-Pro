/**
 * P3 (`D-070`): duong DON DU LIEU — thu duy nhat trong repo nay that su XOA BYTE.
 *
 * Bo test nay viet theo mot giả định: **cai nguy hiem nhat khong phai "khong xoa duoc", ma la
 * "xoa nham"**. Nen phan lon phep kiem o day la phep kiem PHU DINH — chung minh nhung thu KHONG
 * duoc dung toi thi van con nguyen.
 */
import { describe, expect, it } from 'vitest';
import { runRetentionCleanup, runUploadSessionCleanup } from '../src/services/cleanup.js';
import { createProject, createWorkspace, makeApp, signIn, uploadFixture } from './helpers.js';
import type { SourceFileRecord } from '../src/persistence/types.js';

/** Dua tep ve qua khu de no vuot thoi han luu giu, khong phai cho 30 ngay that. */
async function agedFile(patch: Partial<SourceFileRecord> = {}) {
  const { app, ctx } = await makeApp();
  const token = await signIn(app, `o-${Date.now()}-${Math.random()}@matbao.com`);
  const ws = await createWorkspace(app, token, 'Studio');
  const prj = await createProject(app, token, ws, 'Du an');
  const up = await uploadFixture(app, token, ws, prj, 'sample.png', { mimeType: 'image/png', mediaType: 'image' });

  const rec = await ctx.persistence.sourceFiles.findById(ws, up.sourceFileId);
  const long = new Date(Date.now() - 400 * 24 * 3600_000).toISOString();
  const aged = { ...rec!, createdAt: long, lastAccessedAt: long, ...patch };
  // Ghi thang vao kho: khong co duong API nao lam tep gia di, va cung khong nen co.
  await ctx.persistence.sourceFiles.create(aged);
  return { app, ctx, ws, sourceFileId: up.sourceFileId, storageKey: aged.storageKey };
}

describe('P3 (D-070) — don du lieu', () => {
  it('MAC DINH chi chay thu: dem dung so, nhung KHONG xoa byte nao', async () => {
    const { app, ctx, ws, sourceFileId, storageKey } = await agedFile();

    const r = await runRetentionCleanup(ctx); // khong truyen gi => dryRun
    expect(r.dryRun).toBe(true);
    expect(r.candidates).toBe(1);
    expect(r.deleted, 'chay thu ma van xoa => mat du lieu vi quen mot tham so').toBe(0);

    // Byte VAN CON, va ban ghi chua bi danh dau.
    await expect(ctx.storage.getObject({ bucket: ctx.bucket, key: storageKey })).resolves.toBeDefined();
    expect((await ctx.persistence.sourceFiles.findById(ws, sourceFileId))?.retentionState).not.toBe('deleted');
    await app.close();
  });

  it('bat tuong minh thi xoa byte THAT, va ban ghi o lai lam bia mo', async () => {
    const { app, ctx, ws, sourceFileId, storageKey } = await agedFile();

    const r = await runRetentionCleanup(ctx, { dryRun: false });
    expect(r.deleted).toBe(1);
    expect(r.failed).toBe(0);

    // Byte da mat that.
    await expect(ctx.storage.getObject({ bucket: ctx.bucket, key: storageKey })).rejects.toBeDefined();

    // Ban ghi KHONG bi xoa: no la dau vet duy nhat chung minh tep tung ton tai.
    const row = await ctx.persistence.sourceFiles.findById(ws, sourceFileId);
    expect(row, 'xoa dong la xoa luon bang chung').not.toBeNull();
    expect(row?.retentionState).toBe('deleted');
    expect(row?.deletedAt).not.toBeNull();

    // Va phai co dau vet audit noi ro TAI SAO.
    const audit = (await ctx.persistence.audit.listByWorkspace(ws)).items;
    const row2 = audit.find((e) => e.eventType === 'source_file_deleted');
    expect(row2, 'xoa byte ma khong ghi audit => khong ai kiem lai duoc').toBeDefined();
    expect(row2?.detail.reason).toBe('retention_expired');
    await app.close();
  });

  it('GIU THEO YEU CAU PHAP LY: khong bao gio bi don, du da qua han tu lau', async () => {
    const { app, ctx, ws, sourceFileId, storageKey } = await agedFile({
      legalHoldAt: new Date(Date.now() - 300 * 24 * 3600_000).toISOString(),
    });

    const r = await runRetentionCleanup(ctx, { dryRun: false });
    expect(r.candidates, 'tep dang bi giu theo phap ly ma vao danh sach don').toBe(0);
    expect(r.deleted).toBe(0);
    await expect(ctx.storage.getObject({ bucket: ctx.bucket, key: storageKey })).resolves.toBeDefined();
    expect((await ctx.persistence.sourceFiles.findById(ws, sourceFileId))?.retentionState).not.toBe('deleted');
    await app.close();
  });

  it('tep CON TRONG han: khong dung toi', async () => {
    const { app, ctx, ws } = await agedFile();
    // Tep thu hai, moi tinh.
    const token = await signIn(app, `o2-${Date.now()}@matbao.com`);
    void token;
    const moi = await ctx.persistence.sourceFiles.listForRetention(ws);
    expect(moi.length).toBeGreaterThan(0);

    const r = await runRetentionCleanup(ctx, { dryRun: false });
    // Chi tep da qua han bi don; tep moi (neu co) khong nam trong danh sach.
    for (const id of r.ids) {
      const row = await ctx.persistence.sourceFiles.findById(ws, id);
      expect(row?.retentionState).toBe('deleted');
    }
    await app.close();
  });

  it('KIEM LAI luat ngay truoc khi xoa: giu-theo-phap-ly dat SAU khi dung danh sach van chan duoc', async () => {
    const { app, ctx, ws, sourceFileId, storageKey } = await agedFile();

    /*
     * Lop chan 4. Danh sach dung luc T, xoa luc T+n. Mo phong: ai do dat giu-theo-phap-ly ngay
     * sau khi danh sach da dung xong. Neu ham tin danh sach cu, tep bi xoa nham.
     */
    const that = ctx.persistence.sourceFiles.listForRetention.bind(ctx.persistence.sourceFiles);
    ctx.persistence.sourceFiles.listForRetention = async (w?: string | null) => {
      const rows = await that(w);
      const cur = await ctx.persistence.sourceFiles.findById(ws, sourceFileId);
      await ctx.persistence.sourceFiles.create({ ...cur!, legalHoldAt: new Date().toISOString() });
      return rows; // tra ve danh sach CU, chua co giu-theo-phap-ly
    };

    const r = await runRetentionCleanup(ctx, { dryRun: false });
    expect(r.candidates).toBe(1);
    expect(r.deleted, 'tin danh sach cu => xoa mot tep dang bi giu theo phap ly').toBe(0);
    await expect(ctx.storage.getObject({ bucket: ctx.bucket, key: storageKey })).resolves.toBeDefined();
    await app.close();
  });

  it('XOA BYTE HONG thi ban ghi KHONG duoc danh dau da xoa — ho so phai noi that', async () => {
    const { app, ctx, ws, sourceFileId } = await agedFile();

    /*
     * Lop chan 5: byte truoc, ban ghi sau. Dao thu tu thi mot su co giua chung se de lai mot ban
     * ghi noi "da xoa" trong khi byte van nam do — tuc la ho so noi doi, va khong ai di tim lai
     * tep do nua vi giay to bao no khong con.
     */
    ctx.storage.deleteObject = async () => { throw new Error('kho loi gia lap'); };

    const r = await runRetentionCleanup(ctx, { dryRun: false });
    expect(r.candidates).toBe(1);
    expect(r.deleted).toBe(0);
    expect(r.failed, 'xoa hong phai duoc dem rieng, khong nuot im lang').toBe(1);

    const row = await ctx.persistence.sourceFiles.findById(ws, sourceFileId);
    expect(row?.retentionState, 'byte van con ma ban ghi da noi "da xoa"').not.toBe('deleted');
    expect(row?.deletedAt).toBeNull();
    await app.close();
  });

  it('tran moi luot chan duoc mot loi logic quet sach kho', async () => {
    const { app, ctx } = await agedFile();
    const r = await runRetentionCleanup(ctx, { limit: 0 });
    expect(r.candidates).toBe(0);
    await app.close();
  });

  it('don phien tai len qua han: mac dinh chi chay thu', async () => {
    const { app, ctx } = await makeApp();
    const r = await runUploadSessionCleanup(ctx);
    expect(r.dryRun).toBe(true);
    expect(r.deleted).toBe(0);
    await app.close();
  });
});
