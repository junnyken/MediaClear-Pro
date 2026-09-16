/**
 * P3-MCP-34: preset xuat.
 *
 * Phep thu quan trong nhat KHONG phai "preset co ton tai khong", ma la "preset co khai NHIEU HON
 * bang chung khong". De bai cam dung `verified` neu chi lay tu gia dinh hoac tai lieu quang cao.
 *
 * Tep nay chinh la `evidence` ma moi preset tro toi.
 */
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { EXPORT_PRESETS, findPreset, presetClaimsMoreThanEvidence } from '@mediaclear/contracts';
import { ffmpegAvailable, probeVideo, renderVideo } from '../src/media/ffmpeg.js';
import { buildServer } from '../src/server.js';
import { FIXTURES } from './helpers.js';

const hasFfmpeg = await ffmpegAvailable();
const load = (name: string): Promise<Buffer> => readFile(join(FIXTURES, name));

describe('P3-MCP-34 — preset khong duoc khai qua bang chung', () => {
  it('KHONG preset nao khai `verified` — vi phan tuan thu nen tang chua do duoc (Q-P3-04)', () => {
    for (const preset of EXPORT_PRESETS) {
      expect(preset.status, `${preset.id} khai verified ma khong co bang chung day du`).not.toBe('verified');
    }
  });

  it('khong preset nao khai nhieu hon bang chung no co', () => {
    for (const preset of EXPORT_PRESETS) {
      expect(presetClaimsMoreThanEvidence(preset), preset.id).toBe(false);
    }
  });

  it('gioi han cua NEN TANG deu la null — khong lay so tu tai lieu quang cao', () => {
    for (const preset of EXPORT_PRESETS) {
      expect(preset.maxDurationSeconds, `${preset.id} dien gioi han nen tang ma khong co bang chung`).toBeNull();
      expect(preset.maxFileSizeBytes, preset.id).toBeNull();
    }
  });

  it('moi preset tro toi mot ban ghi bang chung co that', () => {
    for (const preset of EXPORT_PRESETS) {
      expect(preset.evidence).toBe('apps/api/tests/p3-presets.test.ts');
    }
  });

  it('co du ba preset de bai doi: TikTok, Reels, Shorts', () => {
    expect(findPreset('tiktok_vertical')).not.toBeNull();
    expect(findPreset('reels_vertical')).not.toBeNull();
    expect(findPreset('shorts_vertical')).not.toBeNull();
  });

  it('preset khong co that tra null, khong nem loi', () => {
    expect(findPreset('khong_ton_tai')).toBeNull();
  });

  it('nhan la KHOA i18n, khong phai cau chu viet thang', () => {
    for (const preset of EXPORT_PRESETS) {
      expect(preset.label).toMatch(/^preset\./);
    }
  });
});

describe.skipIf(!hasFfmpeg)('P3-MCP-34 — pipeline SINH DUNG nhung gi preset khai', () => {
  it('preset doc 9:16: pipeline cho ra ti le gan 9:16, codec va container dung nhu khai', async () => {
    const preset = findPreset('tiktok_vertical');
    expect(preset).not.toBeNull();
    const out = await renderVideo(await load('video-landscape-audio.mp4'), {
      mode: 'crop', regions: [], cropAspect: preset!.aspectRatio,
    });
    const ratio = (out.probe.widthPx ?? 0) / (out.probe.heightPx ?? 1);
    // 9/16 = 0,5625. Cho sai so vi kich thuoc phai lam tron ve so chan.
    expect(Math.abs(ratio - 9 / 16)).toBeLessThan(0.1);
    expect(out.probe.videoCodec).toBe(preset!.videoCodec);
    expect(out.probe.container).toContain('mp4');
    expect(out.probe.audio.codec).toBe(preset!.audioCodec);
  }, 180_000);

  it('preset ngang 16:9 cho ra ti le gan 16:9', async () => {
    const preset = findPreset('landscape');
    const out = await renderVideo(await load('video-with-audio.mp4'), {
      mode: 'crop', regions: [], cropAspect: preset!.aspectRatio,
    });
    const ratio = (out.probe.widthPx ?? 0) / (out.probe.heightPx ?? 1);
    expect(Math.abs(ratio - 16 / 9)).toBeLessThan(0.2);
  }, 180_000);

  it('preset vuong 1:1 cho ra khung gan vuong', async () => {
    const preset = findPreset('square');
    const out = await renderVideo(await load('video-landscape-audio.mp4'), {
      mode: 'crop', regions: [], cropAspect: preset!.aspectRatio,
    });
    const ratio = (out.probe.widthPx ?? 0) / (out.probe.heightPx ?? 1);
    expect(Math.abs(ratio - 1)).toBeLessThan(0.15);
  }, 180_000);

  it('AUDIO giu nguyen qua TUNG preset', async () => {
    for (const id of ['tiktok_vertical', 'landscape', 'square']) {
      const preset = findPreset(id);
      const source = await load('video-landscape-audio.mp4');
      const before = await probeVideo(source);
      const out = await renderVideo(source, { mode: 'crop', regions: [], cropAspect: preset!.aspectRatio });
      expect(out.probe.audio.present, `preset ${id} lam mat audio`).toBe(true);
      expect(out.probe.audio.codec).toBe(before.audio.codec);
    }
  }, 240_000);
});

describe('P3-MCP-34 — route danh sach preset', () => {
  it('doc duoc khi CHUA dang nhap - day la nang luc he thong, khong phai du lieu cua ai', async () => {
    const app = buildServer();
    const res = await app.inject({ method: 'GET', url: '/v1/export-presets' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.presets.length).toBe(EXPORT_PRESETS.length);
    await app.close();
  });

  it('KHONG preset nao trong phan hoi hien la `verified`', async () => {
    const app = buildServer();
    const body = (await app.inject({ method: 'GET', url: '/v1/export-presets' })).json();
    for (const preset of body.data.presets as Array<{ id: string; status: string }>) {
      expect(preset.status, preset.id).not.toBe('verified');
    }
    await app.close();
  });
});
