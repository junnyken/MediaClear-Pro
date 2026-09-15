/**
 * MediaClear Pro - Preview contract (owner decision Q-03 + Q-10, 2026-09-15).
 *
 * Hai rang buoc cua owner:
 *  1. "Video preview phai co proxy-processing direction; khong thay doi source asset."
 *  2. "Preview khong tinh vao video-minute usage" va "khong tao nhieu provider jobs
 *     khong can thiet".
 */
import { PREVIEW_IS_BILLABLE } from './config.js';
import { requiresProvider } from './provider.js';
import type { CleanupOperation } from './vocabulary.js';

/** Preview LUON chay tren ban proxy (do phan giai thap), khong bao gio tren source. */
export const PREVIEW_MODE = 'proxy' as const;

/** Do phan giai toi da cua ban proxy dung cho preview video. */
export const PREVIEW_PROXY_MAX_HEIGHT_PX = 720;

export interface PreviewRequest {
  jobId: string;
  sourceFileId: string;
  operations: CleanupOperation[];
}

export interface PreviewPlan {
  mode: typeof PREVIEW_MODE;
  /** Luon false: preview khong bao gio ghi vao SourceFile (invariant I-1/I-5). */
  writesToSourceFile: false;
  /** Luon false theo owner decision Q-10. */
  billable: boolean;
  /**
   * So provider job toi da mot preview duoc phep tao.
   * - Thao tac deterministic (crop/blur/brand_overlay): 0 - khong can provider.
   * - Con lai: 1 (gop tat ca operation vao mot lan goi), khong bao gio > 1.
   */
  providerJobBudget: 0 | 1;
}

export function planPreview(request: PreviewRequest): PreviewPlan {
  const needsProvider = request.operations.some((op) => requiresProvider(op));
  return {
    mode: PREVIEW_MODE,
    writesToSourceFile: false,
    billable: PREVIEW_IS_BILLABLE,
    providerJobBudget: needsProvider ? 1 : 0,
  };
}
