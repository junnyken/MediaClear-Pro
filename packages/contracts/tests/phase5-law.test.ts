/**
 * Phase 5 — luat thuan (`D-075`). Khong chay I/O, khong can co so du lieu.
 *
 * Bo test nay canh nhung cau NOI DOI cu the ma Phase 5 ton tai de chan, chu khong kiem "ham co chay
 * khong". Moi phep kiem duoi day tuong ung voi mot cach he thong tung co the noi sai su that.
 */
import { describe, expect, it } from 'vitest';
import {
  METADATA_CATEGORIES_STRIPPED_BY_DEFAULT,
  buildProvenanceTimeline,
  compareMetadata,
  disclosureStatusFor,
  validateBrandKitDraft,
  type MetadataField,
  type MetadataSnapshot,
  type ProvenanceNode,
} from '../src/phase5.js';

const snap = (fields: MetadataField[], readable = true): MetadataSnapshot =>
  ({ readable, fields, detectorId: 'test' });

const f = (key: string, category: MetadataField['category'], value: MetadataField['value']): MetadataField =>
  ({ key, category, value });

describe('P5-MCP-51 — doi chieu thong tin kem theo tep', () => {
  it('truong con nguyen o ca hai phia => `preserved`', () => {
    const r = compareMetadata(
      snap([f('image.width', 'technical', 48)]),
      snap([f('image.width', 'technical', 48)]),
    );
    expect(r.fields[0]!.status).toBe('preserved');
    expect(r.verdict).toBe('preserved');
  });

  it('truong DOI gia tri => `changed`, va verdict chung la `changed`', () => {
    const r = compareMetadata(
      snap([f('video.codec', 'technical', 'h264')]),
      snap([f('video.codec', 'technical', 'vp9')]),
    );
    expect(r.fields[0]!.status).toBe('changed');
    expect(r.verdict).toBe('changed');
  });

  it('truong bien mat NGOAI chinh sach => `removed` (mat mat), khong phai `removed_by_policy`', () => {
    const r = compareMetadata(
      snap([f('tag.title', 'descriptive', 'ten cu')]),
      snap([f('tag.title', 'descriptive', null)]),
    );
    expect(r.fields[0]!.status).toBe('removed');
    expect(r.verdict).toBe('changed');
  });

  /**
   * Phep kiem quan trong nhat cua `MCP-51`.
   *
   * Go vi tri chup la QUYET DINH, khong phai mat mat. Gop hai cai vao mot trang thai thi khong con
   * phan biet duoc "he thong lam dung viec cua no" voi "he thong lam hong tep".
   */
  it('KHI mot nhom duoc khai la go theo chinh sach => `removed_by_policy` + `partially_preserved`', () => {
    // Truyen danh sach TUONG MINH: day la phep kiem LUAT phan loai, khong phai chinh sach mac dinh.
    const r = compareMetadata(
      snap([f('tag.location', 'location', '+10.77'), f('exif.Make', 'device', 'MatBao')]),
      snap([f('tag.location', 'location', null), f('exif.Make', 'device', null)]),
      ['location', 'device'],
    );
    expect(r.fields.every((x) => x.status === 'removed_by_policy')).toBe(true);
    expect(r.verdict, 'go theo chinh sach van la tep KHONG con nguyen').toBe('partially_preserved');
    expect(r.strippedCategories).toEqual(['device', 'location']);
  });

  /**
   * `Q-P5-02`. He thong KHONG go truong nao — `preserveOriginalMetadata` la `true` co dinh theo
   * guardrail 6/7, va do duoc tren luot chay that: `exif.Make` di nguyen ven vao ban xuat.
   *
   * Neu danh sach mac dinh van khai `['location','device']` thi mot truong vi tri bien mat vi BAT
   * KY ly do nao se bi goi ten la "go theo chinh sach" — he thong nhan cong mot viec no khong lam
   * va che mat mot mat mat that.
   */
  it('MAC DINH khong go nhom nao: truong bien mat duoc goi dung ten la `removed`', () => {
    expect(METADATA_CATEGORIES_STRIPPED_BY_DEFAULT, 'khai mot chinh sach he thong khong thi hanh').toEqual([]);
    const r = compareMetadata(
      snap([f('tag.location', 'location', '+10.77')]),
      snap([f('tag.location', 'location', null)]),
    );
    expect(r.fields[0]!.status, 'mat mat that bi che thanh "dung y do"').toBe('removed');
    expect(r.strippedCategories).toEqual([]);
  });

  /**
   * Cho de noi doi nhat: mot anh chup khong doc duoc ma van bao "da giu".
   */
  it('MOT phia khong doc duoc => TAT CA la `unknown`, KHONG BAO GIO `preserved`', () => {
    const r = compareMetadata(
      snap([f('image.width', 'technical', 48)]),
      snap([f('image.width', 'technical', 48)], false),
    );
    expect(r.verdict, 'phep do that bai bi doc thanh "khong mat gi"').toBe('unknown');
    expect(r.fields.every((x) => x.status === 'unknown')).toBe(true);
    expect(r.evidenceStatus).toBe('unknown');
  });

  it('truong chi co o phia SAU => `added`; khong co o ca hai => `not_available`', () => {
    const r = compareMetadata(
      snap([f('a', 'technical', null), f('b', 'technical', null)]),
      snap([f('a', 'technical', 'moi'), f('b', 'technical', null)]),
    );
    expect(r.fields.find((x) => x.key === 'a')!.status).toBe('added');
    expect(r.fields.find((x) => x.key === 'b')!.status).toBe('not_available');
  });

  it('lay HOP cua hai phia lam tap khoa — truong chi co o mot phia khong bi bo qua', () => {
    const r = compareMetadata(
      snap([f('chi_o_truoc', 'descriptive', 'x')]),
      snap([f('chi_o_sau', 'descriptive', 'y')]),
    );
    expect(r.fields.map((x) => x.key).sort()).toEqual(['chi_o_sau', 'chi_o_truoc']);
  });

  it('`evidenceStatus` chi `verified` khi KHONG con `unknown` nao', () => {
    const tot = compareMetadata(snap([f('a', 'technical', 1)]), snap([f('a', 'technical', 1)]));
    expect(tot.evidenceStatus).toBe('verified');
    const xau = compareMetadata(snap([], false), snap([]));
    expect(xau.evidenceStatus).toBe('unknown');
  });
});

describe('P5-MCP-54 — cong bo AI', () => {
  const base = { detectorVerifiesSignature: false, providerStatus: 'verified' as const, aiStepUsed: null };

  /**
   * Ba phep kiem duoi day la ba dieu de bai goi la "overclaim". Moi cai deu tung la mot cach he
   * thong co the noi sai su that theo huong nguy hiem nhat.
   */
  it('`absent` KHONG thanh "chac chan khong phai AI"', () => {
    const r = disclosureStatusFor({ ...base, inputAiPresence: 'absent' });
    expect(r.state, 'khong thay dau hieu bi doc thanh mot ket luan').not.toBe('ai_not_used');
    expect(r.state).toBe('ai_status_unknown');
    expect(r.evidenceStatus).toBe('unknown');
  });

  it('`unknown` giu nguyen `unknown`, kem ly do vi sao khong doc duoc', () => {
    const r = disclosureStatusFor({ ...base, inputAiPresence: 'unknown' });
    expect(r.state).toBe('ai_status_unknown');
    expect(r.limitationKey).toBe('disclosure.limitation.no_reader');
  });

  it('`present` thanh "chi do duoc dau hieu", KHONG thanh "da xac minh"', () => {
    const r = disclosureStatusFor({ ...base, inputAiPresence: 'present' });
    expect(r.state).toBe('ai_detection_only');
    expect(r.evidenceStatus, 'co dau hieu bi doc thanh da xac minh').toBe('partially_verified');
    expect(r.limitationKey).toBe('disclosure.limitation.presence_only');
  });

  it('provider `blocked` duoc tra loi TRUOC moi ket luan khac', () => {
    const r = disclosureStatusFor({ ...base, providerStatus: 'blocked', inputAiPresence: 'present', aiStepUsed: true });
    expect(r.state, 'ket luan ve AI khi chua co dich vu that').toBe('provider_blocked');
    expect(r.evidenceStatus).toBe('blocked');
  });

  it('provider `unknown` => `provider_unknown`, khong phai mot ket luan ve AI', () => {
    expect(disclosureStatusFor({ ...base, providerStatus: 'unknown', inputAiPresence: 'present' }).state)
      .toBe('provider_unknown');
  });

  it('do duoc buoc AI thi moi duoc ket luan, va do la bang chung truc tiep nhat', () => {
    expect(disclosureStatusFor({ ...base, inputAiPresence: 'absent', aiStepUsed: true }).state).toBe('ai_used');
    expect(disclosureStatusFor({ ...base, inputAiPresence: 'present', aiStepUsed: false }).state).toBe('ai_not_used');
  });

  it('MOI ket luan deu kem mot cau noi ve gioi han — khong ket luan nao la tuyet doi', () => {
    for (const p of ['present', 'absent', 'unknown'] as const) {
      expect(disclosureStatusFor({ ...base, inputAiPresence: p }).limitationKey).toMatch(/^disclosure\.limitation\./);
    }
  });
});

describe('P5-MCP-53 — kiem bo nhan dien', () => {
  const ok = {
    name: 'Mat Bao', colors: ['#112233'],
    overlayDefaults: { position: 'top_left' as const, opacity: 0.5, includeDisclosure: false },
  };

  it('bo hop le => khong loi nao', () => {
    expect(validateBrandKitDraft(ok)).toEqual([]);
  });

  it('tra DANH SACH loi, khong phai mot boolean — nguoi dung phai biet sua gi', () => {
    const errors = validateBrandKitDraft({
      ...ok, name: '   ', colors: ['khong-phai-mau'],
      overlayDefaults: { ...ok.overlayDefaults, opacity: 5 },
    });
    expect(errors).toContain('name_empty');
    expect(errors).toContain('color_invalid');
    expect(errors).toContain('opacity_out_of_range');
    expect(errors.length, 'gop nhieu loi thanh mot thi nguoi dung sua tung vong').toBeGreaterThan(2);
  });

  it('qua nhieu mau bi chan', () => {
    const colors = Array.from({ length: 13 }, () => '#aabbcc');
    expect(validateBrandKitDraft({ ...ok, colors })).toContain('too_many_colors');
  });
});

describe('P5-MCP-50 — dong thoi gian nguon goc', () => {
  const node = (id: string, at: string, parentId: string | null, kind: ProvenanceNode['kind'] = 'job'): ProvenanceNode =>
    ({ kind, id, occurredAt: at, parentId, labelKey: 'x', detail: [], evidenceStatus: 'verified' });

  it('sap xep ON DINH: cung moc thoi gian van ra cung thu tu o hai lan doc', () => {
    const nodes = [node('b', 't1', null), node('a', 't1', null), node('c', 't0', null)];
    const lan1 = buildProvenanceTimeline('ast_1', nodes).nodes.map((n) => n.id);
    const lan2 = buildProvenanceTimeline('ast_1', [...nodes].reverse()).nodes.map((n) => n.id);
    expect(lan1).toEqual(lan2);
    expect(lan1).toEqual(['c', 'a', 'b']);
  });

  /**
   * Muc mo coi phai LO RA. Loc no di se lam dong thoi gian trong nhu da day du — dung kieu noi doi
   * `MCP-50` ton tai de chan.
   */
  it('muc tro toi mot cha KHONG ton tai bi neu ten, khong bi giau', () => {
    const t = buildProvenanceTimeline('ast_1', [node('a', 't0', null), node('b', 't1', 'khong_co')]);
    expect(t.orphanIds).toEqual(['b']);
    expect(t.nodes.map((n) => n.id), 'muc mo coi bi loc mat khoi dong thoi gian').toContain('b');
  });

  it('cay day du thi khong co muc mo coi nao', () => {
    const t = buildProvenanceTimeline('ast_1', [node('a', 't0', null), node('b', 't1', 'a')]);
    expect(t.orphanIds).toEqual([]);
  });

  it('gioi han duoc mang theo, khong bi nuot', () => {
    const t = buildProvenanceTimeline('ast_1', [], ['provenance.limitation.metadata_unreadable']);
    expect(t.limitationKeys).toEqual(['provenance.limitation.metadata_unreadable']);
  });
});
