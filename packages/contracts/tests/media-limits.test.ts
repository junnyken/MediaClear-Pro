import { describe, expect, it } from 'vitest';
import {
  MAX_FILE_SIZE_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_HEIGHT,
  MAX_VIDEO_WIDTH,
} from '../src/config.js';
import { validateMedia, type MediaProbe } from '../src/media-limits.js';

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

describe('MCP-03 media limits - owner decision Q-03 (199 MB / 09:59 / 3840x3840)', () => {
  it('gioi han duoc lay tu config tap trung, khong hard-code', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(199 * 1024 * 1024);
    expect(MAX_VIDEO_DURATION_SECONDS).toBe(599);
    expect(MAX_VIDEO_WIDTH).toBe(3840);
    expect(MAX_VIDEO_HEIGHT).toBe(3840);
  });

  it('file size: duoi 199 MB hop le, dung 199 MB hop le, tren 199 MB bi tu choi', () => {
    expect(validateMedia({ ...baseVideo, byteSize: MAX_FILE_SIZE_BYTES - 1 }).valid).toBe(true);
    expect(validateMedia({ ...baseVideo, byteSize: MAX_FILE_SIZE_BYTES }).valid).toBe(true);
    expect(codes({ ...baseVideo, byteSize: MAX_FILE_SIZE_BYTES + 1 })).toContain(
      'MCP_VAL_FILE_TOO_LARGE',
    );
  });

  it('gioi han cu 200 MB KHONG con hieu luc o runtime', () => {
    expect(codes({ ...baseVideo, byteSize: 209_715_199 })).toContain('MCP_VAL_FILE_TOO_LARGE');
  });

  it('thoi luong: 09:59 (599s) duoc chap nhan, 10:00 (600s) bi tu choi', () => {
    expect(validateMedia({ ...baseVideo, durationSeconds: 599 }).valid).toBe(true);
    expect(validateMedia({ ...baseVideo, durationSeconds: 598.9 }).valid).toBe(true);
    expect(codes({ ...baseVideo, durationSeconds: 600 })).toContain('MCP_VAL_DURATION_EXCEEDED');
    expect(codes({ ...baseVideo, durationSeconds: 599.1 })).toContain('MCP_VAL_DURATION_EXCEEDED');
  });

  it('kich thuoc video: 3840 hop le, 3841 bi tu choi, phan biet width va height', () => {
    expect(validateMedia({ ...baseVideo, widthPx: 3840, heightPx: 3840 }).valid).toBe(true);
    const wide = codes({ ...baseVideo, widthPx: 3841, heightPx: 1080 });
    expect(wide).toContain('MCP_VAL_VIDEO_WIDTH_EXCEEDED');
    expect(wide).not.toContain('MCP_VAL_VIDEO_HEIGHT_EXCEEDED');
    const tall = codes({ ...baseVideo, widthPx: 1080, heightPx: 3841 });
    expect(tall).toContain('MCP_VAL_VIDEO_HEIGHT_EXCEEDED');
    expect(tall).not.toContain('MCP_VAL_VIDEO_WIDTH_EXCEEDED');
    const both = codes({ ...baseVideo, widthPx: 5000, heightPx: 5000 });
    expect(both).toContain('MCP_VAL_VIDEO_WIDTH_EXCEEDED');
    expect(both).toContain('MCP_VAL_VIDEO_HEIGHT_EXCEEDED');
  });

  it('duration/dimension null => KHONG pass, bao unknown chu khong doan', () => {
    expect(codes({ ...baseVideo, durationSeconds: null })).toContain('MCP_VAL_DURATION_UNKNOWN');
    expect(codes({ ...baseVideo, widthPx: null, heightPx: null })).toContain(
      'MCP_VAL_DIMENSION_UNKNOWN',
    );
  });

  it('file rong va file hong bi tu choi', () => {
    expect(codes({ ...baseVideo, byteSize: 0 })).toContain('MCP_VAL_EMPTY_FILE');
    expect(codes({ ...baseVideo, corrupt: true })).toContain('MCP_VAL_CORRUPT_MEDIA');
  });

  it('format: chi jpeg/png/webp cho anh va mp4/mov/webm cho video', () => {
    for (const mime of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(validateMedia({ ...baseImage, mimeType: mime }).valid).toBe(true);
    }
    for (const mime of ['video/mp4', 'video/quicktime', 'video/webm']) {
      expect(validateMedia({ ...baseVideo, mimeType: mime }).valid).toBe(true);
    }
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

  it('phan biet duoc 5 nhom loi trong cung mot lan validate', () => {
    const result = validateMedia({
      mediaType: 'video',
      mimeType: 'video/avi',
      byteSize: MAX_FILE_SIZE_BYTES + 1,
      durationSeconds: 900,
      widthPx: 4000,
      heightPx: 4000,
      corrupt: false,
    });
    const found = result.errors.map((e) => e.code);
    expect(found).toContain('MCP_VAL_UNSUPPORTED_FORMAT');
    expect(found).toContain('MCP_VAL_FILE_TOO_LARGE');
    expect(found).toContain('MCP_VAL_DURATION_EXCEEDED');
    expect(found).toContain('MCP_VAL_VIDEO_WIDTH_EXCEEDED');
    expect(found).toContain('MCP_VAL_VIDEO_HEIGHT_EXCEEDED');
  });
});
