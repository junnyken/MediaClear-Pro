/**
 * MCP-12: probe doc so do THAT tu file THAT (fixture sinh bang ffmpeg/PIL).
 * Gia tri ky vong lay tu ffprobe - doi chung ngoai, khong phai tu chinh parser.
 */
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileSource } from '../src/media/byte-source.js';
import { HeaderMediaProbe } from '../src/media/header-probe.js';

const FIXTURES = join(import.meta.dirname, 'fixtures/media');
const probe = new HeaderMediaProbe();

async function probeFile(name: string) {
  const source = await fileSource(join(FIXTURES, name));
  try {
    return await probe.probe(source);
  } finally {
    await source.close();
  }
}

describe('HeaderMediaProbe - anh', () => {
  it('PNG: doc dung kich thuoc that', async () => {
    const r = await probeFile('sample.png');
    expect(r.detectedMimeType).toBe('image/png');
    expect(r.mediaType).toBe('image');
    expect([r.widthPx, r.heightPx]).toEqual([200, 120]);
    expect(r.corrupt).toBe(false);
  });

  it('JPEG: doc dung kich thuoc that', async () => {
    const r = await probeFile('sample.jpg');
    expect(r.detectedMimeType).toBe('image/jpeg');
    expect([r.widthPx, r.heightPx]).toEqual([120, 80]);
  });

  it('WebP lossy (VP8) va lossless (VP8L) deu doc duoc', async () => {
    const lossy = await probeFile('sample-lossy.webp');
    expect(lossy.detectedMimeType).toBe('image/webp');
    expect([lossy.widthPx, lossy.heightPx]).toEqual([100, 50]);
    const lossless = await probeFile('sample-lossless.webp');
    expect([lossless.widthPx, lossless.heightPx]).toEqual([90, 70]);
  });

  it('file rong: khong nhan dang duoc va KHONG doan kieu media', async () => {
    const r = await probeFile('empty.bin');
    expect(r.detectedMimeType).toBeNull();
    expect(r.mediaType).toBeNull();
    expect(r.widthPx).toBeNull();
  });

  it('PNG hong: bao corrupt chu khong tra kich thuoc bia', async () => {
    const r = await probeFile('corrupt.png');
    expect(r.detectedMimeType).toBe('image/png');
    expect(r.corrupt).toBe(true);
    expect(r.widthPx).toBeNull();
  });

  it('duoi .jpg nhung byte la PNG: probe tra dung loai THAT (de bat mime mismatch)', async () => {
    const r = await probeFile('declared-jpeg-actually-png.jpg');
    expect(r.detectedMimeType).toBe('image/png');
  });
});

describe('HeaderMediaProbe - video', () => {
  it('MP4 co tieng: kich thuoc + thoi luong + co audio track', async () => {
    const r = await probeFile('sample-with-audio.mp4');
    expect(r.detectedMimeType).toBe('video/mp4');
    expect(r.mediaType).toBe('video');
    expect([r.widthPx, r.heightPx]).toEqual([320, 240]);
    expect(r.durationSeconds).toBeCloseTo(2.0, 1);
    expect(r.hasAudioStream).toBe(true);
  });

  it('MP4 khong tieng: hasAudioStream = false (khong phai null)', async () => {
    const r = await probeFile('sample-noaudio.mp4');
    expect([r.widthPx, r.heightPx]).toEqual([64, 64]);
    expect(r.durationSeconds).toBeCloseTo(1.0, 1);
    expect(r.hasAudioStream).toBe(false);
  });

  it('MOV nhan dung video/quicktime', async () => {
    const r = await probeFile('sample.mov');
    expect(r.detectedMimeType).toBe('video/quicktime');
    expect([r.widthPx, r.heightPx]).toEqual([128, 96]);
  });

  it('WebM: doc duoc PixelWidth/Height va Duration', async () => {
    const r = await probeFile('sample.webm');
    expect(r.detectedMimeType).toBe('video/webm');
    expect([r.widthPx, r.heightPx]).toEqual([160, 120]);
    expect(r.durationSeconds).toBeCloseTo(2.003, 2);
    expect(r.hasAudioStream).toBe(true);
  });

  it('bien thoi luong tren file that: 599s va 600s doc dung tung giay', async () => {
    const ok = await probeFile('video-599s.mp4');
    const over = await probeFile('video-600s.mp4');
    expect(ok.durationSeconds).toBeCloseTo(599, 1);
    expect(over.durationSeconds).toBeCloseTo(600, 1);
  });

  it('bien chieu rong tren file that: 3840 va 3842', async () => {
    const ok = await probeFile('video-3840w.mp4');
    const over = await probeFile('video-3842w.mp4');
    expect(ok.widthPx).toBe(3840);
    expect(over.widthPx).toBe(3842);
  });
});
