/**
 * MediaProbeAdapter - cong doc so do that tu byte cua file.
 *
 * Nguyen tac (MCP-12): khong doc duoc thi tra `null` va de validateMedia() bao
 * *_UNKNOWN. KHONG bao gio doan, khong bao gio dien 0 thay cho "chua biet".
 */
import type { MediaType } from '@mediaclear/contracts';
import type { ByteSource } from './byte-source.js';

export interface ProbeResult {
  /** MIME suy ra tu magic bytes. null = khong nhan dang duoc. */
  detectedMimeType: string | null;
  mediaType: MediaType | null;
  widthPx: number | null;
  heightPx: number | null;
  durationSeconds: number | null;
  hasAudioStream: boolean | null;
  /** true khi header ton tai nhung doc do dang / sai cau truc. */
  corrupt: boolean;
}

export interface MediaProbeAdapter {
  readonly id: string;
  probe(source: ByteSource): Promise<ProbeResult>;
}

export const EMPTY_PROBE: ProbeResult = {
  detectedMimeType: null,
  mediaType: null,
  widthPx: null,
  heightPx: null,
  durationSeconds: null,
  hasAudioStream: null,
  corrupt: false,
};
