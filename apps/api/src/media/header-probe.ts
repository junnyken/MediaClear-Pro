/**
 * HeaderMediaProbe - parser thuan TypeScript, khong phu thuoc nhi phan ngoai.
 *
 * Ho tro (dung bo dinh dang owner da chot):
 *  - anh : PNG (IHDR), JPEG (SOFn), WebP (VP8 / VP8L / VP8X)
 *  - video: MP4/MOV (ISO-BMFF: moov > mvhd + tkhd + hdlr), WebM (EBML/Matroska)
 *
 * Doc header theo doan qua ByteSource. Khong nap ca file.
 * Khong doc duoc mot so do nao -> tra null cho dung so do do (khong doan).
 */
import type { MediaType } from '@mediaclear/contracts';
import type { ByteSource } from './byte-source.js';
import { EMPTY_PROBE, type MediaProbeAdapter, type ProbeResult } from './probe.js';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EBML_SIGNATURE = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
/** Tran doc header cho container video: du cho moov o dau file (faststart). */
const VIDEO_SCAN_LIMIT_BYTES = 8 * 1024 * 1024;

type Format = 'png' | 'jpeg' | 'webp' | 'mp4' | 'mov' | 'webm';

const MIME_BY_FORMAT: Record<Format, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
};

const MEDIA_TYPE_BY_FORMAT: Record<Format, MediaType> = {
  png: 'image',
  jpeg: 'image',
  webp: 'image',
  mp4: 'video',
  mov: 'video',
  webm: 'video',
};

function detectFormat(head: Buffer): Format | null {
  if (head.length >= 8 && head.subarray(0, 8).equals(PNG_SIGNATURE)) return 'png';
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (head.length >= 12 && head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP') {
    return 'webp';
  }
  if (head.length >= 4 && head.subarray(0, 4).equals(EBML_SIGNATURE)) return 'webm';
  if (head.length >= 12 && head.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = head.subarray(8, 12).toString('latin1');
    return brand === 'qt  ' ? 'mov' : 'mp4';
  }
  return null;
}

/* ------------------------------------------------------------------ anh --- */

function parsePng(head: Buffer): Pick<ProbeResult, 'widthPx' | 'heightPx' | 'corrupt'> {
  // IHDR luon la chunk dau tien: 8 byte signature + 4 length + 4 type + width/height.
  if (head.length < 24 || head.subarray(12, 16).toString('latin1') !== 'IHDR') {
    return { widthPx: null, heightPx: null, corrupt: true };
  }
  return { widthPx: head.readUInt32BE(16), heightPx: head.readUInt32BE(20), corrupt: false };
}

const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function parseJpeg(buffer: Buffer): Pick<ProbeResult, 'widthPx' | 'heightPx' | 'corrupt'> {
  let offset = 2;
  while (offset + 3 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1] ?? 0;
    // Marker doc than: khong co doan du lieu di kem.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break; // het header / bat dau scan
    if (offset + 4 > buffer.length) break;
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (JPEG_SOF_MARKERS.has(marker)) {
      if (offset + 9 > buffer.length) return { widthPx: null, heightPx: null, corrupt: true };
      return {
        heightPx: buffer.readUInt16BE(offset + 5),
        widthPx: buffer.readUInt16BE(offset + 7),
        corrupt: false,
      };
    }
    if (segmentLength < 2) return { widthPx: null, heightPx: null, corrupt: true };
    offset += 2 + segmentLength;
  }
  return { widthPx: null, heightPx: null, corrupt: true };
}

function parseWebp(buffer: Buffer): Pick<ProbeResult, 'widthPx' | 'heightPx' | 'corrupt'> {
  if (buffer.length < 30) return { widthPx: null, heightPx: null, corrupt: true };
  const chunk = buffer.subarray(12, 16).toString('latin1');
  if (chunk === 'VP8 ') {
    // 3 byte frame tag + 3 byte sync code (9D 01 2A) roi toi kich thuoc 14 bit.
    if (buffer.length < 30) return { widthPx: null, heightPx: null, corrupt: true };
    return {
      widthPx: buffer.readUInt16LE(26) & 0x3fff,
      heightPx: buffer.readUInt16LE(28) & 0x3fff,
      corrupt: false,
    };
  }
  if (chunk === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return {
      widthPx: (bits & 0x3fff) + 1,
      heightPx: ((bits >> 14) & 0x3fff) + 1,
      corrupt: false,
    };
  }
  if (chunk === 'VP8X') {
    return {
      widthPx: buffer.readUIntLE(24, 3) + 1,
      heightPx: buffer.readUIntLE(27, 3) + 1,
      corrupt: false,
    };
  }
  return { widthPx: null, heightPx: null, corrupt: true };
}

/* ------------------------------------------------- MP4 / MOV (ISO-BMFF) --- */

interface Box {
  type: string;
  /** Vi tri byte dau tien cua PAYLOAD. */
  payloadStart: number;
  payloadEnd: number;
  end: number;
}

function readBox(buffer: Buffer, offset: number, limit: number): Box | null {
  if (offset + 8 > limit) return null;
  let size = buffer.readUInt32BE(offset);
  const type = buffer.subarray(offset + 4, offset + 8).toString('latin1');
  let payloadStart = offset + 8;
  if (size === 1) {
    if (offset + 16 > limit) return null;
    // 64-bit largesize: doc phan thap de tranh mat chinh xac cua Number.
    const high = buffer.readUInt32BE(offset + 8);
    const low = buffer.readUInt32BE(offset + 12);
    size = high * 2 ** 32 + low;
    payloadStart = offset + 16;
  } else if (size === 0) {
    size = limit - offset; // box keo toi het file
  }
  if (size < 8) return null;
  const end = Math.min(offset + size, limit);
  return { type, payloadStart, payloadEnd: end, end };
}

function findBoxes(buffer: Buffer, start: number, limit: number, type: string): Box[] {
  const found: Box[] = [];
  let offset = start;
  while (offset < limit) {
    const box = readBox(buffer, offset, limit);
    if (!box || box.end <= offset) break;
    if (box.type === type) found.push(box);
    offset = box.end;
  }
  return found;
}

function parseMvhd(buffer: Buffer, box: Box): number | null {
  const version = buffer.readUInt8(box.payloadStart);
  const base = box.payloadStart + 4; // version(1) + flags(3)
  if (version === 1) {
    if (base + 28 > box.payloadEnd) return null;
    const timescale = buffer.readUInt32BE(base + 16);
    const high = buffer.readUInt32BE(base + 20);
    const low = buffer.readUInt32BE(base + 24);
    const duration = high * 2 ** 32 + low;
    return timescale > 0 ? duration / timescale : null;
  }
  if (base + 16 > box.payloadEnd) return null;
  const timescale = buffer.readUInt32BE(base + 8);
  const duration = buffer.readUInt32BE(base + 12);
  return timescale > 0 ? duration / timescale : null;
}

/** width/height la 8 byte cuoi cua payload tkhd, dang fixed-point 16.16. */
function parseTkhdDimensions(buffer: Buffer, box: Box): { widthPx: number; heightPx: number } | null {
  if (box.payloadEnd - box.payloadStart < 8) return null;
  const width = buffer.readUInt32BE(box.payloadEnd - 8) / 65536;
  const height = buffer.readUInt32BE(box.payloadEnd - 4) / 65536;
  if (width <= 0 || height <= 0) return null;
  return { widthPx: Math.round(width), heightPx: Math.round(height) };
}

function trackHandler(buffer: Buffer, trak: Box): string | null {
  for (const mdia of findBoxes(buffer, trak.payloadStart, trak.payloadEnd, 'mdia')) {
    for (const hdlr of findBoxes(buffer, mdia.payloadStart, mdia.payloadEnd, 'hdlr')) {
      const base = hdlr.payloadStart + 8; // version/flags(4) + pre_defined(4)
      if (base + 4 > hdlr.payloadEnd) continue;
      return buffer.subarray(base, base + 4).toString('latin1');
    }
  }
  return null;
}

function parseIsoBmff(buffer: Buffer): Omit<ProbeResult, 'detectedMimeType' | 'mediaType'> {
  const limit = buffer.length;
  const moovList = findBoxes(buffer, 0, limit, 'moov');
  const moov = moovList[0];
  if (!moov) {
    // Khong thay moov trong pham vi da doc: KHONG ket luan hong, chi la chua biet.
    return { widthPx: null, heightPx: null, durationSeconds: null, hasAudioStream: null, corrupt: false };
  }
  const mvhd = findBoxes(buffer, moov.payloadStart, moov.payloadEnd, 'mvhd')[0];
  const durationSeconds = mvhd ? parseMvhd(buffer, mvhd) : null;

  let widthPx: number | null = null;
  let heightPx: number | null = null;
  let hasAudioStream = false;
  for (const trak of findBoxes(buffer, moov.payloadStart, moov.payloadEnd, 'trak')) {
    const handler = trackHandler(buffer, trak);
    if (handler === 'soun') hasAudioStream = true;
    if (handler !== 'vide') continue;
    const tkhd = findBoxes(buffer, trak.payloadStart, trak.payloadEnd, 'tkhd')[0];
    const dims = tkhd ? parseTkhdDimensions(buffer, tkhd) : null;
    if (dims && widthPx === null) {
      widthPx = dims.widthPx;
      heightPx = dims.heightPx;
    }
  }
  return { widthPx, heightPx, durationSeconds, hasAudioStream, corrupt: false };
}

/* ------------------------------------------------------ WebM (Matroska) --- */

interface EbmlElement {
  id: number;
  payloadStart: number;
  payloadEnd: number;
  end: number;
}

function readVint(buffer: Buffer, offset: number, keepMarker: boolean): { value: number; length: number } | null {
  if (offset >= buffer.length) return null;
  const first = buffer.readUInt8(offset);
  if (first === 0) return null;
  let length = 1;
  let mask = 0x80;
  while (length <= 8 && (first & mask) === 0) {
    mask >>= 1;
    length += 1;
  }
  if (length > 8 || offset + length > buffer.length) return null;
  let value = keepMarker ? first : first & (mask - 1);
  for (let i = 1; i < length; i += 1) {
    value = value * 256 + buffer.readUInt8(offset + i);
  }
  return { value, length };
}

function readElement(buffer: Buffer, offset: number, limit: number): EbmlElement | null {
  const id = readVint(buffer, offset, true);
  if (!id) return null;
  const size = readVint(buffer, offset + id.length, false);
  if (!size) return null;
  const payloadStart = offset + id.length + size.length;
  // Size "unknown" (toan bit 1) => keo den het pham vi dang xet.
  const unknownSize = size.value >= 2 ** (7 * size.length) - 1;
  const payloadEnd = unknownSize ? limit : Math.min(payloadStart + size.value, limit);
  return { id: id.value, payloadStart, payloadEnd, end: payloadEnd };
}

function ebmlUint(buffer: Buffer, el: EbmlElement): number | null {
  const length = el.payloadEnd - el.payloadStart;
  if (length <= 0 || length > 8) return null;
  let value = 0;
  for (let i = 0; i < length; i += 1) value = value * 256 + buffer.readUInt8(el.payloadStart + i);
  return value;
}

function ebmlFloat(buffer: Buffer, el: EbmlElement): number | null {
  const length = el.payloadEnd - el.payloadStart;
  if (length === 4) return buffer.readFloatBE(el.payloadStart);
  if (length === 8) return buffer.readDoubleBE(el.payloadStart);
  return null;
}

const EBML_ID = {
  SEGMENT: 0x18538067,
  INFO: 0x1549a966,
  TIMECODE_SCALE: 0x2ad7b1,
  DURATION: 0x4489,
  TRACKS: 0x1654ae6b,
  TRACK_ENTRY: 0xae,
  TRACK_TYPE: 0x83,
  VIDEO: 0xe0,
  PIXEL_WIDTH: 0xb0,
  PIXEL_HEIGHT: 0xba,
} as const;

function eachChild(buffer: Buffer, start: number, end: number, visit: (el: EbmlElement) => void): void {
  let offset = start;
  while (offset < end) {
    const el = readElement(buffer, offset, end);
    if (!el || el.end <= offset) break;
    visit(el);
    offset = el.end;
  }
}

function parseWebm(buffer: Buffer): Omit<ProbeResult, 'detectedMimeType' | 'mediaType'> {
  let widthPx: number | null = null;
  let heightPx: number | null = null;
  let durationTicks: number | null = null;
  let timecodeScale = 1_000_000; // mac dinh Matroska: 1ms
  let hasAudioStream = false;
  let sawSegment = false;

  eachChild(buffer, 0, buffer.length, (top) => {
    if (top.id !== EBML_ID.SEGMENT) return;
    sawSegment = true;
    eachChild(buffer, top.payloadStart, top.payloadEnd, (child) => {
      if (child.id === EBML_ID.INFO) {
        eachChild(buffer, child.payloadStart, child.payloadEnd, (info) => {
          if (info.id === EBML_ID.TIMECODE_SCALE) timecodeScale = ebmlUint(buffer, info) ?? timecodeScale;
          if (info.id === EBML_ID.DURATION) durationTicks = ebmlFloat(buffer, info);
        });
      }
      if (child.id === EBML_ID.TRACKS) {
        eachChild(buffer, child.payloadStart, child.payloadEnd, (entry) => {
          if (entry.id !== EBML_ID.TRACK_ENTRY) return;
          let trackType: number | null = null;
          let entryWidth: number | null = null;
          let entryHeight: number | null = null;
          eachChild(buffer, entry.payloadStart, entry.payloadEnd, (field) => {
            if (field.id === EBML_ID.TRACK_TYPE) trackType = ebmlUint(buffer, field);
            if (field.id === EBML_ID.VIDEO) {
              eachChild(buffer, field.payloadStart, field.payloadEnd, (v) => {
                if (v.id === EBML_ID.PIXEL_WIDTH) entryWidth = ebmlUint(buffer, v);
                if (v.id === EBML_ID.PIXEL_HEIGHT) entryHeight = ebmlUint(buffer, v);
              });
            }
          });
          if (trackType === 2) hasAudioStream = true;
          if (trackType === 1 && widthPx === null && entryWidth !== null && entryHeight !== null) {
            widthPx = entryWidth;
            heightPx = entryHeight;
          }
        });
      }
    });
  });

  const durationSeconds = durationTicks === null ? null : (durationTicks * timecodeScale) / 1_000_000_000;
  return {
    widthPx,
    heightPx,
    durationSeconds,
    hasAudioStream: sawSegment ? hasAudioStream : null,
    corrupt: !sawSegment,
  };
}

/* ----------------------------------------------------------- adapter ----- */

export class HeaderMediaProbe implements MediaProbeAdapter {
  readonly id = 'header-probe-v1';

  async probe(source: ByteSource): Promise<ProbeResult> {
    if (source.size <= 0) return { ...EMPTY_PROBE };
    const head = await source.read(0, 64);
    const format = detectFormat(head);
    if (format === null) {
      // Khong nhan dang duoc dinh dang => KHONG doan mediaType.
      return { ...EMPTY_PROBE, corrupt: false };
    }

    const base = {
      detectedMimeType: MIME_BY_FORMAT[format],
      mediaType: MEDIA_TYPE_BY_FORMAT[format],
    };

    if (format === 'png') {
      const png = parsePng(await source.read(0, 32));
      return { ...EMPTY_PROBE, ...base, ...png };
    }
    if (format === 'jpeg') {
      // Header JPEG (ke ca EXIF lon) hiem khi vuot 256 KB.
      const jpeg = parseJpeg(await source.read(0, Math.min(source.size, 256 * 1024)));
      return { ...EMPTY_PROBE, ...base, ...jpeg };
    }
    if (format === 'webp') {
      const webp = parseWebp(await source.read(0, Math.min(source.size, 64)));
      return { ...EMPTY_PROBE, ...base, ...webp };
    }

    const scan = await source.read(0, Math.min(source.size, VIDEO_SCAN_LIMIT_BYTES));
    const parsed = format === 'webm' ? parseWebm(scan) : parseIsoBmff(scan);
    return { ...base, ...parsed };
  }
}
