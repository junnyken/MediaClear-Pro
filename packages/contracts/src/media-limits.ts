/**
 * MediaClear Pro - Media limits & validation contract (MCP-03).
 *
 * Gioi han theo prompt Phase 0: video DUOI 10 phut, file DUOI 200 MB.
 * "Duoi" = strict less-than: 600.0s va 209_715_200 bytes deu BI TU CHOI.
 */
import { ERROR_CODES, apiError, type ApiError } from './errors.js';
import type { MediaType } from './vocabulary.js';

export const MEDIA_LIMITS = {
  /** 200 MB = 200 * 1024 * 1024. Ap dung cho ca image va video. */
  maxFileBytesExclusive: 209_715_200,
  video: {
    /** 10 phut. Strict: duration < 600 moi hop le. */
    maxDurationSecondsExclusive: 600,
    allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'] as const,
  },
  image: {
    maxDimensionPxInclusive: 8000,
    minDimensionPxInclusive: 64,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
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

const IMAGE_MIMES: readonly string[] = MEDIA_LIMITS.image.allowedMimeTypes;
const VIDEO_MIMES: readonly string[] = MEDIA_LIMITS.video.allowedMimeTypes;

/**
 * Validate mot file da upload. Thuan tuy (pure), khong I/O => test duoc truc tiep.
 * Tra ve TAT CA loi tim duoc, khong dung o loi dau tien.
 */
export function validateMedia(probe: MediaProbe): ValidationResult {
  const errors: ApiError[] = [];

  if (probe.corrupt) {
    errors.push(apiError(ERROR_CODES.MCP_VAL_CORRUPT_MEDIA));
  }
  if (probe.byteSize <= 0) {
    errors.push(apiError(ERROR_CODES.MCP_VAL_EMPTY_FILE));
  }
  if (probe.byteSize >= MEDIA_LIMITS.maxFileBytesExclusive) {
    errors.push(
      apiError(ERROR_CODES.MCP_VAL_FILE_TOO_LARGE, {
        limitBytes: MEDIA_LIMITS.maxFileBytesExclusive,
      }),
    );
  }

  const allowed = probe.mediaType === 'image' ? IMAGE_MIMES : VIDEO_MIMES;
  if (!allowed.includes(probe.mimeType)) {
    errors.push(apiError(ERROR_CODES.MCP_VAL_UNSUPPORTED_FORMAT, { mimeType: probe.mimeType }));
  }

  if (probe.mediaType === 'video') {
    if (probe.durationSeconds === null) {
      // Thieu bang chung => khong pass, bao unknown (guardrail 10).
      errors.push(apiError(ERROR_CODES.MCP_VAL_DURATION_UNKNOWN));
    } else if (probe.durationSeconds >= MEDIA_LIMITS.video.maxDurationSecondsExclusive) {
      errors.push(
        apiError(ERROR_CODES.MCP_VAL_DURATION_EXCEEDED, {
          limitSeconds: MEDIA_LIMITS.video.maxDurationSecondsExclusive,
        }),
      );
    }
  }

  if (probe.mediaType === 'image') {
    if (probe.widthPx === null || probe.heightPx === null) {
      errors.push(apiError(ERROR_CODES.MCP_VAL_DIMENSION_UNKNOWN));
    } else {
      const maxSide = Math.max(probe.widthPx, probe.heightPx);
      const minSide = Math.min(probe.widthPx, probe.heightPx);
      if (maxSide > MEDIA_LIMITS.image.maxDimensionPxInclusive) {
        errors.push(
          apiError(ERROR_CODES.MCP_VAL_DIMENSION_EXCEEDED, {
            limitPx: MEDIA_LIMITS.image.maxDimensionPxInclusive,
          }),
        );
      }
      if (minSide < MEDIA_LIMITS.image.minDimensionPxInclusive) {
        errors.push(
          apiError(ERROR_CODES.MCP_VAL_DIMENSION_TOO_SMALL, {
            limitPx: MEDIA_LIMITS.image.minDimensionPxInclusive,
          }),
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
