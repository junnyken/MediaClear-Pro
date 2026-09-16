/**
 * P2-MCP-24: hop dong cua `ObjectStorageAdapter`.
 *
 * Viet MOT LAN, chay tren CA HAI adapter: local-fs va S3-compatible. O P2-MCP-23 cach nay
 * lap tuc lo ra ba khac biet ma test rieng cho adapter moi se khong bao gio thay - nen dung lai.
 *
 * Adapter S3 chi chay khi co MEDIACLEAR_TEST_S3_ENDPOINT. Thieu thi so test GIAM THAY DUOC,
 * khong im lang xanh.
 */
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it, beforeEach } from 'vitest';
import { ERROR_CODES, storageKeyFor, type ObjectStorageAdapter } from '@mediaclear/contracts';
import { LocalFsStorageAdapter, StorageError } from '../src/storage/local-fs-adapter.js';
import { S3CompatibleStorageAdapter } from '../src/storage/s3-adapter.js';

const S3_ENDPOINT = process.env.MEDIACLEAR_TEST_S3_ENDPOINT;
const BUCKET = 'mediaclear-test';
const SECRET = 'test-signing-secret-not-committed';
const BASE_URL = 'http://localhost:3001';

const WS = 'wsp_kho';
const bytes = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, 'utf8'));
const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex');

/** Khoa that theo dung chien luoc cua he thong, khong phai khoa bia cho de test. */
function sourceKey(id: string): string {
  return storageKeyFor(WS, 'source', id, '.png');
}
function outputKey(id: string): string {
  return storageKeyFor(WS, 'output', id, '.png');
}

function contractSuite(label: string, make: () => Promise<ObjectStorageAdapter>): void {
  describe(`ObjectStorageAdapter — ${label}`, () => {
    let storage: ObjectStorageAdapter;
    let uid: string;

    beforeEach(async () => {
      storage = await make();
      uid = randomUUID().replace(/-/g, '').slice(0, 16);
    });

    it('tu khai co phai adapter production khong', () => {
      expect(typeof storage.isProductionAdapter).toBe('boolean');
      expect(storage.id.length).toBeGreaterThan(0);
    });

    it('object chua ghi thi head bao khong ton tai, khong bia so', async () => {
      const head = await storage.head({ bucket: BUCKET, key: sourceKey(uid) });
      expect(head).toEqual({ exists: false, byteSize: null, checksumSha256: null });
    });

    it('ghi roi doc lai dung tung byte', async () => {
      const body = bytes('noi dung that cua tep');
      const ref = { bucket: BUCKET, key: outputKey(uid) };
      await storage.putObject(ref, body, 'image/png');
      const read = await storage.getObject(ref);
      expect(Buffer.from(read).equals(Buffer.from(body))).toBe(true);
    });

    it('head tra dung kich thuoc va checksum THAT', async () => {
      const body = bytes('do kich thuoc va checksum');
      const ref = { bucket: BUCKET, key: outputKey(uid) };
      await storage.putObject(ref, body, 'image/png');
      const head = await storage.head(ref);
      expect(head.exists).toBe(true);
      expect(head.byteSize).toBe(body.byteLength);
      expect(head.checksumSha256).toBe(sha(body));
    });

    it('giu nguyen content type da ghi', async () => {
      const ref = { bucket: BUCKET, key: outputKey(uid) };
      await storage.putObject(ref, bytes('x'), 'image/webp');
      expect(await storage.contentTypeOf(ref)).toBe('image/webp');
    });

    it('BAT BIEN I-1: ghi de object class `source` bi TU CHOI', async () => {
      const ref = { bucket: BUCKET, key: sourceKey(uid) };
      await storage.putObject(ref, bytes('ban goc'), 'image/png');
      await expect(storage.putObject(ref, bytes('ban de len'), 'image/png')).rejects.toThrow(
        StorageError,
      );
      // Va ban goc phai con NGUYEN VEN, khong bi sua mot phan.
      const read = await storage.getObject(ref);
      expect(Buffer.from(read).toString('utf8')).toBe('ban goc');
    });

    it('object class `output` thi duoc ghi de (khong phai ban goc)', async () => {
      const ref = { bucket: BUCKET, key: outputKey(uid) };
      await storage.putObject(ref, bytes('lan mot'), 'image/png');
      await storage.putObject(ref, bytes('lan hai'), 'image/png');
      expect(Buffer.from(await storage.getObject(ref)).toString('utf8')).toBe('lan hai');
    });

    it('doc object khong ton tai thi bao khong tim thay, khong tra byte rong', async () => {
      await expect(storage.getObject({ bucket: BUCKET, key: outputKey(uid) })).rejects.toThrow(
        StorageError,
      );
    });

    it('xoa roi thi head bao khong ton tai', async () => {
      const ref = { bucket: BUCKET, key: outputKey(uid) };
      await storage.putObject(ref, bytes('sap xoa'), 'image/png');
      expect((await storage.head(ref)).exists).toBe(true);
      await storage.deleteObject(ref);
      expect((await storage.head(ref)).exists).toBe(false);
    });

    it('CHAN THOAT THU MUC: khoa co `..` bi tu choi', async () => {
      await expect(
        storage.putObject({ bucket: BUCKET, key: '../../thoat-ra-ngoai.png' }, bytes('x'), 'image/png'),
      ).rejects.toThrow(StorageError);
    });

    it('URL upload/download tra ve co han dung va tro ve bien cua API', async () => {
      const ref = { bucket: BUCKET, key: sourceKey(uid) };
      const up = await storage.createUploadUrl({ ref, contentType: 'image/png', maxByteSize: 1000, ttlSeconds: 600 });
      expect(up.url.startsWith(`${BASE_URL}/v1/storage/upload/`)).toBe(true);
      expect(new Date(up.expiresAt).getTime()).toBeGreaterThan(Date.now());

      const down = await storage.createDownloadUrl(ref, 300);
      expect(down.url.startsWith(`${BASE_URL}/v1/storage/download/`)).toBe(true);
    });

    it('ticket khong dung cheo muc dich duoc', async () => {
      const ref = { bucket: BUCKET, key: sourceKey(uid) };
      const up = await storage.createUploadUrl({ ref, contentType: 'image/png', maxByteSize: 1000, ttlSeconds: 600 });
      const token = up.url.split('/').pop() as string;
      const asDownload = (storage as unknown as {
        verifyTicket: (t: string, u: 'upload' | 'download') => { ok: boolean; error?: { code: string } };
      }).verifyTicket(token, 'download');
      expect(asDownload.ok).toBe(false);
      expect(asDownload.error?.code).toBe(ERROR_CODES.MCP_STORAGE_UPLOAD_TICKET_INVALID);
    });

    it('ticket het han bi tu choi', async () => {
      const ref = { bucket: BUCKET, key: sourceKey(uid) };
      const up = await storage.createUploadUrl({ ref, contentType: 'image/png', maxByteSize: 1000, ttlSeconds: 1 });
      const token = up.url.split('/').pop() as string;
      const later = Date.now() + 5000;
      const check = (storage as unknown as {
        verifyTicket: (t: string, u: 'upload' | 'download', nowMs: number) => { ok: boolean };
      }).verifyTicket(token, 'upload', later);
      expect(check.ok).toBe(false);
    });
  });
}

contractSuite('LocalFsStorageAdapter', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'mcp-storage-'));
  return new LocalFsStorageAdapter({
    rootDir,
    bucket: BUCKET,
    publicBaseUrl: BASE_URL,
    signingSecret: SECRET,
  });
});

if (S3_ENDPOINT) {
  contractSuite('S3CompatibleStorageAdapter (MinIO THAT)', async () => {
    const adapter = new S3CompatibleStorageAdapter({
      endpoint: S3_ENDPOINT,
      region: 'us-east-1',
      accessKeyId: process.env.MEDIACLEAR_TEST_S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.MEDIACLEAR_TEST_S3_SECRET_KEY ?? '',
      bucket: BUCKET,
      publicBaseUrl: BASE_URL,
      signingSecret: SECRET,
      forcePathStyle: true,
    });
    await adapter.ensureBucket();
    return adapter;
  });
}
