/**
 * `P5-MCP-51` tren TEP THAT.
 *
 * Bo test o contract kiem LUAT doi chieu. Bo nay kiem BO DOC: no co thuc su doc duoc truong tu byte
 * hay khong. Hai viec khac han — mot luat doi chieu hoan hao tren mot bo doc luon tra rong se cho
 * ket qua "khong mat gi" cho MOI tep.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareMetadata } from '@mediaclear/contracts';
import { snapshotMetadata, READABLE_EXIF_KEYS } from '../src/media/metadata-snapshot.js';
import { ffmpegAvailable } from '../src/media/ffmpeg.js';

const hasFfmpeg = await ffmpegAvailable();
const fixture = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(join(import.meta.dirname, 'fixtures/media', name)));

describe('P5-MCP-51 — doc thong tin kem theo tu BYTE THAT', () => {
  it('ANH co mo ta/thiet bi: doc duoc DUNG gia tri, khong phai chi "co/khong"', async () => {
    const s = await snapshotMetadata(fixture('image-with-metadata.jpg'), 'image');
    expect(s.readable).toBe(true);
    const get = (k: string) => s.fields.find((f) => f.key === k)?.value;
    expect(get('exif.ImageDescription')).toBe('anh mau MediaClear');
    expect(get('exif.Make')).toBe('MatBao');
    expect(get('exif.Model')).toBe('TestCam');
    expect(get('image.width')).toBe(160);
  });

  it('ANH khong metadata: cac the EXIF la `null` — va day la ket luan DO DUOC', async () => {
    const s = await snapshotMetadata(fixture('image-no-metadata.jpg'), 'image');
    expect(s.readable, 'khong co EXIF KHAC voi khong doc duoc').toBe(true);
    for (const key of READABLE_EXIF_KEYS) {
      expect(s.fields.find((f) => f.key === key)?.value, `${key} phai duoc ghi nhan la khong co`).toBeNull();
    }
  });

  it('tep HONG: `readable: false` — mot phep do that bai, KHONG phai anh chup rong', async () => {
    const s = await snapshotMetadata(fixture('corrupt.png'), 'image');
    expect(s.readable).toBe(false);
  });

  it.skipIf(!hasFfmpeg)('VIDEO co the: doc duoc tieu de, mo ta va VI TRI', async () => {
    const s = await snapshotMetadata(fixture('video-with-metadata.mp4'), 'video');
    expect(s.readable).toBe(true);
    const get = (k: string) => s.fields.find((f) => f.key === k)?.value;
    expect(get('tag.title')).toBe('video mau MediaClear');
    expect(get('tag.comment')).toBe('fixture co tag');
    expect(get('tag.location'), 'khong doc duoc vi tri thi khong the thi hanh chinh sach go bo').toBeTruthy();
    expect(get('video.width')).toBe(64);
  });

  it.skipIf(!hasFfmpeg)('VIDEO khong the: cac the la `null`, khong phai thieu truong', async () => {
    const s = await snapshotMetadata(fixture('video-no-metadata.mp4'), 'video');
    expect(s.readable).toBe(true);
    expect(s.fields.find((f) => f.key === 'tag.title')?.value).toBeNull();
    expect(s.fields.find((f) => f.key === 'tag.location')?.value).toBeNull();
  });

  /**
   * DOI CHUNG TREN TEP THAT: go vi tri khoi video co vi tri, va kiem rang he thong goi dung ten
   * cua viec do — `removed_by_policy`, khong phai `removed`, va khong phai `preserved`.
   */
  /**
   * `Q-P5-02`. He thong hien KHONG go truong nao (guardrail 6/7 cam ket giu nguyen thong tin goc).
   * Nen mot truong vi tri bien mat phai duoc goi dung ten la MAT MAT, khong phai "dung y do".
   */
  it.skipIf(!hasFfmpeg)('VI TRI bien mat giua hai tep that => `removed`, khong duoc che thanh "dung y do"', async () => {
    const truoc = await snapshotMetadata(fixture('video-with-metadata.mp4'), 'video');
    const sau = await snapshotMetadata(fixture('video-no-metadata.mp4'), 'video');
    const r = compareMetadata(truoc, sau);

    expect(r.fields.find((x) => x.key === 'tag.location')!.status).toBe('removed');
    expect(r.fields.find((x) => x.key === 'tag.title')!.status).toBe('removed');
    expect(r.strippedCategories, 'nhan cong mot viec he thong khong lam').toEqual([]);
    expect(r.verdict).toBe('changed');
  });

  it.skipIf(!hasFfmpeg)('KHI owner bat go vi tri: cung du lieu do duoc goi ten khac han', async () => {
    const truoc = await snapshotMetadata(fixture('video-with-metadata.mp4'), 'video');
    const sau = await snapshotMetadata(fixture('video-no-metadata.mp4'), 'video');
    const r = compareMetadata(truoc, sau, ['location']);
    expect(r.fields.find((x) => x.key === 'tag.location')!.status).toBe('removed_by_policy');
    // Tieu de KHONG thuoc nhom duoc go => van la mat mat.
    expect(r.fields.find((x) => x.key === 'tag.title')!.status).toBe('removed');
  });

  it.skipIf(!hasFfmpeg)('DOI CHUNG AM: tep khong doi thi KHONG truong nao bi bao la mat', async () => {
    const s = await snapshotMetadata(fixture('video-with-metadata.mp4'), 'video');
    const r = compareMetadata(s, s);
    expect(r.verdict, 'bo doc khong tat dinh => moi ket luan deu vo nghia').toBe('preserved');
    expect(r.counts.removed).toBe(0);
    expect(r.counts.changed).toBe(0);
  });
});
