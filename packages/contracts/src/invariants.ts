/**
 * MediaClear Pro - Invariant registry (MCP-08).
 *
 * Moi invariant o day PHAI co it nhat mot regression test trong tests/invariants.test.ts.
 * Danh sach nay la nguon su that duy nhat cho docs/TEST_STRATEGY.md.
 */
import { ERROR_CODES, apiError, type ApiError } from './errors.js';
import type { OutputAsset, SourceFile } from './entities.js';

export const INVARIANTS = {
  'I-1': 'File goc khong bao gio bi ghi de; output luon la ban moi co lien ket toi source.',
  'I-2': "Job chi 'completed' khi output ton tai VA da verified.",
  'I-3': "Job 'blocked' khong bao gio duoc submit provider job.",
  'I-4': 'Rights confirmation chi la user attestation, khong phai bang chung so huu.',
  'I-5': 'Preview khong lam mat metadata goc (preview khong ghi vao SourceFile).',
  'I-6': 'Provider failure khong bao gio duoc tinh nhu success.',
  'I-7': 'Retry khong bao gio double-charge.',
  'I-8': 'Preserve original metadata + preserve AI provenance mac dinh ON, MVP khong tat duoc.',
} as const;

export type InvariantId = keyof typeof INVARIANTS;

/** I-1: chan moi kha nang output ghi de len file goc. */
export function assertOutputDoesNotOverwriteSource(
  source: Pick<SourceFile, 'id' | 'storageKey'>,
  output: Pick<OutputAsset, 'storageKey' | 'sourceAssetId'>,
): { ok: boolean; error: ApiError | null } {
  if (output.storageKey === source.storageKey) {
    return { ok: false, error: apiError(ERROR_CODES.MCP_STATE_INVALID_TRANSITION, { reason: 'output_overwrites_source' }) };
  }
  if (!output.sourceAssetId) {
    return { ok: false, error: apiError(ERROR_CODES.MCP_STATE_INVALID_TRANSITION, { reason: 'output_missing_source_link' }) };
  }
  return { ok: true, error: null };
}
