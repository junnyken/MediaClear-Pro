/**
 * Preset xuat cho TikTok / Reels / Shorts (P3-MCP-34).
 *
 * SU THAT PHAI NOI RO: `status` o day noi ve dieu HE THONG NAY TU DO DUOC — ti le khung hinh,
 * codec va container ma pipeline that su sinh ra. No KHONG noi ve viec nen tang co chap nhan tep
 * hay khong. Khong co bang chung nao ve dieu do trong repo (Q-P3-04), nen:
 *
 *  - `partially_verified` = pipeline sinh dung nhung gi khai o day, CO test chung minh.
 *  - `maxDurationSeconds` / `maxFileSizeBytes` deu `null`: gioi han cua nen tang la thu KHONG DO
 *    DUOC tu repo nay. Dien mot con so lay tu tai lieu quang cao chinh la thu de bai cam.
 *
 * Ten "TikTok/Reels/Shorts" la NHAN GOI Y ve ti le pho bien, khong phai loi cam ket tuong thich.
 */
import type { ExportPreset } from './phase3.js';

/** Tro toi bo test da chung minh cac gia tri duoi day. */
const PIPELINE_EVIDENCE = 'apps/api/tests/p3-presets.test.ts';

export const EXPORT_PRESETS: readonly ExportPreset[] = [
  {
    id: 'tiktok_vertical',
    label: 'preset.tiktok_vertical',
    aspectRatio: '9:16',
    targetResolution: null,
    videoCodec: 'h264',
    audioCodec: 'aac',
    container: 'mp4',
    maxDurationSeconds: null,
    maxFileSizeBytes: null,
    status: 'partially_verified',
    evidence: PIPELINE_EVIDENCE,
  },
  {
    id: 'reels_vertical',
    label: 'preset.reels_vertical',
    aspectRatio: '9:16',
    targetResolution: null,
    videoCodec: 'h264',
    audioCodec: 'aac',
    container: 'mp4',
    maxDurationSeconds: null,
    maxFileSizeBytes: null,
    status: 'partially_verified',
    evidence: PIPELINE_EVIDENCE,
  },
  {
    id: 'shorts_vertical',
    label: 'preset.shorts_vertical',
    aspectRatio: '9:16',
    targetResolution: null,
    videoCodec: 'h264',
    audioCodec: 'aac',
    container: 'mp4',
    maxDurationSeconds: null,
    maxFileSizeBytes: null,
    status: 'partially_verified',
    evidence: PIPELINE_EVIDENCE,
  },
  {
    id: 'square',
    label: 'preset.square',
    aspectRatio: '1:1',
    targetResolution: null,
    videoCodec: 'h264',
    audioCodec: 'aac',
    container: 'mp4',
    maxDurationSeconds: null,
    maxFileSizeBytes: null,
    status: 'partially_verified',
    evidence: PIPELINE_EVIDENCE,
  },
  {
    id: 'landscape',
    label: 'preset.landscape',
    aspectRatio: '16:9',
    targetResolution: null,
    videoCodec: 'h264',
    audioCodec: 'aac',
    container: 'mp4',
    maxDurationSeconds: null,
    maxFileSizeBytes: null,
    status: 'partially_verified',
    evidence: PIPELINE_EVIDENCE,
  },
];

export function findPreset(id: string): ExportPreset | null {
  return EXPORT_PRESETS.find((p) => p.id === id) ?? null;
}

/**
 * Preset chi duoc khai `verified` khi MOI thanh phan deu co bang chung. Hien khong preset nao
 * dat muc do, vi phan tuan thu nen tang chua do duoc. Ham nay ton tai de test chan dieu do.
 */
export function presetClaimsMoreThanEvidence(preset: ExportPreset): boolean {
  if (preset.status !== 'verified') return false;
  // `verified` doi HAI dieu: co tro toi bang chung, VA khong con truong nao la `null` (chua do).
  return preset.evidence === null || preset.maxDurationSeconds === null || preset.maxFileSizeBytes === null;
}
