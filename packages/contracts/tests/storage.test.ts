import { describe, expect, it } from 'vitest';
import {
  MEDIA_BINARY_IN_DATABASE,
  STORAGE_TARGET,
  assertWritableKey,
  storageClassOf,
  storageKeyFor,
} from '../src/storage.js';
import { InMemoryStorageAdapter } from '../src/storage-adapters/in-memory-adapter.js';

describe('MCP-10 object storage abstraction (owner decision Q-01)', () => {
  it('muc tieu production ban dau la R2 nhung chua qua deployment review', () => {
    expect(STORAGE_TARGET.protocol).toBe('s3_compatible');
    expect(STORAGE_TARGET.initialProductionTarget).toBe('cloudflare_r2');
    expect(STORAGE_TARGET.deploymentReviewStatus).toBe('pending');
  });

  it('media binary khong bao gio nam trong PostgreSQL', () => {
    expect(MEDIA_BINARY_IN_DATABASE).toBe(false);
  });

  it('storage key co cau truc workspace/class/id', () => {
    expect(storageKeyFor('ws1', 'source', 'sf1', 'mp4')).toBe('ws1/source/sf1.mp4');
    expect(storageKeyFor('ws1', 'output', 'o1', '.jpg')).toBe('ws1/output/o1.jpg');
    expect(storageClassOf('ws1/preview/p1.mp4')).toBe('preview');
    expect(storageClassOf('ws1/unknown/x.mp4')).toBeNull();
  });

  it('khong bao gio ghi de object class source (I-1)', () => {
    expect(assertWritableKey('ws1/source/sf1.mp4', false)).toBeNull();
    expect(assertWritableKey('ws1/source/sf1.mp4', true)?.code).toBe('MCP_STORAGE_WRITE_DENIED');
    // Output va preview duoc phep ghi de.
    expect(assertWritableKey('ws1/output/o1.mp4', true)).toBeNull();
    expect(assertWritableKey('ws1/preview/p1.mp4', true)).toBeNull();
  });

  it('adapter in-memory tu khai KHONG phai production', () => {
    expect(new InMemoryStorageAdapter().isProductionAdapter).toBe(false);
  });

  it('adapter tuan thu contract: upload url, download url, head, put, delete', async () => {
    const adapter = new InMemoryStorageAdapter();
    const ref = { bucket: 'b1', key: storageKeyFor('ws1', 'output', 'o1', 'jpg') };

    const upload = await adapter.createUploadUrl({
      ref,
      contentType: 'image/jpeg',
      maxByteSize: 1000,
      ttlSeconds: 60,
    });
    expect(upload.url).toContain('b1/ws1/output/o1.jpg');
    expect(new Date(upload.expiresAt).getTime()).toBeGreaterThan(Date.now());

    expect((await adapter.head(ref)).exists).toBe(false);
    await adapter.putObject(ref, new Uint8Array([1, 2, 3]), 'image/jpeg');
    const head = await adapter.head(ref);
    expect(head.exists).toBe(true);
    expect(head.byteSize).toBe(3);
    // Chua tinh checksum that => bao null, khong bia gia tri.
    expect(head.checksumSha256).toBeNull();

    const download = await adapter.createDownloadUrl(ref, 30);
    expect(download.url).toContain('download=1');

    await adapter.deleteObject(ref);
    expect((await adapter.head(ref)).exists).toBe(false);
  });

  it('adapter tu choi ghi de source key da ton tai', async () => {
    const adapter = new InMemoryStorageAdapter();
    const ref = { bucket: 'b1', key: storageKeyFor('ws1', 'source', 'sf1', 'mp4') };
    await adapter.putObject(ref, new Uint8Array([1]), 'video/mp4');
    await expect(adapter.putObject(ref, new Uint8Array([2]), 'video/mp4')).rejects.toThrow(
      'MCP_STORAGE_WRITE_DENIED',
    );
  });
});
