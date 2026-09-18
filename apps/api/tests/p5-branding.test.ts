/**
 * `Q-P5-03` / `D-077` — tai logo va DAN lop phu vao ban xuat.
 *
 * Moi phep kiem duoi day tuong ung voi mot cach he thong co the noi doi ve viec da lam gi voi tep
 * cua nguoi dung. Khong phep kiem nao hoi "ham co chay khong".
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createBrandKit } from '../src/services/brand-kits.js';
import { uploadBrandLogo } from '../src/services/brand-logo.js';
import { getAssetProvenance } from '../src/services/provenance-inspector.js';
import { resolveActor } from '../src/services/access.js';
import { applyImageBranding } from '../src/media/branding-overlay.js';
import { JobWorker } from '../src/worker/job-worker.js';
import {
  attest, createJob, createProject, createWorkspace, makeApp, signIn, uploadFixture, validateAsset,
} from './helpers.js';

const fixture = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(join(import.meta.dirname, 'fixtures/media', name)));

const DRAFT = {
  name: 'Mat Bao', colors: ['#112233'], logoAssetId: null,
  overlayDefaults: { position: 'bottom_right', opacity: 0.8, includeDisclosure: false },
};

async function workspaceCoLogo() {
  const { app, ctx } = await makeApp();
  const token = await signIn(app, `bl-${Date.now()}-${Math.random()}@matbao.com`);
  const ws = await createWorkspace(app, token, 'Studio');
  const resolved = await resolveActor(ctx, token, ws);
  if (!resolved.ok) throw new Error('khong dung duoc actor');
  const kit = await createBrandKit(ctx, resolved.data, DRAFT);
  if (!kit.ok) throw new Error('khong tao duoc bo nhan dien');
  return { app, ctx, token, ws, actor: resolved.data, kitId: kit.data.id };
}

describe('D-077 — tai tep logo', () => {
  it('logo HOP LE: do tren byte that, va gan vao mot PHIEN BAN MOI', async () => {
    const { app, ctx, actor, kitId } = await workspaceCoLogo();
    const r = await uploadBrandLogo(ctx, actor, kitId, fixture('logo-valid.png'), 'image/png');
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.data.widthPx).toBe(128);
    expect(r.data.heightPx).toBe(64);
    expect(r.data.mimeType).toBe('image/png');
    expect(r.data.checksumSha256).toMatch(/^[0-9a-f]{64}$/);

    const kit = await ctx.persistence.brandKits.findById(actor.workspace.id, kitId);
    expect(kit?.currentVersion, 'gan logo phai tao PHIEN BAN moi').toBe(2);

    // Phien ban CU phai con nguyen — khong logo, va khong bi dung toi.
    const v1 = await ctx.persistence.brandKits.findVersion(actor.workspace.id, kitId, 1);
    expect(v1?.logoAssetId, 'phien ban cu bi sua => ban xuat cu tro toi noi dung khac').toBeNull();
    const v2 = await ctx.persistence.brandKits.findVersion(actor.workspace.id, kitId, 2);
    expect(v2?.logoAssetId).toBe(r.data.id);
    await app.close();
  });

  it('`Q-23`: kho CUC BO khong duoc goi la da luu tru o muc production', async () => {
    const { app, ctx, actor, kitId } = await workspaceCoLogo();
    const r = await uploadBrandLogo(ctx, actor, kitId, fixture('logo-valid.png'), 'image/png');
    expect(r.ok && r.data.sharedStorage, 'kho cuc bo tu khai la kho dung chung').toBe(false);
    await app.close();
  });

  it('tep KHONG phai anh bi tu choi, va khong tao ban ghi nao', async () => {
    const { app, ctx, actor, kitId } = await workspaceCoLogo();
    const r = await uploadBrandLogo(ctx, actor, kitId, fixture('logo-not-an-image.bin'), 'image/png');
    expect(r.ok).toBe(false);
    expect(await ctx.persistence.brandLogos.listByBrandKit(actor.workspace.id, kitId)).toHaveLength(0);
    // Va KHONG duoc tao phien ban moi cho mot lan tai that bai.
    const kit = await ctx.persistence.brandKits.findById(actor.workspace.id, kitId);
    expect(kit?.currentVersion).toBe(1);
    await app.close();
  });

  it('kich thuoc qua nho bi tu choi kem gioi han cu the', async () => {
    const { app, ctx, actor, kitId } = await workspaceCoLogo();
    const r = await uploadBrandLogo(ctx, actor, kitId, fixture('logo-too-small.png'), 'image/png');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('MCP_VAL_DIMENSION_TOO_SMALL');
    await app.close();
  });

  it('`content-type` client khai KHAC byte that bi tu choi — khong tin loi khai', async () => {
    const { app, ctx, actor, kitId } = await workspaceCoLogo();
    const r = await uploadBrandLogo(ctx, actor, kitId, fixture('logo-valid.png'), 'image/jpeg');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('MCP_VAL_MIME_MISMATCH');
    await app.close();
  });

  it('tep RONG bi tu choi', async () => {
    const { app, ctx, actor, kitId } = await workspaceCoLogo();
    const r = await uploadBrandLogo(ctx, actor, kitId, new Uint8Array(), 'image/png');
    expect(r.ok).toBe(false);
    await app.close();
  });

  it('WORKSPACE KHAC khong tai duoc logo len bo nhan dien nguoi khac', async () => {
    const { app, ctx, kitId, actor } = await workspaceCoLogo();
    const laToken = await signIn(app, `la-${Date.now()}@matbao.com`);
    const laWs = await createWorkspace(app, laToken, 'Khac');
    const la = await resolveActor(ctx, laToken, laWs);
    if (!la.ok) throw new Error('khong dung duoc actor la');

    /*
     * Nguoi la phai co bo nhan dien CUA RIENG HO.
     *
     * Lan dau phep kiem nay cho ho mot workspace RONG, va doi chung am `NC3` (bo qua co lap
     * workspace) van XANH: khong co gi de lay nham. Phai co mot bo khac trong tam tay thi phep kiem
     * moi phan biet duoc "tu choi" voi "am tham chuyen huong sang bo cua chinh ho".
     */
    const boCuaHo = await createBrandKit(ctx, la.data, { ...DRAFT, name: 'Bo cua nguoi la' });
    if (!boCuaHo.ok) throw new Error('khong tao duoc bo cua nguoi la');

    const r = await uploadBrandLogo(ctx, la.data, kitId, fixture('logo-valid.png'), 'image/png');
    expect(r.ok, 'tai duoc logo len bo nhan dien cua workspace khac').toBe(false);
    if (!r.ok) expect(r.error.code).toBe('MCP_RESOURCE_NOT_FOUND');

    // Va KHONG duoc am tham day sang bo cua chinh ho.
    expect(
      await ctx.persistence.brandLogos.listByBrandKit(la.data.workspace.id, boCuaHo.data.id),
      'logo bi chuyen huong sang mot bo nhan dien khac voi bo nguoi dung chi dinh',
    ).toHaveLength(0);
    // Bo cua workspace A cung khong duoc nhan gi.
    expect(await ctx.persistence.brandLogos.listByBrandKit(actor.workspace.id, kitId)).toHaveLength(0);
    /*
     * VA khong duoc de lai ban ghi MO COI: `workspaceId` cua nguoi la + `brandKitId` cua A.
     *
     * Doi chung am `NC3` lot qua HAI lan vi khong assertion nao nhin vao dung to hop nay — duong
     * bi dot bien ghi ban ghi TRUOC khi that bai o mot buoc sau, nen `r.ok === false` van dung
     * trong khi mot tep da nam trong kho.
     */
    expect(
      await ctx.persistence.brandLogos.listByBrandKit(la.data.workspace.id, kitId),
      'ban ghi mo coi: logo cua workspace nguoi la tro toi bo nhan dien cua workspace khac',
    ).toHaveLength(0);
    await app.close();
  });

  it('KHO HONG: bao loi ro rang, khong tao ban ghi mo coi', async () => {
    const { app, ctx, actor, kitId } = await workspaceCoLogo();
    const that = ctx.storage.putObject.bind(ctx.storage);
    ctx.storage.putObject = async () => { throw new Error('kho hong'); };
    const r = await uploadBrandLogo(ctx, actor, kitId, fixture('logo-valid.png'), 'image/png');
    ctx.storage.putObject = that;

    expect(r.ok).toBe(false);
    expect(
      await ctx.persistence.brandLogos.listByBrandKit(actor.workspace.id, kitId),
      'ghi ban ghi trong khi tep khong nam trong kho => ho so tro toi mot tep khong ton tai',
    ).toHaveLength(0);
    await app.close();
  });
});

describe('D-077 — DAN lop phu vao ban xuat', () => {
  async function jobCoLopPhu(branding: unknown) {
    const { app, ctx } = await makeApp();
    const token = await signIn(app, `ov-${Date.now()}-${Math.random()}@matbao.com`);
    const ws = await createWorkspace(app, token, 'Studio');
    const actorR = await resolveActor(ctx, token, ws);
    if (!actorR.ok) throw new Error('khong dung duoc actor');
    const kit = await createBrandKit(ctx, actorR.data, DRAFT);
    if (!kit.ok) throw new Error('khong tao duoc bo nhan dien');
    const logo = await uploadBrandLogo(ctx, actorR.data, kit.data.id, fixture('logo-valid.png'), 'image/png');
    if (!logo.ok) throw new Error('khong tai duoc logo');

    const prj = await createProject(app, token, ws, 'Du an');
    const up = await uploadFixture(app, token, ws, prj, 'image-with-metadata.jpg', {
      mimeType: 'image/jpeg', mediaType: 'image',
    });
    await validateAsset(app, token, ws, up.assetId);
    await attest(app, token, ws, up.assetId);

    const resolved = typeof branding === 'function'
      ? (branding as (id: string) => unknown)(kit.data.id) : branding;
    const created = await createJob(app, token, ws, up.assetId, { operations: ['blur'], branding: resolved });
    await new JobWorker(ctx, { maxCycles: 3, idleDelayMs: 1 }).start();

    return {
      app, ctx, ws, actor: actorR.data, assetId: up.assetId,
      jobId: created.body.data.job.id as string,
      kitId: kit.data.id, logoId: logo.data.id,
      goc: fixture('image-with-metadata.jpg'),
    };
  }

  it('KHONG chon lop phu: ban xuat khong co lop phu, va bien nhan noi dung dieu do', async () => {
    const { app, ctx, ws, jobId } = await jobCoLopPhu(null);
    const r = await ctx.persistence.receipts.findByJob(ws, jobId);
    expect(r!.brandOverlayApplied, 'he thong tu dan lop phu khi nguoi dung khong chon').toBe(false);
    expect(r!.disclosureOverlayApplied).toBe(false);
    expect(r!.brandKitId).toBeNull();
    expect(r!.brandLogoAssetId).toBeNull();
    await app.close();
  });

  it('CHON lop phu: ban xuat THAT SU doi, va bien nhan ghi du bo/phien ban/logo', async () => {
    const { app, ctx, ws, jobId, kitId, logoId } = await jobCoLopPhu(
      (id: string) => ({ brandKitId: id, brandKitVersion: 2, applyLogo: true, applyDisclosure: true }));

    const job = await ctx.persistence.jobs.findById(ws, jobId);
    expect(job?.state, 'dan lop phu lam job do').toBe('completed');

    const r = await ctx.persistence.receipts.findByJob(ws, jobId);
    expect(r!.brandOverlayApplied).toBe(true);
    expect(r!.disclosureOverlayApplied).toBe(true);
    expect(r!.brandKitId).toBe(kitId);
    expect(r!.brandKitVersion, 'ghi phien ban KHAC voi phien ban da dan').toBe(2);
    expect(r!.brandLogoAssetId).toBe(logoId);

    /*
     * Bat bien `I-2` van phai dung: byte trong kho phai khop checksum he thong khai — ke ca sau
     * khi dan lop phu. Day la cho de lam sai nhat: dan SAU khi ghi se lam hai so lech nhau.
     */
    const out = await ctx.persistence.outputs.findByJob(ws, jobId);
    expect(out?.validated, 'dan lop phu lam checksum lech voi byte trong kho').toBe(true);
    await app.close();
  });

  it('BAT BIEN I-1: tep goc khong bi dung toi du co dan lop phu', async () => {
    const { app, ctx, ws, assetId, goc } = await jobCoLopPhu(
      (id: string) => ({ brandKitId: id, brandKitVersion: 2, applyLogo: true, applyDisclosure: true }));
    const asset = await ctx.persistence.assets.findById(ws, assetId);
    const src = await ctx.persistence.sourceFiles.findById(ws, asset!.sourceFileId);
    const bytes = await ctx.storage.getObject({ bucket: ctx.bucket, key: src!.storageKey });
    expect(Buffer.from(bytes).equals(Buffer.from(goc)), 'tep goc bi ghi de').toBe(true);
    await app.close();
  });

  it('bo nhan dien cua WORKSPACE KHAC: KHONG dan gi, va bien nhan khong ghi bua', async () => {
    const { app, ctx } = await makeApp();
    // Bo nhan dien nam o workspace A.
    const aToken = await signIn(app, `a-${Date.now()}@matbao.com`);
    const aWs = await createWorkspace(app, aToken, 'A');
    const aActor = await resolveActor(ctx, aToken, aWs);
    if (!aActor.ok) throw new Error('actor A');
    const kit = await createBrandKit(ctx, aActor.data, DRAFT);
    if (!kit.ok) throw new Error('kit A');

    // Job nam o workspace B, tro toi bo nhan dien cua A.
    const bToken = await signIn(app, `b-${Date.now()}@matbao.com`);
    const bWs = await createWorkspace(app, bToken, 'B');
    const prj = await createProject(app, bToken, bWs, 'Du an');
    const up = await uploadFixture(app, bToken, bWs, prj, 'image-with-metadata.jpg', {
      mimeType: 'image/jpeg', mediaType: 'image',
    });
    await validateAsset(app, bToken, bWs, up.assetId);
    await attest(app, bToken, bWs, up.assetId);
    const created = await createJob(app, bToken, bWs, up.assetId, {
      operations: ['blur'],
      branding: { brandKitId: kit.data.id, brandKitVersion: 1, applyLogo: true, applyDisclosure: true },
    });
    await new JobWorker(ctx, { maxCycles: 3, idleDelayMs: 1 }).start();

    const r = await ctx.persistence.receipts.findByJob(bWs, created.body.data.job.id as string);
    expect(r!.brandOverlayApplied, 'dan duoc bo nhan dien cua workspace khac').toBe(false);
    expect(r!.brandKitId, 'bien nhan ghi mot bo nhan dien khong thuoc workspace nay').toBeNull();
    await app.close();
  });

  it('PHIEN BAN khong ton tai: KHONG dan gi — khong "dan tam mot cai gan giong"', async () => {
    const { app, ctx, ws, jobId } = await jobCoLopPhu(
      (id: string) => ({ brandKitId: id, brandKitVersion: 99, applyLogo: true, applyDisclosure: true }));
    const r = await ctx.persistence.receipts.findByJob(ws, jobId);
    expect(r!.brandOverlayApplied).toBe(false);
    expect(r!.brandKitId).toBeNull();
    await app.close();
  });

  /**
   * Bat bien `I-2` tren duong CO LOP PHU.
   *
   * Doi chung am `NC12` (go han phep kiem checksum) lan dau van XANH: trong test kho luon ghi dung,
   * nen nhanh do khong bao gio chay va viec go no khong doi gi. Phep kiem nay ep kho ghi SAI that,
   * de nhanh do co viec de lam.
   */
  it('KHO ghi SAI byte: job KHONG duoc `completed`, ke ca khi da dan lop phu', async () => {
    const { app, ctx } = await makeApp();
    const token = await signIn(app, `i2-${Date.now()}@matbao.com`);
    const ws = await createWorkspace(app, token, 'Studio');
    const a = await resolveActor(ctx, token, ws);
    if (!a.ok) throw new Error('actor');
    const kit = await createBrandKit(ctx, a.data, DRAFT);
    if (!kit.ok) throw new Error('kit');
    await uploadBrandLogo(ctx, a.data, kit.data.id, fixture('logo-valid.png'), 'image/png');

    const prj = await createProject(app, token, ws, 'Du an');
    const up = await uploadFixture(app, token, ws, prj, 'image-with-metadata.jpg', {
      mimeType: 'image/jpeg', mediaType: 'image',
    });
    await validateAsset(app, token, ws, up.assetId);
    await attest(app, token, ws, up.assetId);

    /*
     * Kho ghi HONG mot cach im lang: nhan byte, luu mot noi dung KHAC.
     * Chi phep doc-lai-va-do-lai moi phat hien duoc — va do chinh la `I-2`.
     */
    const that = ctx.storage.putObject.bind(ctx.storage);
    ctx.storage.putObject = async (loc, bytes, mime) =>
      that(loc, loc.key.includes('/output/') ? new Uint8Array([1, 2, 3, 4]) : bytes, mime);

    const created = await createJob(app, token, ws, up.assetId, {
      operations: ['blur'],
      branding: { brandKitId: kit.data.id, brandKitVersion: 2, applyLogo: true, applyDisclosure: true },
    });
    await new JobWorker(ctx, { maxCycles: 3, idleDelayMs: 1 }).start();
    ctx.storage.putObject = that;

    const job = await ctx.persistence.jobs.findById(ws, created.body.data.job.id as string);
    expect(job?.state, 'byte trong kho khac han ban he thong khai ma job van bao da xong').not.toBe('completed');
    await app.close();
  });

  it('DONG THOI GIAN ghi lai lop phu da ap dung', async () => {
    const { app, ctx, actor, assetId, kitId } = await jobCoLopPhu(
      (id: string) => ({ brandKitId: id, brandKitVersion: 2, applyLogo: true, applyDisclosure: true }));
    const t = await getAssetProvenance(ctx, actor, assetId);
    expect(t.ok).toBe(true);
    if (!t.ok) return;
    const receipt = t.data.nodes.find((n) => n.kind === 'receipt')!;
    const brand = receipt.detail.find((d) => d.key === 'brandKitId');
    expect(brand?.value, 'dong thoi gian khong ghi bo nhan dien da dan').toBe(kitId);
    await app.close();
  });
});

describe('D-077 — bo dan lop phu, o muc byte', () => {
  const nen = async (): Promise<Uint8Array> => {
    const sharp = (await import('sharp')).default;
    return new Uint8Array(await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 20, g: 30, b: 50 } },
    }).png().toBuffer());
  };

  it('khong chon gi => byte Y HET ban dau', async () => {
    const base = await nen();
    const r = await applyImageBranding({
      rendered: base, logo: null, position: 'bottom_right', opacity: 0.8, disclosureText: null,
    });
    expect(r.logoApplied).toBe(false);
    expect(r.disclosureApplied).toBe(false);
    expect(Buffer.from(r.bytes).equals(Buffer.from(base)), 'khong chon gi ma byte van doi').toBe(true);
  });

  it('chon => byte DOI, va kich thuoc giu nguyen', async () => {
    const base = await nen();
    const logoBytes = fixture('logo-valid.png');
    const r = await applyImageBranding({
      rendered: base, logo: logoBytes, position: 'top_left', opacity: 0.8, disclosureText: 'Da qua xu ly',
    });
    expect(r.logoApplied).toBe(true);
    expect(r.disclosureApplied).toBe(true);
    expect(Buffer.from(r.bytes).equals(Buffer.from(base))).toBe(false);
    expect(r.widthPx).toBe(400);
    expect(r.heightPx).toBe(300);
  });

  it('logo HONG: bao la CHUA DAN, khong nem loi lam do ca luot xu ly', async () => {
    const base = await nen();
    const r = await applyImageBranding({
      rendered: base, logo: fixture('logo-not-an-image.bin'),
      position: 'top_left', opacity: 0.8, disclosureText: null,
    });
    expect(r.logoApplied, 'logo hong bi khai la da dan').toBe(false);
  });

  /**
   * `D-077`. Do duoc that trong workspace nay sau mot lan khoi dong lai: he thong mat SACH font
   * (`fc-list` tra ve 0). Thu vien ve SVG van tra ve mot anh HOP LE — chi la khong co chu.
   *
   * Neu cu dan, ban xuat mang mot dai toi mau TRONG RUOT: trong nhu mot dau co chu dinh nhung
   * khong noi gi, va bien nhan khai rang da cong bo. Mot cong bo trong con te hon khong cong bo.
   *
   * Phep kiem nay khong the gia lap moi truong mat font, nen no kiem DIEU KIEN TUONG DUONG: khi
   * chu KHONG len duoc pixel nao thi `disclosureApplied` phai la `false`. Chuoi rong la truong hop
   * chac chan khong ve ra chu nao.
   */
  it('khong ve duoc chu => KHONG dan dai, va KHONG khai la da cong bo', async () => {
    const base = await nen();
    const r = await applyImageBranding({
      rendered: base, logo: null, position: 'top_left', opacity: 1, disclosureText: '',
    });
    expect(r.disclosureApplied, 'dan mot dai trong roi khai la da cong bo').toBe(false);
    expect(
      Buffer.from(r.bytes).equals(Buffer.from(base)),
      'khong cong bo duoc ma van ve mot dai len ban xuat',
    ).toBe(true);
  });

  it('cau chu cong bo do NGUOI GOI truyen vao, khong do muc nay tu che', async () => {
    const base = await nen();
    const a = await applyImageBranding({
      rendered: base, logo: null, position: 'top_left', opacity: 1, disclosureText: 'Mot',
    });
    const b = await applyImageBranding({
      rendered: base, logo: null, position: 'top_left', opacity: 1, disclosureText: 'Hai',
    });
    expect(a.checksumSha256, 'cau chu khac nhau ma anh giong het => chu khong duoc ve').not.toBe(b.checksumSha256);
  });
});

/**
 * `D-078` — dau hieu "tep do AI tao ra" BIEN MAT qua duong xu ly anh.
 *
 * CAU HOI NGUOI DUNG DAT RA: "anh tu ChatGPT, cong cu nay co xoa duoc xac nhan do AI tao khong?"
 *
 * Cau tra loi DO DUOC: khong phai mot tinh nang, nhung tren thuc te dau hieu BIEN MAT — `sharp`
 * ghi lai tep PNG va khong mang theo chunk `caBX` (noi ban khai C2PA nam).
 *
 * Bo test nay ghim HAI dieu:
 *  1. He thong khong duoc IM LANG ve viec do — bien nhan phai ghi `partial`, khong phai `preserved`.
 *  2. Neu ve sau ai do lam duong xu ly GIU duoc dau hieu, phep kiem se do va bat phai doc lai —
 *     do la mot thay doi TOT, nhung no phai duoc nhin thay chu khong tu troi qua.
 */
describe('D-078 — dau hieu AI qua duong xu ly anh', () => {
  it('dau C2PA `present` di vao, `absent` di ra — o CA BA thao tac anh', async () => {
    const { DeterministicImageProvider } = await import('../src/providers/deterministic-image.js');
    const { detectC2pa } = await import('../src/media/c2pa-probe.js');
    const vao = fixture('image-c2pa-present.png');

    expect(detectC2pa(vao).presence, 'moc thu sai: tep vao phai CO dau').toBe('present');

    const provider = new DeterministicImageProvider();
    const vung = [{ x: 0.2, y: 0.2, width: 0.3, height: 0.3, startSeconds: null, endSeconds: null }];
    for (const thaoTac of ['blur', 'crop', 'brand_overlay'] as const) {
      const ra = await provider.process(vao, thaoTac, vung);
      expect(
        detectC2pa(ra.bytes).presence,
        `thao tac "${thaoTac}": neu dau hieu GIU duoc thi day la thay doi TOT — doc lai D-078 va cau chu cho nguoi dung`,
      ).toBe('absent');
    }
  });

  it('BIEN NHAN phai goi dung ten viec do: `partial`, KHONG phai `preserved`', async () => {
    const { evaluatePreservation } = await import('@mediaclear/contracts');
    const ra = evaluatePreservation(
      { originalMetadataPresence: 'present', aiProvenancePresence: 'present', detectorId: 'x', detectorLimitationNote: null },
      { originalMetadataPresence: 'present', aiProvenancePresence: 'absent', detectorId: 'x', detectorLimitationNote: null },
      true,
    );
    expect(ra.result, 'mat dau hieu AI ma bien nhan van khai da giu nguyen').toBe('partial');
    expect(ra.evidenceStatus).toBe('partially_verified');
  });
});
