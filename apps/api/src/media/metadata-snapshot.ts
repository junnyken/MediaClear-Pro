/**
 * P5-MCP-51 — doc metadata theo TUNG TRUONG tren byte that.
 *
 * Phan biet voi `provenance-probe.ts`: bo do kia tra loi "co metadata hay khong" (`Presence`).
 * Bo do nay tra loi "co NHUNG truong nao, gia tri bao nhieu" — do la thu duy nhat cho phep noi
 * "truong X con nguyen, truong Y da mat" thay vi mot cau chung chung.
 *
 * GIOI HAN THAT, noi thang truoc khi ai do tin qua muc:
 *
 *  - ANH: `sharp` tra ve EXIF/ICC/XMP/IPTC duoi dang BUFFER THO, khong phai truong da phan tich.
 *    He thong nay KHONG them thu vien phan tich EXIF (mot phu thuoc moi la mot quyet dinh, xem
 *    `D-039`). Nen bo doc duoi day tu duyet cau truc TIFF/IFD cho MOT SO tag da biet
 *    (Make, Model, ImageDescription, DateTime, va con tro GPS IFD). Tag ngoai danh sach do
 *    KHONG duoc doc — va vi vay KHONG duoc bao cao la "khong co".
 *  - VIDEO: doc `format.tags` va `stream.tags` tu `ffprobe` — day la truong that, khong phai suy.
 *  - Khong doc duoc thi `readable: false`. Mot anh chup rong ("da doc, khong co truong nao") khac
 *    han mot phep do that bai ("khong biet gi ca").
 */
import sharp from 'sharp';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import type { MediaType, MetadataField, MetadataSnapshot } from '@mediaclear/contracts';
import { run, withTempDir } from './ffmpeg.js';

export const METADATA_SNAPSHOT_DETECTOR_ID = 'mediaclear-metadata-fields-v1';

/**
 * Tag EXIF duoc doc. DANH SACH DONG co chu dinh.
 *
 * Doc het moi tag nghe co ve tot hon, nhung se keo theo mot bo phan tich EXIF day du — va quan
 * trong hon: mot danh sach mo lam cho cau "truong nay khong co" tro nen khong kiem chung duoc.
 * Danh sach dong cho phep noi chinh xac: "trong 5 tag he thong doc duoc, tag nay khong co".
 */
const EXIF_TAGS: Record<number, { key: string; category: MetadataField['category'] }> = {
  0x010e: { key: 'exif.ImageDescription', category: 'descriptive' },
  0x010f: { key: 'exif.Make', category: 'device' },
  0x0110: { key: 'exif.Model', category: 'device' },
  0x0131: { key: 'exif.Software', category: 'device' },
  0x0132: { key: 'exif.DateTime', category: 'descriptive' },
  0x8825: { key: 'exif.GPSInfoIFD', category: 'location' },
};

/** Cac tag EXIF he thong CO THE doc. Bo doi chieu can biet de phan biet "khong co" voi "khong doc". */
export const READABLE_EXIF_KEYS: readonly string[] = Object.values(EXIF_TAGS).map((t) => t.key);

function readUint16(b: Uint8Array, at: number, little: boolean): number {
  return little ? b[at]! | (b[at + 1]! << 8) : (b[at]! << 8) | b[at + 1]!;
}
function readUint32(b: Uint8Array, at: number, little: boolean): number {
  return little
    ? (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0
    : ((b[at]! << 24) | (b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!) >>> 0;
}

/**
 * Duyet IFD0 cua khoi EXIF (cau truc TIFF) va lay cac tag trong danh sach tren.
 *
 * Tra `null` khi khoi khong duyet duoc — nguoi goi phai coi do la "khong doc duoc", KHONG phai
 * "khong co truong nao".
 */
function parseExifIfd0(buffer: Uint8Array): MetadataField[] | null {
  try {
    // `sharp` tra khoi bat dau bang "Exif\0\0" o mot so dinh dang.
    let base = 0;
    if (buffer.length > 6 && buffer[0] === 0x45 && buffer[1] === 0x78 && buffer[2] === 0x69 && buffer[3] === 0x66) {
      base = 6;
    }
    if (buffer.length < base + 8) return null;
    const b0 = buffer[base]!;
    const b1 = buffer[base + 1]!;
    if (!((b0 === 0x49 && b1 === 0x49) || (b0 === 0x4d && b1 === 0x4d))) return null;
    const little = b0 === 0x49;
    if (readUint16(buffer, base + 2, little) !== 42) return null;

    const ifd0 = base + readUint32(buffer, base + 4, little);
    if (ifd0 + 2 > buffer.length) return null;
    const count = readUint16(buffer, ifd0, little);

    const out: MetadataField[] = [];
    for (let i = 0; i < count; i += 1) {
      const entry = ifd0 + 2 + i * 12;
      if (entry + 12 > buffer.length) break;
      const tag = readUint16(buffer, entry, little);
      const known = EXIF_TAGS[tag];
      if (!known) continue;

      const type = readUint16(buffer, entry + 2, little);
      const n = readUint32(buffer, entry + 4, little);

      if (type === 2) {
        // ASCII. <= 4 byte nam ngay trong o gia tri, dai hon thi o day la mot offset.
        const inline = n <= 4;
        const at = inline ? entry + 8 : base + readUint32(buffer, entry + 8, little);
        if (at + n > buffer.length) continue;
        const raw = buffer.slice(at, at + Math.max(0, n - 1));
        out.push({ key: known.key, category: known.category, value: new TextDecoder().decode(raw).trim() });
      } else if (tag === 0x8825) {
        /*
         * Con tro GPS IFD. KHONG doc toa do that — he thong khong can toa do, no chi can biet
         * "tep nay CO mang du lieu vi tri hay khong" de thi hanh chinh sach go bo.
         * Doc toa do roi luu lai chinh la dieu chinh sach do dang chan.
         */
        out.push({ key: known.key, category: known.category, value: true });
      }
    }
    return out;
  } catch {
    return null;
  }
}

/** Anh: kich thuoc/dinh dang tu `sharp`, cong cac tag EXIF doc duoc. */
async function imageSnapshot(bytes: Uint8Array): Promise<MetadataSnapshot> {
  try {
    const meta = await sharp(Buffer.from(bytes)).metadata();
    const fields: MetadataField[] = [
      { key: 'image.width', category: 'technical', value: meta.width ?? null },
      { key: 'image.height', category: 'technical', value: meta.height ?? null },
      { key: 'image.format', category: 'container', value: meta.format ?? null },
      { key: 'image.space', category: 'technical', value: meta.space ?? null },
      { key: 'image.channels', category: 'technical', value: meta.channels ?? null },
      { key: 'image.density', category: 'technical', value: meta.density ?? null },
      // Su HIEN DIEN cua cac khoi metadata — do duoc chac chan, khac voi noi dung ben trong.
      { key: 'image.hasIcc', category: 'technical', value: (meta.icc?.length ?? 0) > 0 },
      { key: 'image.hasXmp', category: 'provenance', value: (meta.xmp?.length ?? 0) > 0 },
      { key: 'image.hasIptc', category: 'descriptive', value: (meta.iptc?.length ?? 0) > 0 },
    ];

    if (meta.exif && meta.exif.length > 0) {
      const parsed = parseExifIfd0(new Uint8Array(meta.exif));
      if (parsed === null) {
        /*
         * CO khoi EXIF nhung KHONG duyet duoc. Day la mot phep do that bai, khong phai mot ket
         * luan. Danh dau ca anh chup la khong doc duoc, neu khong bo doi chieu se bao "da giu"
         * cho nhung truong no chua bao gio nhin thay.
         */
        return { readable: false, fields, detectorId: METADATA_SNAPSHOT_DETECTOR_ID };
      }
      for (const key of READABLE_EXIF_KEYS) {
        const found = parsed.find((f) => f.key === key);
        const category = Object.values(EXIF_TAGS).find((t) => t.key === key)!.category;
        fields.push({ key, category, value: found ? found.value : null });
      }
    } else {
      // Khong co khoi EXIF => cac tag deu vang mat, va day la ket luan DO DUOC.
      for (const key of READABLE_EXIF_KEYS) {
        const category = Object.values(EXIF_TAGS).find((t) => t.key === key)!.category;
        fields.push({ key, category, value: null });
      }
    }

    return { readable: true, fields, detectorId: METADATA_SNAPSHOT_DETECTOR_ID };
  } catch {
    return { readable: false, fields: [], detectorId: METADATA_SNAPSHOT_DETECTOR_ID };
  }
}

interface ProbeTagStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  tags?: Record<string, string>;
}

/** Tag video duoc doc, va nhom cua chung. Danh sach dong, cung ly do voi EXIF. */
const VIDEO_TAGS: Record<string, MetadataField['category']> = {
  title: 'descriptive',
  comment: 'descriptive',
  description: 'descriptive',
  artist: 'descriptive',
  date: 'descriptive',
  encoder: 'device',
  make: 'device',
  model: 'device',
  'com.apple.quicktime.make': 'device',
  'com.apple.quicktime.model': 'device',
  'com.apple.quicktime.location.iso6709': 'location',
  location: 'location',
};

/** Video: doc `format.tags` + `stream.tags` tu ffprobe. Day la truong THAT, khong phai suy. */
async function videoSnapshot(bytes: Uint8Array): Promise<MetadataSnapshot> {
  return withTempDir(async (dir) => {
    const input = join(dir, 'in.bin');
    await writeFile(input, bytes);
    let parsed: {
      streams?: ProbeTagStream[];
      format?: { format_name?: string; duration?: string; tags?: Record<string, string> };
    };
    try {
      const { stdout } = await run(
        'ffprobe',
        ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', input],
        30_000,
      );
      parsed = JSON.parse(stdout) as typeof parsed;
    } catch {
      return { readable: false, fields: [], detectorId: METADATA_SNAPSHOT_DETECTOR_ID };
    }

    const streams = parsed.streams ?? [];
    const video = streams.find((s) => s.codec_type === 'video');
    const audio = streams.find((s) => s.codec_type === 'audio');
    if (!video) return { readable: false, fields: [], detectorId: METADATA_SNAPSHOT_DETECTOR_ID };

    const fields: MetadataField[] = [
      { key: 'video.width', category: 'technical', value: video.width ?? null },
      { key: 'video.height', category: 'technical', value: video.height ?? null },
      { key: 'video.codec', category: 'technical', value: video.codec_name ?? null },
      { key: 'video.frameRate', category: 'technical', value: video.r_frame_rate ?? null },
      { key: 'video.duration', category: 'technical', value: parsed.format?.duration ?? null },
      { key: 'container.format', category: 'container', value: parsed.format?.format_name ?? null },
      // Audio la MOT CONG rieng cua Phase 3 — o day chi ghi nhan de doi chieu, khong thay the.
      { key: 'audio.present', category: 'technical', value: audio !== undefined },
      { key: 'audio.codec', category: 'technical', value: audio?.codec_name ?? null },
    ];

    // Tag gop tu ca format lan stream; chuan hoa ve chu thuong de hai phia so sanh duoc.
    const tags: Record<string, string> = {};
    for (const source of [parsed.format?.tags, video.tags, audio?.tags]) {
      for (const [k, v] of Object.entries(source ?? {})) tags[k.toLowerCase()] = v;
    }
    for (const [tag, category] of Object.entries(VIDEO_TAGS)) {
      fields.push({ key: `tag.${tag}`, category, value: tags[tag] ?? null });
    }

    return { readable: true, fields, detectorId: METADATA_SNAPSHOT_DETECTOR_ID };
  });
}

export async function snapshotMetadata(bytes: Uint8Array, mediaType: MediaType): Promise<MetadataSnapshot> {
  return mediaType === 'image' ? imageSnapshot(bytes) : videoSnapshot(bytes);
}
