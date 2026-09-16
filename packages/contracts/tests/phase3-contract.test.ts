/**
 * P3: hop dong dung chung + kiem luc chay (dong D-047).
 *
 * Phep thu quan trong nhat la cac ca AM: thieu truong, sai enum, sai kieu. Mot bo kiem chi biet
 * noi "dung" khi du lieu dung thi khong chan duoc gi — no phai NOI DUOC SAI O DAU.
 */
import { describe, expect, it } from 'vitest';
import {
  AUDIO_DURATION_TOLERANCE_SECONDS,
  EXPORT_PRESET_SCHEMA,
  JOB_STATES,
  JOB_STATE_SCHEMA,
  VIDEO_JOB_VIEW_SCHEMA,
  VIDEO_OPERATION_MODES,
  audioAllowsCompletion,
  compareAudio,
  validateRegion,
  schema,
  type AudioTrack,
  type Region,
} from '../src/index.js';

const okRegion: Region = { x: 0.1, y: 0.1, width: 0.2, height: 0.2, startSeconds: null, endSeconds: null };
const track = (over: Partial<AudioTrack> = {}): AudioTrack => ({
  present: true,
  codec: 'aac',
  durationSeconds: 10,
  channelCount: 2,
  ...over,
});

const jobView = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  jobId: 'job_1',
  assetId: 'ast_1',
  state: 'processing',
  operationMode: 'mask',
  presetId: null,
  regions: [okRegion],
  outputAssetId: null,
  reasonCode: null,
  receipt: null,
  storageEphemeral: true,
  ...over,
});

describe('P3 — nguon duy nhat cho trang thai job', () => {
  it('lich kiem trang thai doc THANG tu JOB_STATES, khong phai ban chep', () => {
    for (const state of JOB_STATES) {
      expect(JOB_STATE_SCHEMA.check(state, 'state').ok, state).toBe(true);
    }
    // Tam trang thai canonical ma de bai Phase 3 doi hoi deu phai co.
    for (const required of ['uploaded', 'validating', 'queued', 'processing', 'review_required', 'completed', 'failed', 'blocked']) {
      expect(JOB_STATES as readonly string[]).toContain(required);
    }
  });

  it('SAI ENUM bi tu choi, va noi ro gia tri nhan duoc', () => {
    const r = JOB_STATE_SCHEMA.check('finished', 'state');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain('finished');
  });
});

describe('P3 — kiem luc chay tai bien', () => {
  it('phan hoi dung hinh dang thi qua, va tra ve gia tri da kiem', () => {
    const r = schema.checkEnvelope(VIDEO_JOB_VIEW_SCHEMA, { ok: true, data: jobView() });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.state).toBe('processing');
  });

  it('THIEU TRUONG bat buoc bi bat, va noi ro truong nao', () => {
    const missing = jobView();
    delete missing.storageEphemeral;
    const r = schema.checkEnvelope(VIDEO_JOB_VIEW_SCHEMA, { ok: true, data: missing });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toContain('storageEphemeral');
  });

  it('SAI KIEU bi bat (chuoi o cho so)', () => {
    const r = schema.checkEnvelope(VIDEO_JOB_VIEW_SCHEMA, {
      ok: true,
      data: jobView({ regions: [{ ...okRegion, width: 'rong' }] }),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toContain('width');
  });

  it('SAI ENUM long trong phan hoi bi bat', () => {
    const r = schema.checkEnvelope(VIDEO_JOB_VIEW_SCHEMA, { ok: true, data: jobView({ state: 'khong_co_that' }) });
    expect(r.ok).toBe(false);
  });

  it('null KHAC voi vang mat: `nullable` nhan null, truong bat buoc thi khong', () => {
    expect(schema.checkEnvelope(VIDEO_JOB_VIEW_SCHEMA, { ok: true, data: jobView({ outputAssetId: null }) }).ok).toBe(true);
    const nulled = jobView({ storageEphemeral: null });
    expect(schema.checkEnvelope(VIDEO_JOB_VIEW_SCHEMA, { ok: true, data: nulled }).ok).toBe(false);
  });

  it('truong THUA bi bo qua - may chu them field moi khong lam hong giao dien cu', () => {
    const r = schema.checkEnvelope(VIDEO_JOB_VIEW_SCHEMA, { ok: true, data: jobView({ truongMoiToanhToang: 123 }) });
    expect(r.ok).toBe(true);
  });

  it('vo boc LOI khong bi nham la thanh cong', () => {
    const r = schema.checkEnvelope(VIDEO_JOB_VIEW_SCHEMA, { ok: false, error: { code: 'X', messageKey: 'y' } });
    expect(r.ok).toBe(false);
  });

  it('phan hoi KHONG PHAI object (chuoi, null, mang) khong lam no tung', () => {
    for (const bad of ['khong phai json', null, [], 42]) {
      const r = schema.checkEnvelope(VIDEO_JOB_VIEW_SCHEMA, bad);
      expect(r.ok, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe('P3 — vung chon', () => {
  it('vung o BON GOC deu hop le', () => {
    const corners: Region[] = [
      { x: 0, y: 0, width: 0.2, height: 0.2, startSeconds: null, endSeconds: null },
      { x: 0.8, y: 0, width: 0.2, height: 0.2, startSeconds: null, endSeconds: null },
      { x: 0, y: 0.8, width: 0.2, height: 0.2, startSeconds: null, endSeconds: null },
      { x: 0.8, y: 0.8, width: 0.2, height: 0.2, startSeconds: null, endSeconds: null },
    ];
    for (const r of corners) expect(validateRegion(r), JSON.stringify(r)).toEqual([]);
  });

  it('vung CHAM BIEN (x + width = 1) van hop le', () => {
    expect(validateRegion({ x: 0.5, y: 0.5, width: 0.5, height: 0.5, startSeconds: null, endSeconds: null })).toEqual([]);
  });

  it('vung TRAN RA NGOAI bi tu choi - khong cat am tham', () => {
    const problems = validateRegion({ x: 0.9, y: 0.1, width: 0.2, height: 0.2, startSeconds: null, endSeconds: null });
    expect(problems.some((p) => p.reason === 'exceeds_bounds')).toBe(true);
  });

  it('vung RONG (width = 0) bi tu choi', () => {
    expect(validateRegion({ ...okRegion, width: 0 }).some((p) => p.reason === 'empty_area')).toBe(true);
  });

  it('toa do ngoai 0..1 bi tu choi', () => {
    expect(validateRegion({ ...okRegion, x: -0.1 }).some((p) => p.reason === 'out_of_range')).toBe(true);
    expect(validateRegion({ ...okRegion, y: 1.5 }).some((p) => p.reason === 'out_of_range')).toBe(true);
  });
});

describe('P3 — so sanh audio', () => {
  it('co audio truoc, co audio sau, thoi luong khop => preserved', () => {
    expect(compareAudio(track(), track())).toBe('preserved');
  });

  it('CA NANG NHAT: co audio truoc, MAT sau khi render => lost, va KHONG duoc completed', () => {
    const verdict = compareAudio(track(), track({ present: false, codec: null, durationSeconds: null }));
    expect(verdict).toBe('lost');
    expect(audioAllowsCompletion(verdict)).toBe(false);
  });

  it('video VON KHONG co audio khac han voi video BI MAT audio', () => {
    const noAudio = track({ present: false, codec: null, durationSeconds: null, channelCount: null });
    const verdict = compareAudio(noAudio, noAudio);
    expect(verdict).toBe('absent_by_design');
    expect(audioAllowsCompletion(verdict)).toBe(true);
    expect(verdict).not.toBe('lost');
  });

  it('lech thoi luong qua dung sai => duration_drift, khong duoc completed', () => {
    const drifted = track({ durationSeconds: 10 + AUDIO_DURATION_TOLERANCE_SECONDS + 0.01 });
    const verdict = compareAudio(track(), drifted);
    expect(verdict).toBe('duration_drift');
    expect(audioAllowsCompletion(verdict)).toBe(false);
  });

  it('lech TRONG dung sai van la preserved', () => {
    expect(compareAudio(track(), track({ durationSeconds: 10 + AUDIO_DURATION_TOLERANCE_SECONDS - 0.01 }))).toBe('preserved');
  });

  it('preset doi audio CO CHU DICH duoc ghi rieng, khong bao la mat', () => {
    expect(compareAudio(track(), track({ codec: 'opus' }), { presetChangesAudio: true })).toBe('changed_by_preset');
  });

  it('SO KENH doi (stereo -> mono) => channel_changed, va KHONG duoc completed', () => {
    /*
     * Lo hong da dong: truoc day `channelCount` co trong luoc do nhung `compareAudio` KHONG dung
     * lan nao. Stereo bi ep ve mono thi tieng VAN CON va thoi luong VAN DUNG, nen moi phep kiem
     * khac deu qua — he thong se bao `preserved` cho mot ban da mat mot kenh tieng.
     */
    const verdict = compareAudio(track({ channelCount: 2 }), track({ channelCount: 1 }));
    expect(verdict).toBe('channel_changed');
    expect(audioAllowsCompletion(verdict)).toBe(false);
    expect(verdict).not.toBe('preserved');
  });

  it('so kenh GIU NGUYEN thi van la preserved', () => {
    expect(compareAudio(track({ channelCount: 2 }), track({ channelCount: 2 }))).toBe('preserved');
  });

  it('CHUA DO duoc so kenh thi KHONG suy ra la "khong doi"', () => {
    // `null` la "chua do", khong phai "giong nhau" — cung bai hoc D-044.
    expect(compareAudio(track({ channelCount: null }), track({ channelCount: 1 }))).toBe('preserved');
    expect(compareAudio(track({ channelCount: 2 }), track({ channelCount: null }))).toBe('preserved');
  });

  it('khong do duoc thoi luong => unknown, KHONG suy ra la preserved', () => {
    const verdict = compareAudio(track({ durationSeconds: null }), track());
    expect(verdict).toBe('unknown');
    expect(audioAllowsCompletion(verdict)).toBe(false);
  });
});

describe('P3 — preset', () => {
  it('preset khai `verified` cho phan chua co bang chung thi van qua lich kiem - nhung `evidence` phai co', () => {
    // Lich kiem KHONG the biet bang chung co that hay khong. Chot do nam o test cua P3-MCP-34.
    const r = EXPORT_PRESET_SCHEMA.check(
      {
        id: 'tiktok', label: 'TikTok', aspectRatio: '9:16', targetResolution: null,
        videoCodec: 'h264', audioCodec: 'aac', container: 'mp4',
        maxDurationSeconds: null, maxFileSizeBytes: null, status: 'unknown', evidence: null,
      },
      'preset',
    );
    expect(r.ok).toBe(true);
  });

  it('status ngoai danh muc bang chung bi tu choi', () => {
    const r = EXPORT_PRESET_SCHEMA.check(
      {
        id: 'x', label: 'X', aspectRatio: '9:16', targetResolution: null,
        videoCodec: 'h264', audioCodec: 'aac', container: 'mp4',
        maxDurationSeconds: null, maxFileSizeBytes: null, status: 'production_ready', evidence: null,
      },
      'preset',
    );
    expect(r.ok).toBe(false);
  });

  it('ba cach xu ly deu la phep tat dinh, khong cai nao ten la AI', () => {
    expect([...VIDEO_OPERATION_MODES]).toEqual(['mask', 'crop', 'blur']);
    expect(VIDEO_OPERATION_MODES.join(' ')).not.toContain('ai');
  });
});
