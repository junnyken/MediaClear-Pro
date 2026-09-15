/**
 * MediaClear Pro - Invariant registry (MCP-08).
 *
 * Danh sach nay khop 1-1 voi muc "Regression tests" trong owner decisions prompt
 * (2026-09-15). Moi invariant PHAI co it nhat mot test trong tests/invariants.test.ts.
 * Day la nguon su that duy nhat cho docs/TEST_STRATEGY.md.
 */
import { ERROR_CODES, apiError, type ApiError } from './errors.js';
import type { OutputAsset, SourceFile } from './entities.js';

export const INVARIANTS = {
  'I-1': 'Original source asset khong bao gio bi ghi de; output luon la ban moi co link toi source.',
  'I-2': "Job chi 'completed' khi output ton tai VA da verified.",
  'I-3': "Job 'blocked' khong bao gio duoc submit provider job.",
  'I-4': "Job 'blocked' khong bao gio quay lai 'processing'; go block phai tao job moi.",
  'I-5': 'Rights attestation khong bao gio duoc suy dien tu workspace membership hay role.',
  'I-6': 'Viewer khong bao gio tao duoc processing job.',
  'I-7': 'Provider failure khong bao gio duoc tinh nhu success.',
  'I-8': 'Retry khong bao gio double-charge.',
  'I-9': 'Preserve original metadata + preserve AI provenance mac dinh ON, MVP khong tat duoc.',
  'I-10': 'Job/asset ngoai workspace khong bao gio lo su ton tai ra ngoai policy cho phep.',
  'I-11': 'JobState.blocked va EvidenceStatus.blocked khong bao gio bi dung lan nghia.',
  'I-12': 'Preview khong bao gio bi tinh vao video-minute usage.',
} as const;

export type InvariantId = keyof typeof INVARIANTS;

/** I-1: chan moi kha nang output ghi de len file goc. */
export function assertOutputDoesNotOverwriteSource(
  source: Pick<SourceFile, 'id' | 'storageKey'>,
  output: Pick<OutputAsset, 'storageKey' | 'sourceAssetId'>,
): { ok: boolean; error: ApiError | null } {
  if (output.storageKey === source.storageKey) {
    return {
      ok: false,
      error: apiError(ERROR_CODES.MCP_STATE_INVALID_TRANSITION, { reason: 'output_overwrites_source' }),
    };
  }
  if (!output.sourceAssetId) {
    return {
      ok: false,
      error: apiError(ERROR_CODES.MCP_STATE_INVALID_TRANSITION, { reason: 'output_missing_source_link' }),
    };
  }
  return { ok: true, error: null };
}
