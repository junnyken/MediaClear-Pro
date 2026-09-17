/**
 * Lop mong tren `ffmpeg`/`ffprobe` (P3-MCP-30…34).
 *
 * `sharp` chi lam duoc ANH. Toan bo Phase 3 la video, nen day la phu thuoc bat buoc — va vi no la
 * NHI PHAN NGOAI chu khong phai goi npm, no phai co trong anh Docker (da them o chang `runtime`).
 * Thieu no thi worker nhan job video roi hong ngay, nen `ffmpegAvailable()` duoc kiem TRUOC khi
 * nhan job chu khong phai giua chung.
 *
 * ffmpeg lam viec tren TEP chu khong tren buffer, ma cong luu tru cua he thong lai la BYTE. Nen
 * moi thao tac o day: ghi byte ra tep tam -> chay -> doc lai -> xoa tep tam. Tep tam nam trong thu
 * muc rieng tung luot va duoc xoa ke ca khi loi.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AudioTrack, Region } from '@mediaclear/contracts';

export interface VideoProbe {
  widthPx: number | null;
  heightPx: number | null;
  durationSeconds: number | null;
  videoCodec: string | null;
  container: string | null;
  frameRate: number | null;
  audio: AudioTrack;
  /** true khi ffprobe khong doc noi tep - KHONG suy ra la "khong co gi". */
  unreadable: boolean;
}

export interface RenderedVideo {
  bytes: Uint8Array;
  byteSize: number;
  probe: VideoProbe;
}

export class FfmpegError extends Error {
  constructor(message: string, readonly stderrTail: string) {
    super(message);
    this.name = 'FfmpegError';
  }
}

export function run(command: string, args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new FfmpegError(`${command} qua han ${timeoutMs}ms`, stderr.slice(-800)));
    }, timeoutMs);
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString('utf8'); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString('utf8'); });
    child.on('error', (e) => { clearTimeout(timer); reject(new FfmpegError(`${command}: ${e.message}`, stderr.slice(-800))); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new FfmpegError(`${command} thoat voi ma ${code}`, stderr.slice(-800)));
    });
  });
}

let availability: boolean | null = null;

/** Kiem MOT LAN roi nho. Hoi lai moi job la phi, nhung hoi TRUOC khi nhan job la bat buoc. */
export async function ffmpegAvailable(): Promise<boolean> {
  if (availability !== null) return availability;
  try {
    await run('ffprobe', ['-version'], 5000);
    await run('ffmpeg', ['-version'], 5000);
    availability = true;
  } catch {
    availability = false;
  }
  return availability;
}

/** Chi dung cho test: quen ket qua da nho. */
export function resetFfmpegAvailability(): void {
  availability = null;
}

export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'mediaclear-ff-'));
  try {
    return await fn(dir);
  } finally {
    // Xoa ke ca khi loi: tep tam cua video de day dia rat nhanh.
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function parseRate(value: string | undefined): number | null {
  if (!value) return null;
  const parts = value.split('/').map(Number);
  const num = parts[0];
  const den = parts[1];
  if (num === undefined || den === undefined) return null;
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return num / den;
}

function numOrNull(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  channels?: number;
  duration?: string;
  r_frame_rate?: string;
}

/** Do tren BYTE THAT. Tra `unreadable: true` khi khong doc noi — khong suy ra la "khong co gi". */
export async function probeVideo(bytes: Uint8Array): Promise<VideoProbe> {
  const empty: VideoProbe = {
    widthPx: null, heightPx: null, durationSeconds: null, videoCodec: null, container: null,
    frameRate: null, audio: { present: false, codec: null, durationSeconds: null, channelCount: null },
    unreadable: true,
  };
  return withTempDir(async (dir) => {
    const input = join(dir, 'in.bin');
    await writeFile(input, bytes);
    let parsed: { streams?: ProbeStream[]; format?: { format_name?: string; duration?: string } };
    try {
      const { stdout } = await run(
        'ffprobe',
        ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', input],
        30_000,
      );
      parsed = JSON.parse(stdout) as typeof parsed;
    } catch {
      return empty;
    }
    const streams = parsed.streams ?? [];
    const video = streams.find((s) => s.codec_type === 'video');
    const audio = streams.find((s) => s.codec_type === 'audio');
    if (!video) return empty;
    return {
      widthPx: numOrNull(video.width),
      heightPx: numOrNull(video.height),
      durationSeconds: numOrNull(parsed.format?.duration) ?? numOrNull(video.duration),
      videoCodec: video.codec_name ?? null,
      container: parsed.format?.format_name ?? null,
      frameRate: parseRate(video.r_frame_rate),
      audio: {
        // `present: false` o day nghia la DA DO va khong thay - khac han `unreadable`.
        present: audio !== undefined,
        codec: audio?.codec_name ?? null,
        durationSeconds: audio ? numOrNull(audio.duration) ?? numOrNull(parsed.format?.duration) : null,
        channelCount: audio ? numOrNull(audio.channels) : null,
      },
      unreadable: false,
    };
  });
}

/** Doi vung chuan hoa 0..1 sang pixel, lam tron ve SO CHAN (yuv420p doi kich thuoc chan). */
function pixelBox(region: Region, width: number, height: number): { x: number; y: number; w: number; h: number } {
  const even = (n: number): number => Math.max(2, Math.round(n / 2) * 2);
  const x = Math.max(0, Math.min(width - 2, Math.round(region.x * width)));
  const y = Math.max(0, Math.min(height - 2, Math.round(region.y * height)));
  return {
    x,
    y,
    w: even(Math.min(width - x, region.width * width)),
    h: even(Math.min(height - y, region.height * height)),
  };
}

export interface RenderOptions {
  mode: 'mask' | 'crop' | 'blur';
  regions: readonly Region[];
  /** Chi dung cho `crop`: ti le khung hinh dich, vd '9:16'. */
  cropAspect?: string | null;
  /** Ap cho moi che do: chieu cao dich sau khi xu ly. */
  targetHeight?: number | null;
}

const BLUR_RADIUS = 12;

/**
 * Ban kinh lam mo phai CO theo kich thuoc vung.
 *
 * `boxblur` gioi han ban kinh theo mat phang CHROMA (chi bang nua kich thuoc mat phang luma voi
 * yuv420p). Dat mot ban kinh CO DINH lam ffmpeg tu choi ngay khi vung chon nho:
 *   "Invalid chroma_param radius value 12, must be >= 0 and <= 7"
 *
 * Loi nay chi lo ra khi RENDER THAT tren mot vung nho — khong the bat bang doc ma.
 */
function blurRadiusFor(w: number, h: number): number {
  return Math.max(1, Math.min(BLUR_RADIUS, Math.floor(Math.min(w, h) / 8)));
}

function buildFilter(options: RenderOptions, width: number, height: number): string {
  const boxes = options.regions.map((r) => pixelBox(r, width, height));

  if (options.mode === 'mask') {
    // `t=fill` to DAC ca o - day la static mask, khong phai lam mo.
    return boxes.map((b) => `drawbox=x=${b.x}:y=${b.y}:w=${b.w}:h=${b.h}:color=black@1:t=fill`).join(',');
  }

  if (options.mode === 'blur') {
    /*
     * Cat vung ra, lam mo, roi dan lai dung cho cu. Khong dung mo toan khung.
     *
     * `split` la BAT BUOC: mot nhan dau ra cua bo loc (`[step0]`) chi duoc TIEU THU MOT LAN.
     * Nhan luong (`[0:v]`) thi ffmpeg tu nhan ban nen dung hai lan van chay — va do dung la ly do
     * ban dau mot vung thi chay con HAI vung thi hong. Chi render that moi lo ra.
     */
    const parts: string[] = [];
    let current = '0:v';
    boxes.forEach((b, i) => {
      const radius = blurRadiusFor(b.w, b.h);
      parts.push(`[${current}]split=2[keep${i}][cut${i}]`);
      parts.push(`[cut${i}]crop=${b.w}:${b.h}:${b.x}:${b.y},boxblur=luma_radius=${radius}:chroma_radius=${radius}:luma_power=2[blur${i}]`);
      parts.push(`[keep${i}][blur${i}]overlay=${b.x}:${b.y}[step${i}]`);
      current = `step${i}`;
    });
    return parts.join(';');
  }

  // crop: cat theo ti le, LAY GIUA khung hinh.
  const aspect = options.cropAspect ?? '9:16';
  const ratio = aspect.split(':').map(Number);
  const aw = ratio[0];
  const ah = ratio[1];
  if (aw === undefined || ah === undefined || !Number.isFinite(aw) || !Number.isFinite(ah) || !aw || !ah) {
    throw new FfmpegError(`ti le khung hinh khong hop le: ${aspect}`, '');
  }
  const even = (n: number): number => Math.max(2, Math.floor(n / 2) * 2);
  let w = width;
  let h = Math.round((width * ah) / aw);
  if (h > height) {
    h = height;
    w = Math.round((height * aw) / ah);
  }
  w = even(Math.min(w, width));
  h = even(Math.min(h, height));
  return `crop=${w}:${h}:${even((width - w) / 2)}:${even((height - h) / 2)}`;
}

/**
 * Chay mot luot render. Audio duoc `-c:a copy` MAC DINH: sao chep nguyen luong, khong ma hoa lai,
 * nen khong the "mat tieng vi encode hong". Video khong co audio thi bo `-map` audio di.
 */
export async function renderVideo(source: Uint8Array, options: RenderOptions): Promise<RenderedVideo> {
  const inputProbe = await probeVideo(source);
  if (inputProbe.unreadable || inputProbe.widthPx === null || inputProbe.heightPx === null) {
    throw new FfmpegError('khong doc duoc video dau vao', '');
  }
  const filter = buildFilter(options, inputProbe.widthPx, inputProbe.heightPx);

  return withTempDir(async (dir) => {
    const input = join(dir, 'in.mp4');
    const output = join(dir, 'out.mp4');
    await writeFile(input, source);

    const args = ['-y', '-i', input];
    if (options.mode === 'blur') {
      const last = options.regions.length - 1;
      args.push('-filter_complex', filter, '-map', `[step${last}]`);
      if (inputProbe.audio.present) args.push('-map', '0:a');
    } else {
      args.push('-vf', filter);
      if (inputProbe.audio.present) args.push('-map', '0:v', '-map', '0:a');
    }
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p');
    // `copy` giu NGUYEN luong tieng. Day la cho de mat audio nhat neu ma hoa lai.
    if (inputProbe.audio.present) args.push('-c:a', 'copy');
    args.push('-movflags', '+faststart', output);

    await run('ffmpeg', args, 180_000);
    const bytes = await readFile(output);
    const probe = await probeVideo(bytes);
    return { bytes, byteSize: bytes.byteLength, probe };
  });
}

/** Do phan giai toi da cua ban proxy dung de xem truoc. */
export const PROXY_MAX_HEIGHT_PX = 480;

/**
 * Ban proxy do phan giai thap de xem truoc. KHONG thay the tep goc — no la mot object rieng,
 * o lop luu tru rieng, va tep goc van bat bien (I-1).
 */
export async function makeProxy(source: Uint8Array, maxHeight = PROXY_MAX_HEIGHT_PX): Promise<RenderedVideo> {
  const inputProbe = await probeVideo(source);
  if (inputProbe.unreadable) throw new FfmpegError('khong doc duoc video dau vao', '');

  return withTempDir(async (dir) => {
    const input = join(dir, 'in.mp4');
    const output = join(dir, 'proxy.mp4');
    await writeFile(input, source);
    const args = [
      '-y', '-i', input,
      // `-2` de ffmpeg tu chon chieu rong giu dung ti le va van la so chan.
      '-vf', `scale=-2:'min(${maxHeight},ih)'`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '32', '-pix_fmt', 'yuv420p',
    ];
    // Proxy GIU audio: nguoi dung phai nghe duoc khi xem truoc thi moi biet tieng con nguyen.
    if (inputProbe.audio.present) args.push('-c:a', 'aac', '-b:a', '64k');
    else args.push('-an');
    args.push('-movflags', '+faststart', output);

    await run('ffmpeg', args, 180_000);
    const bytes = await readFile(output);
    const probe = await probeVideo(bytes);
    return { bytes, byteSize: bytes.byteLength, probe };
  });
}
