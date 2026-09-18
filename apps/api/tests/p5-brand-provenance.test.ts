/**
 * `P5-MCP-50`, `P5-MCP-52`, `P5-MCP-53` o TANG API.
 *
 * Moi phep kiem duoi day tuong ung voi mot cach he thong co the noi doi hoac lam lo du lieu. Khong
 * phep kiem nao o day hoi "ham co chay khong".
 */
import { describe, expect, it } from 'vitest';
import { BRAND_KIT_LIST_SCHEMA, PROVENANCE_TIMELINE_SCHEMA, schema } from '@mediaclear/contracts';
import {
  addBrandKitVersion, createBrandKit, getBrandKit, listBrandKits, setBrandKitState,
} from '../src/services/brand-kits.js';
import { getAssetProvenance } from '../src/services/provenance-inspector.js';
import { getJobMetadataComparison } from '../src/services/metadata-provenance.js';
import { resolveActor } from '../src/services/access.js';
import { JobWorker } from '../src/worker/job-worker.js';
import {
  attest, auth, createJob, createProject, createWorkspace, makeApp, signIn, uploadFixture, validateAsset,
} from './helpers.js';

const DRAFT = {
  name: 'Mat Bao', colors: ['#112233', '#445566'], logoAssetId: null,
  overlayDefaults: { position: 'top_left', opacity: 0.4, includeDisclosure: false },
};

async function moiTruong() {
  const { app, ctx } = await makeApp();
  const token = await signIn(app, `p5-${Date.now()}-${Math.random()}@matbao.com`);
  const ws = await createWorkspace(app, token, 'Studio');
  const resolved = await resolveActor(ctx, token, ws);
  if (!resolved.ok) throw new Error('khong dung duoc actor');
  return { app, ctx, token, ws, actor: resolved.data };
}

describe('P5-MCP-53 — bo nhan dien thuong hieu', () => {
  it('tao duoc, va phien ban dau tien la 1', async () => {
    const { app, ctx, actor } = await moiTruong();
    const r = await createBrandKit(ctx, actor, DRAFT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.currentVersion).toBe(1);
    expect(r.data.versions).toHaveLength(1);
    expect(r.data.state).toBe('active');
    await app.close();
  });

  it('bo SAI bi tu choi kem DANH SACH ly do, va khong tao dong rac', async () => {
    const { app, ctx, actor } = await moiTruong();
    const r = await createBrandKit(ctx, actor, {
      ...DRAFT, name: '  ', colors: ['xanh'],
      overlayDefaults: { position: 'giua', opacity: 9, includeDisclosure: false },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const reasons = String(r.error.params?.reasons ?? '');
      expect(reasons).toContain('name_empty');
      expect(reasons).toContain('color_invalid');
      expect(reasons).toContain('opacity_out_of_range');
      expect(reasons).toContain('position_invalid');
    }
    const list = await listBrandKits(ctx, actor);
    expect(list.ok && list.data.items).toHaveLength(0);
    await app.close();
  });

  /**
   * Phep kiem quan trong nhat cua `MCP-53`.
   *
   * Sua = ghi them PHIEN BAN. Neu sua de len dong cu, moi bien nhan da phat hanh truoc do se lap
   * tuc tro toi mot noi dung khac — va khong cach nao phat hien duoc sau khi da xay ra.
   */
  it('SUA = them phien ban moi; phien ban CU con nguyen tung truong', async () => {
    const { app, ctx, actor } = await moiTruong();
    const tao = await createBrandKit(ctx, actor, DRAFT);
    if (!tao.ok) throw new Error('moc thu hong');
    const id = tao.data.id;
    const v1 = tao.data.versions[0]!;

    const sua = await addBrandKitVersion(ctx, actor, id, {
      ...DRAFT, name: 'Mat Bao 2026', colors: ['#000000'],
      overlayDefaults: { position: 'bottom_right', opacity: 0.9, includeDisclosure: true },
    });
    expect(sua.ok).toBe(true);
    if (!sua.ok) return;

    expect(sua.data.currentVersion).toBe(2);
    expect(sua.data.versions).toHaveLength(2);
    const conNguyen = sua.data.versions.find((v) => v.version === 1)!;
    expect(conNguyen, 'phien ban cu bi ghi de => bien nhan cu tro toi noi dung khac').toEqual(v1);
    await app.close();
  });

  it('LUU TRU chu khong xoa: ban ghi va moi phien ban deu o lai', async () => {
    const { app, ctx, actor } = await moiTruong();
    const tao = await createBrandKit(ctx, actor, DRAFT);
    if (!tao.ok) throw new Error('moc thu hong');

    const r = await setBrandKitState(ctx, actor, tao.data.id, 'archived');
    expect(r.ok && r.data.state).toBe('archived');
    const van = await getBrandKit(ctx, actor, tao.data.id);
    expect(van.ok, 'luu tru ma ban ghi bien mat => mat bang chung').toBe(true);
    expect(van.ok && van.data.versions).toHaveLength(1);
    await app.close();
  });

  it('WORKSPACE KHAC khong doc duoc, va khong lo ra la no co ton tai', async () => {
    const { app, ctx, actor } = await moiTruong();
    const tao = await createBrandKit(ctx, actor, DRAFT);
    if (!tao.ok) throw new Error('moc thu hong');

    const laToken = await signIn(app, `nguoi-la-${Date.now()}@matbao.com`);
    const laWs = await createWorkspace(app, laToken, 'Khong gian khac');
    const la = await resolveActor(ctx, laToken, laWs);
    if (!la.ok) throw new Error('khong dung duoc actor la');

    const doc = await getBrandKit(ctx, la.data, tao.data.id);
    expect(doc.ok).toBe(false);
    if (!doc.ok) {
      // CUNG ma loi voi "khong ton tai": khong xac nhan su ton tai cua tai nguyen nguoi khac.
      expect(doc.error.code).toBe('MCP_RESOURCE_NOT_FOUND');
    }
    const sua = await addBrandKitVersion(ctx, la.data, tao.data.id, DRAFT);
    expect(sua.ok, 'workspace khac SUA duoc bo nhan dien').toBe(false);

    const list = await listBrandKits(ctx, la.data);
    expect(list.ok && list.data.items, 'bo cua workspace khac lot vao danh sach').toHaveLength(0);
    await app.close();
  });

  it('lop phu MAC DINH TAT — `MCP-54` la opt-in', async () => {
    const { app, ctx, actor } = await moiTruong();
    const r = await createBrandKit(ctx, actor, DRAFT);
    expect(r.ok && r.data.versions[0]!.overlayDefaults.includeDisclosure).toBe(false);
    await app.close();
  });
});

describe('P5-MCP-50 + P5-MCP-52 — dong thoi gian va bien nhan', () => {
  async function jobAnhDaXong() {
    const { app, ctx } = await makeApp();
    const token = await signIn(app, `p5j-${Date.now()}-${Math.random()}@matbao.com`);
    const ws = await createWorkspace(app, token, 'Studio');
    const prj = await createProject(app, token, ws, 'Du an');
    const up = await uploadFixture(app, token, ws, prj, 'image-with-metadata.jpg', {
      mimeType: 'image/jpeg', mediaType: 'image',
    });
    await validateAsset(app, token, ws, up.assetId);
    await attest(app, token, ws, up.assetId);
    const created = await createJob(app, token, ws, up.assetId, { operations: ['blur'] });
    await new JobWorker(ctx, { maxCycles: 3, idleDelayMs: 1 }).start();
    const resolved = await resolveActor(ctx, token, ws);
    if (!resolved.ok) throw new Error('khong dung duoc actor');
    return { app, ctx, ws, token, actor: resolved.data, assetId: up.assetId, jobId: created.body.data.job.id as string };
  }

  it('TRUY NGUOC duoc: tu tep goc den job, ban ket qua va bien nhan', async () => {
    const { app, actor, assetId, ctx } = await jobAnhDaXong();
    const r = await getAssetProvenance(ctx, actor, assetId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const kinds = r.data.nodes.map((n) => n.kind);
    for (const can of ['original_asset', 'job', 'output_asset', 'receipt', 'disclosure']) {
      expect(kinds, `thieu muc ${can} trong dong thoi gian`).toContain(can);
    }
    expect(r.data.orphanIds, 'cay day du ma van co muc mo coi').toEqual([]);

    // Moi muc (tru goc) phai tro toi mot cha CO THAT — do la thu lam cho no "truy nguoc duoc".
    const ids = new Set(r.data.nodes.map((n) => n.id));
    for (const n of r.data.nodes) {
      if (n.parentId !== null) expect(ids.has(n.parentId), `muc ${n.id} tro toi cha khong co`).toBe(true);
    }
    await app.close();
  });

  it('BIEN NHAN mang ket luan thong tin kem theo va cong bo AI', async () => {
    const { app, ctx, ws, jobId } = await jobAnhDaXong();
    const receipt = await ctx.persistence.receipts.findByJob(ws, jobId);
    expect(receipt).not.toBeNull();
    expect(receipt!.metadataVerdict, 'bien nhan khong mang ket luan nao ve thong tin kem theo').not.toBeNull();
    expect(receipt!.disclosureState).not.toBeNull();
    expect(receipt!.disclosureLimitationKey, 'ket luan khong kem gioi han').not.toBeNull();
    expect(receipt!.schemaVersion).toBe(3);
    // Khong ai chon => lop phu KHONG duoc dan, va ca ba o deu phai noi dung dieu do.
    expect(receipt!.brandOverlayApplied, 'he thong tu dan lop phu').toBe(false);
    expect(receipt!.disclosureOverlayApplied).toBe(false);
    expect(receipt!.brandLogoAssetId).toBeNull();
    // Khong ai chon bo nhan dien => ban xuat KHONG duoc mang lop phu.
    expect(receipt!.brandKitId, 'he thong tu ap dung bo nhan dien').toBeNull();
    expect(receipt!.brandKitVersion).toBeNull();
    await app.close();
  });

  it('cong bo AI KHONG overclaim khi dich vu xu ly chua duoc bat', async () => {
    const { app, ctx, ws, jobId } = await jobAnhDaXong();
    const receipt = await ctx.persistence.receipts.findByJob(ws, jobId);
    // `ai_not_used`/`ai_used` deu doi bang chung ve dich vu; chua co thi khong duoc ket luan.
    expect(['provider_blocked', 'provider_unknown', 'ai_status_unknown', 'ai_detection_only'])
      .toContain(receipt!.disclosureState);
    await app.close();
  });

  it('doi chieu thong tin kem theo doc lai duoc, va tinh LAI tu hai anh chup', async () => {
    const { app, ctx, actor, jobId } = await jobAnhDaXong();
    const r = await getJobMetadataComparison(ctx, actor, jobId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.fields.length, 'khong truong nao duoc doi chieu').toBeGreaterThan(5);
    expect(r.data.bothReadable).toBe(true);
    // Anh dau vao CO thiet bi chup; ban xuat khong giu => phai goi dung ten la go theo chinh sach.
    const make = r.data.fields.find((f) => f.key === 'exif.Make');
    expect(make, 'the thiet bi khong duoc doi chieu').toBeDefined();
    await app.close();
  });

  it('WORKSPACE KHAC khong doc duoc dong thoi gian cua asset nguoi khac', async () => {
    const { app, ctx, assetId } = await jobAnhDaXong();
    const laToken = await signIn(app, `la2-${Date.now()}@matbao.com`);
    const laWs = await createWorkspace(app, laToken, 'Khac');
    const la = await resolveActor(ctx, laToken, laWs);
    if (!la.ok) throw new Error('khong dung duoc actor la');
    const r = await getAssetProvenance(ctx, la.data, assetId);
    expect(r.ok).toBe(false);
    await app.close();
  });

  it('khong phien dang nhap thi khong doc duoc gi', async () => {
    const { app, ws } = await moiTruong();
    const res = await app.inject({ method: 'GET', url: '/v1/brand-kits', headers: { 'x-workspace-id': ws } });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  /**
   * `D-075` — phan hoi THAT cua may chu phai di qua CHINH lich kiem ma giao dien dung.
   *
   * Truoc phep kiem nay, khong test nao chay phan hoi that qua schema chung: cac test khac goi
   * thang vao muc dich vu, con test route chi kiem `Array.isArray`. Doi chung am `NC14` (them mot
   * truong bat buoc vao schema) van XANH — tuc la mot diem lech UI/may chu se di thang ra
   * production. Da xay ra that o lan bam tay: giao dien bao "Thong tin gui len chua hop le".
   */
  for (const [ten, url, lich] of [
    ['lich su cua tep', (a: string) => `/v1/assets/${a}/provenance`, PROVENANCE_TIMELINE_SCHEMA],
  ] as const) {
    it(`phan hoi THAT cua \`${ten}\` di qua duoc lich kiem chung`, async () => {
      const { app, token, ws, assetId } = await jobAnhDaXong();
      const res = await app.inject({ method: 'GET', url: url(assetId), headers: auth(token, ws) });
      expect(res.statusCode).toBe(200);
      const checked = schema.checkEnvelope(lich, res.json());
      expect(checked.ok, `phan hoi lech hop dong: ${checked.ok ? '' : checked.error.path + ' — ' + checked.error.message}`)
        .toBe(true);
      await app.close();
    });
  }

  it('phan hoi THAT cua bo nhan dien di qua duoc lich kiem chung', async () => {
    const { app, ctx, actor, token, ws } = await moiTruong();
    await createBrandKit(ctx, actor, DRAFT);
    const res = await app.inject({ method: 'GET', url: '/v1/brand-kits', headers: auth(token, ws) });
    expect(res.statusCode).toBe(200);
    const checked = schema.checkEnvelope(BRAND_KIT_LIST_SCHEMA, res.json());
    expect(checked.ok, `phan hoi lech hop dong: ${checked.ok ? '' : checked.error.path + ' — ' + checked.error.message}`)
      .toBe(true);
    await app.close();
  });
});
