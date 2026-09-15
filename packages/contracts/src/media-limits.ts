/**
 * MediaClear Pro - Media limits & validation contract (MCP-03).
 *
 * Owner decision Q-03 (2026-09-15): 199 MB, 09:59, video toi da 3840x3840.
 * MOI gia tri gioi han doc tu src/config.ts - khong hard-code lai o day.
 *
 * Bien: cac gioi han la INCLUSIVE ("maximum" = gia tri lon nhat con hop le).
 *   - 199 MB dung bang     -> HOP LE; lon hon 1 byte -> tu choi.
 *   - 599 giay (09:59)     -> HOP LE; 600 giay (10:00) -> tu choi.
 *   - 3840 px              -> HOP LE; 3841 px -> tu choi.
 */
import {
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGE_DIMENSION_PX,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_HEIGHT,
  MAX_VIDEO_WIDTH,
  MIN_IMAGE_DIMENSION_PX,
  SUPPORTED_IMAGE_FORMATS,
  SUPPORTED_VIDEO_FORMATS,
} from './config.js';
import { ERROR_CODES, apiError, type ApiError } from './errors.js';
import type { MediaType } from './vocabulary.js';

/** View gon cua config, danh cho UI/docs doc lai. Khong dinh nghia so moi o day. */
export const MEDIA_LIMITS = {
  maxFileBytesInclusive: MAX_FILE_SIZE_BYTES,
  video: {
    maxDurationSecondsInclusive: MAX_VIDEO_DURATION_SECONDS,
    maxWidthPxInclusive: MAX_VIDEO_WIDTH,
    maxHeightPxInclusive: MAX_VIDEO_HEIGHT,
    allowedMimeTypes: SUPPORTED_VIDEO_FORMATS,
  },
  image: {
    maxDimensionPxInclusive: MAX_IMAGE_DIMENSION_PX,
    minDimensionPxInclusive: MIN_IMAGE_DIMENSION_PX,
    allowedMimeTypes: SUPPORTED_IMAGE_FORMATS,
  },
} as const;

export interface MediaProbe {
  mediaType: MediaType;
  mimeType: string;
  byteSize: number;
  /** null = chua probe duoc. KHONG duoc coi null la hop le (guardrail 10). */
  durationSeconds: number | null;
  widthPx: number | null;
  heightPx: number | null;
  /** true neu file khong doc duoc/hong. */
  corrupt: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: ApiError[];
}

const IMAGE_MIMES: readonly string[] = SUPPORTED_IMAGE_FORMATS;
const VIDEO_MIMES: readonly string[] = SUPPORTED_VIDEO_FORMATS;

/**
 * Validate mot file da upload. Thuan tuy (pure), khong I/O => test duoc truc tiep.
 * Tra ve TAT CA loi tim duoc, khong dung o loi dau tien, va phan biet ro
 * format / file size / duration / width / height (yeu cau Q-03).
 */
export function validateMedia(probe: MediaProbe): ValidationResult {
  const errors: ApiError[] = [];

  if (probe.corrupt) {
    errors.push(apiError(ERROR_CODES.MCP_VAL_CORRUPT_MEDIA));
  }
  if (probe.byteSize <= 0) {
    errors.push(apiError(ERROR_CODES.MCP_VAL_EMPTY_FILE));
  }
  if (probe.byteSize > MAX_FILE_SIZE_BYTES) {
    errors.push(apiError(ERROR_CODES.MCP_VAL_FILE_TOO_LARGE, { limitBytes: MAX_FILE_SIZE_BYTES }));
  }

  const allowed = probe.mediaType === 'image' ? IMAGE_MIMES : VIDEO_MIMES;
  if (!allowed.includes(probe.mimeType)) {
    errors.push(apiError(ERROR_CODES.MCP_VAL_UNSUPPORTED_FORMAT, { mimeType: probe.mimeType }));
  }

  if (probe.mediaType === 'video') {
    if (probe.durationSeconds === null) {
      // Thieu bang chung => khong pass, bao unknown (guardrail 10).
      errors.push(apiError(ERROR_CODES.MCP_VAL_DURATION_UNKNOWN));
    } else if (probe.durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
      errors.push(
        apiError(ERROR_CODES.MCP_VAL_DURATION_EXCEEDED, {
          limitSeconds: MAX_VIDEO_DURATION_SECONDS,
        }),
      );
    }

    if (probe.widthPx === null || probe.heightPx === null) {
      errors.push(apiError(ERROR_CODES.MCP_VAL_DIMENSION_UNKNOWN));
    } else {
      if (probe.widthPx > MAX_VIDEO_WIDTH) {
        errors.push(
          apiError(ERROR_CODES.MCP_VAL_VIDEO_WIDTH_EXCEEDED, { limitPx: MAX_VIDEO_WIDTH }),
        );
      }
      if (probe.heightPx > MAX_VIDEO_HEIGHT) {
        errors.push(
          apiError(ERROR_CODES.MCP_VAL_VIDEO_HEIGHT_EXCEEDED, { limitPx: MAX_VIDEO_HEIGHT }),
        );
      }
    }
  }

  if (probe.mediaType === 'image') {
    if (probe.widthPx === null || probe.heightPx === null) {
      errors.push(apiError(ERROR_CODES.MCP_VAL_DIMENSION_UNKNOWN));
    } else {
      const maxSide = Math.max(probe.widthPx, probe.heightPx);
      const minSide = Math.min(probe.widthPx, probe.heightPx);
      if (maxSide > MAX_IMAGE_DIMENSION_PX) {
        errors.push(
          apiError(ERROR_CODES.MCP_VAL_DIMENSION_EXCEEDED, { limitPx: MAX_IMAGE_DIMENSION_PX }),
        );
      }
      if (minSide < MIN_IMAGE_DIMENSION_PX) {
        errors.push(
          apiError(ERROR_CODES.MCP_VAL_DIMENSION_TOO_SMALL, { limitPx: MIN_IMAGE_DIMENSION_PX }),
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
