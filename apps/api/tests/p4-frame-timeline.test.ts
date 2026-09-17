/**
 * MCP-40 — timeline frame that.
 *
 * Phep kiem quan trong nhat o day la phep DOI CHIEU DOC LAP: so frame cua module duoc so voi mot
 * lan goi `ffprobe` RIENG trong test. Neu test chi hoi chinh module roi so voi chinh no thi no chi
 * chung minh module nhat quan voi ban than, khong chung minh no dung.
 */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readFrameTimeline } from '../src/media/frame-timeline.js';
import { ffmpegAvailable } from '../src/media/ffmpeg.js';

const FIXTURES = join(import.meta.dirname, 'fixtures/media');
const f = (name: string): string => join(FIXTURES, name);
const hasFfmpeg = await ffmpegAvailable();

/** Goi ffprobe TRUC TIEP trong test — cong cu doc lap, khong di qua ma cua repo. */
function probeIndependently(path: string, entries: string): string {
  return execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames',
    '-show_entries', entries, '-of', 'csv=p=0', path], { encoding: 'utf8' }).trim();
}

describe.skipIf(!hasFfmpeg)('MCP-40 — timeline frame', () => {
  it('frame rate CO DINH: tong so frame khop voi cong cu decode doc lap', async () => {
    const t = await readFrameTimeline(f('video-24fps.mp4'));
    const doc_lap = Number(probeIndependently(f('video-24fps.mp4'), 'stream=nb_read_frames'));
    expect(t.decodedFrameCount).toBe(doc_lap);
    expect(t.frames).toHaveLength(doc_lap);
    expect(t.variableFrameRate).toBe(false);
    expect(t.fps).toBeCloseTo(24, 1);
  });

  it('frame rate BIEN DOI: khong tinh sai timestamp, va khong suy so frame tu duration × fps', async () => {
    const t = await readFrameTimeline(f('video-vfr.mp4'));
    expect(t.variableFrameRate, 'khong nhan ra VFR').toBe(true);

    const doc_lap = Number(probeIndependently(f('video-vfr.mp4'), 'stream=nb_read_frames'));
    expect(t.decodedFrameCount).toBe(doc_lap);

    /*
     * DAY la ly do phai DEM chu khong duoc suy: `r_frame_rate` danh nghia la 10, thoi luong ~2s,
     * nen `duration × fps` cho ~20 frame — trong khi su that la 26. Lay con so suy ra lam "so
     * frame ky vong" thi bat bien "khong bo sot frame nao" mat het y nghia.
     */
    const suyRa = Math.round(2 * 10);
    expect(t.expectedFrameCount).not.toBe(suyRa);
    expect(t.expectedFrameCount).toBeGreaterThan(suyRa);

    // Timestamp phai tang dan va co that, khong phai `index / fps` deu tap.
    const ts = t.frames.map((x) => x.ptsSeconds).filter((x): x is number => x !== null);
    expect(ts.length).toBe(t.frames.length);
    for (let i = 1; i < ts.length; i += 1) expect(ts[i]!).toBeGreaterThanOrEqual(ts[i - 1]!);
    const deltas = ts.slice(1).map((v, i) => Number((v - ts[i]!).toFixed(4)));
    expect(new Set(deltas).size, 'VFR ma moi khoang cach deu bang nhau => dang doc frame rate gia dinh').toBeGreaterThan(1);
  });

  it('frame HONG o giua: duoc GHI NHAN, khong bi bo qua khoi tong so', async () => {
    const t = await readFrameTimeline(f('video-corrupt-frame.mp4'));

    // Container khai 10, giai ma duoc 9 — chenh lech chinh la frame hong.
    expect(t.declaredFrameCount).toBe(10);
    expect(t.decodedFrameCount).toBe(9);
    expect(t.undecodableFrames, 'frame hong bien mat khoi tong so').toBe(1);

    /*
     * Va `expectedFrameCount` phai lay so KHAI, khong lay so giai ma duoc. Neu lay so giai ma,
     * frame hong tu dong "khong ton tai" va khong con gi de bao.
     */
    expect(t.expectedFrameCount).toBe(10);
  });

  it('video rat ngan (duoi 1 giay) van co timeline dung', async () => {
    const t = await readFrameTimeline(f('video-tiny.mp4'));
    const doc_lap = Number(probeIndependently(f('video-tiny.mp4'), 'stream=nb_read_frames'));
    expect(t.decodedFrameCount).toBe(doc_lap);
    expect(t.decodedFrameCount).toBeGreaterThan(0);
    expect(t.frames).toHaveLength(doc_lap);
  });

  it('60fps va 24fps deu doc dung frame rate that — khong gia dinh 30fps', async () => {
    expect((await readFrameTimeline(f('video-60fps.mp4'))).fps).toBeCloseTo(60, 1);
    expect((await readFrameTimeline(f('video-24fps.mp4'))).fps).toBeCloseTo(24, 1);
  });

  it('doc timeline KHONG ghi gi vao tep goc (bat bien I-1)', async () => {
    const { statSync, readFileSync } = await import('node:fs');
    const path = f('video-with-audio.mp4');
    const before = { size: statSync(path).size, mtime: statSync(path).mtimeMs };
    const bytesBefore = readFileSync(path);
    await readFrameTimeline(path);
    expect(statSync(path).size).toBe(before.size);
    expect(statSync(path).mtimeMs).toBe(before.mtime);
    expect(readFileSync(path).equals(bytesBefore)).toBe(true);
  });

  it('tep khong doc duoc thi NEM LOI, khong tra timeline rong', async () => {
    // Timeline rong trong giong het "video khong co frame nao" — mot loi khai sai ve tep nguoi dung.
    await expect(readFrameTimeline(f('empty.bin'))).rejects.toBeDefined();
  });
});
