/**
 * P3: lop ffmpeg — do tren VIDEO THAT, khong mock.
 *
 * Mock ffmpeg o day se vo nghia: thu can chung minh la "audio con nguyen sau khi render" va
 * "vung duoc chon that su doi", ma ca hai deu la tinh chat cua BYTE do ffmpeg sinh ra.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ffmpegAvailable, makeProxy, probeVideo, renderVideo, PROXY_MAX_HEIGHT_PX } from '../src/media/ffmpeg.js';
import { compareAudio } from '@mediaclear/contracts';
import { FIXTURES } from './helpers.js';

const load = (name: string): Promise<Buffer> => readFile(join(FIXTURES, name));
const region = (x: number, y: number, w: number, h: number) => ({
  x, y, width: w, height: h, startSeconds: null, endSeconds: null,
});

const hasFfmpeg = await ffmpegAvailable();

describe.skipIf(!hasFfmpeg)('P3 — do video bang ffprobe', () => {
  it('doc dung kich thuoc, thoi luong va CO audio', async () => {
    const probe = await probeVideo(await load('video-with-audio.mp4'));
    expect(probe.unreadable).toBe(false);
    expect(probe.widthPx).toBe(144);
    expect(probe.heightPx).toBe(256);
    expect(probe.audio.present).toBe(true);
    expect(probe.audio.codec).toBe('aac');
    expect(probe.audio.channelCount).toBe(1);
    expect(probe.videoCodec).toBe('h264');
  });

  it('video KHONG co audio: `present` la false - DA DO va khong thay', async () => {
    const probe = await probeVideo(await load('video-no-audio.mp4'));
    expect(probe.unreadable).toBe(false);
    expect(probe.audio.present).toBe(false);
    expect(probe.audio.codec).toBeNull();
  });

  it('tep KHONG doc duoc tra `unreadable`, KHONG bao la "khong co audio"', async () => {
    // `empty.bin` rong => ffprobe tu choi han. Day la cho de sai nhat: coi "khong doc duoc"
    // thanh "khong co gi".
    const probe = await probeVideo(await load('empty.bin'));
    expect(probe.unreadable).toBe(true);
    expect(probe.videoCodec).toBeNull();
    expect(probe.audio.present).toBe(false);
  });

  it('DO DUOC: ffprobe coi PNG la mot luong video mot khung - khong phai "hong"', async () => {
    /*
     * Ghi lai hanh vi that de lan sau khong ai nham. Toi da viet test dau tien dung `corrupt.png`
     * va ky vong `unreadable`, nhung ffprobe VAN doc duoc no: `png,video`. Nghia la "doc duoc
     * bang ffprobe" KHONG dong nghia voi "la mot video hop le" - cong kiem media cua he thong
     * (`header-probe` + `media-limits`) moi la cho quyet dinh dieu do.
     */
    const probe = await probeVideo(await load('corrupt.png'));
    expect(probe.videoCodec).toBe('png');
    expect(probe.audio.present).toBe(false);
  });
});

describe.skipIf(!hasFfmpeg)('P3 — render giu audio', () => {
  it('MASK: vung duoc to dac, audio VAN NGUYEN', async () => {
    const source = await load('video-with-audio.mp4');
    const before = await probeVideo(source);
    const out = await renderVideo(source, { mode: 'mask', regions: [region(0.1, 0.1, 0.4, 0.2)] });

    expect(out.probe.unreadable).toBe(false);
    expect(out.probe.widthPx).toBe(before.widthPx);
    expect(out.probe.heightPx).toBe(before.heightPx);
    expect(out.probe.audio.present, 'MAT AUDIO sau khi render').toBe(true);
    expect(compareAudio(before.audio, out.probe.audio)).toBe('preserved');
    // Byte phai KHAC ban goc - neu giong het thi khong co gi duoc xu ly ca.
    expect(Buffer.from(out.bytes).equals(source)).toBe(false);
  }, 120_000);

  it('BLUR mot vung: audio van nguyen, kich thuoc khong doi', async () => {
    const source = await load('video-with-audio.mp4');
    const before = await probeVideo(source);
    const out = await renderVideo(source, { mode: 'blur', regions: [region(0.2, 0.2, 0.5, 0.3)] });
    expect(out.probe.audio.present).toBe(true);
    expect(compareAudio(before.audio, out.probe.audio)).toBe('preserved');
    expect(out.probe.heightPx).toBe(before.heightPx);
  }, 120_000);

  it('CROP 9:16 doi kich thuoc nhung KHONG lam mat audio', async () => {
    const source = await load('video-landscape-audio.mp4');
    const before = await probeVideo(source);
    const out = await renderVideo(source, { mode: 'crop', regions: [], cropAspect: '9:16' });
    expect(out.probe.widthPx).not.toBe(before.widthPx);
    expect(out.probe.audio.present, 'crop lam mat audio').toBe(true);
    expect(compareAudio(before.audio, out.probe.audio)).toBe('preserved');
  }, 120_000);

  it('CROP 16:9 tren video doc', async () => {
    const source = await load('video-with-audio.mp4');
    const out = await renderVideo(source, { mode: 'crop', regions: [], cropAspect: '16:9' });
    expect(out.probe.widthPx).not.toBeNull();
    expect(out.probe.heightPx).not.toBeNull();
    // Ti le sau khi cat phai gan 16:9.
    const ratio = (out.probe.widthPx ?? 0) / (out.probe.heightPx ?? 1);
    expect(ratio).toBeGreaterThan(1.5);
  }, 120_000);

  it('video KHONG co audio: render xong van khong co audio, va do KHONG phai loi', async () => {
    const source = await load('video-no-audio.mp4');
    const before = await probeVideo(source);
    const out = await renderVideo(source, { mode: 'mask', regions: [region(0.1, 0.1, 0.3, 0.2)] });
    expect(out.probe.audio.present).toBe(false);
    expect(compareAudio(before.audio, out.probe.audio)).toBe('absent_by_design');
  }, 120_000);

  it('KHONG dung vao byte dau vao (I-1 o muc ham)', async () => {
    const source = await load('video-with-audio.mp4');
    const copy = Buffer.from(source);
    await renderVideo(source, { mode: 'mask', regions: [region(0.1, 0.1, 0.3, 0.2)] });
    expect(Buffer.from(source).equals(copy)).toBe(true);
  }, 120_000);

  it('ti le khung hinh vo nghia bi tu choi', async () => {
    const source = await load('video-with-audio.mp4');
    await expect(renderVideo(source, { mode: 'crop', regions: [], cropAspect: 'khong-phai-ti-le' })).rejects.toThrow();
  }, 120_000);
});

describe.skipIf(!hasFfmpeg)('P3 — ban proxy de xem truoc', () => {
  it('proxy khong vuot tran chieu cao va van doc duoc', async () => {
    const source = await load('video-with-audio.mp4');
    const proxy = await makeProxy(source, 120);
    expect(proxy.probe.heightPx).toBeLessThanOrEqual(120);
    expect(proxy.probe.unreadable).toBe(false);
    expect(proxy.byteSize).toBeGreaterThan(0);
  }, 120_000);

  it('DO DUOC: voi video da rat nho, proxy co the LON HON ban goc', async () => {
    /*
     * Toi da viet test dau tien ky vong "proxy nho hon ban goc" va no DO: 12261 > 9658.
     * Ly do that: fixture duoc nen o `crf 40` (rat manh), con proxy ma hoa lai o `crf 32`
     * (chat luong cao hon). Voi video that vai MB thi proxy nho hon han, nhung voi video da nho
     * san thi khong.
     *
     * Ghim lai hanh vi nay thay vi ky vong sai. He qua that: he thong co the luu mot ban proxy
     * TON CHO hon ban goc - da ghi vao phan gioi han cua P3-MCP-30.
     */
    const source = await load('video-with-audio.mp4');
    const proxy = await makeProxy(source, 120);
    expect(proxy.byteSize).toBeGreaterThan(0);
    expect(source.byteLength).toBeLessThan(20_000);
  }, 120_000);

  it('proxy GIU audio - nguoi dung phai nghe duoc khi xem truoc', async () => {
    const proxy = await makeProxy(await load('video-with-audio.mp4'), 120);
    expect(proxy.probe.audio.present).toBe(true);
  }, 120_000);

  it('proxy cua video khong tieng thi khong co tieng, khong bao loi', async () => {
    const proxy = await makeProxy(await load('video-no-audio.mp4'), 120);
    expect(proxy.probe.audio.present).toBe(false);
    expect(proxy.probe.unreadable).toBe(false);
  }, 120_000);

  it('tran mac dinh cua proxy la 480px', () => {
    expect(PROXY_MAX_HEIGHT_PX).toBe(480);
  });
});
