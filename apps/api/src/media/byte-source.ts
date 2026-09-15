/**
 * ByteSource - doc file theo doan, KHONG nap ca file vao RAM.
 *
 * Ly do: gioi han la 199 MB; neu probe nap ca file thi mot vai upload song song
 * du de giet tien trinh. Parser chi doc header nen chi can doc vai KB.
 */
import { open } from 'node:fs/promises';

export interface ByteSource {
  readonly size: number;
  /** Doc toi da `length` byte tu `offset`. Tra it hon neu cham cuoi file. */
  read(offset: number, length: number): Promise<Buffer>;
  close(): Promise<void>;
}

export function bufferSource(buffer: Buffer): ByteSource {
  return {
    size: buffer.byteLength,
    async read(offset: number, length: number): Promise<Buffer> {
      if (offset < 0 || offset >= buffer.byteLength) return Buffer.alloc(0);
      return buffer.subarray(offset, Math.min(offset + length, buffer.byteLength));
    },
    async close(): Promise<void> {
      /* buffer khong can dong */
    },
  };
}

export async function fileSource(path: string): Promise<ByteSource> {
  const handle = await open(path, 'r');
  const stat = await handle.stat();
  return {
    size: stat.size,
    async read(offset: number, length: number): Promise<Buffer> {
      if (offset < 0 || offset >= stat.size) return Buffer.alloc(0);
      const want = Math.min(length, stat.size - offset);
      const out = Buffer.alloc(want);
      const { bytesRead } = await handle.read(out, 0, want, offset);
      return out.subarray(0, bytesRead);
    },
    async close(): Promise<void> {
      await handle.close();
    },
  };
}
