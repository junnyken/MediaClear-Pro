import { describe, expect, it } from 'vitest';
import { MEDIA_LIMITS, validateMedia, type MediaProbe } from '../src/media-limits.js';

const baseVideo: MediaProbe = {
  mediaType: 'video',
  mimeType: 'video/mp4',
  byteSize: 10_000_000,
  durationSeconds: 59,
  widthPx: 1080,
  heightPx: 1920,
  corrupt: false,
};

const baseImage: MediaProbe = {
  mediaType: 'image',
  mimeType: 'image/jpeg',
  byteSize: 1_000_000,
  durationSeconds: null,
  widthPx: 1080,
  heightPx: 1080,
  corrupt: false,
};

const codes = (p: MediaProbe) => validateMedia(p).errors.map((e) => e.code);

describe('MCP-03 media limits - bien gioi han', () => {
  it('video 599.9s hop le, 600s va 600.1s bi tu choi (DUOI 10 phut)', () => {
    expect(validateMedia({ ...baseVideo, durationSeconds: 599.9 }).valid).toBe(true);
    expect(codes({ ...baseVideo, durationSeconds: 600 })).toContain('MCP_VAL_DURATION_EXCEEDED');
    expect(codes({ ...baseVideo, durationSeconds: 600.1 })).toContain('MCP_VAL_DURATION_EXCEEDED');
  });

  it('file 209_715_199 bytes hop le, 209_715_200 bytes bi tu choi (DUOI 200 MB)', () => {
    expect(validateMedia({ ...baseVideo, byteSize: 209_715_199 }).valid).toBe(true);
    expect(codes({ ...baseVideo, byteSize: MEDIA_LIMITS.maxFileBytesExclusive })).toContain(
      'MCP_VAL_FILE_TOO_LARGE',
    );
  });

  it('duration null => KHONG pass, bao unknown chu khong doan', () => {
    const result = validateMedia({ ...baseVideo, durationSeconds: null });
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain('MCP_VAL_DURATION_UNKNOWN');
  });

  it('file rong va file hong bi tu choi', () => {
    expect(codes({ ...baseVideo, byteSize: 0 })).toContain('MCP_VAL_EMPTY_FILE');
    expect(codes({ ...baseVideo, corrupt: true })).toContain('MCP_VAL_CORRUPT_MEDIA');
  });

  it('format ngoai allowlist bi tu choi cho ca anh va video', () => {
    expect(codes({ ...baseVideo, mimeType: 'video/x-matroska' })).toContain(
      'MCP_VAL_UNSUPPORTED_FORMAT',
    );
    expect(codes({ ...baseImage, mimeType: 'image/gif' })).toContain('MCP_VAL_UNSUPPORTED_FORMAT');
  });

  it('kich thuoc anh: qua lon, qua nho, va khong do duoc', () => {
    expect(codes({ ...baseImage, widthPx: 8001, heightPx: 100 })).toContain(
      'MCP_VAL_DIMENSION_EXCEEDED',
    );
    expect(codes({ ...baseImage, widthPx: 63, heightPx: 63 })).toContain(
      'MCP_VAL_DIMENSION_TOO_SMALL',
    );
    expect(codes({ ...baseImage, widthPx: null, heightPx: null })).toContain(
      'MCP_VAL_DIMENSION_UNKNOWN',
    );
  });

  it('tra ve TAT CA loi, khong dung o loi dau tien', () => {
    const result = validateMedia({
      ...baseVideo,
      byteSize: 0,
      durationSeconds: 900,
      mimeType: 'video/avi',
    });
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
