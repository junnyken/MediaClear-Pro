/**
 * MCP-40 — doc TIMELINE FRAME that cua mot video.
 *
 * DIEU QUAN TRONG NHAT: tong so frame phai duoc DEM, khong duoc suy ra tu `duration × fps`.
 *
 * Voi video frame rate bien doi (VFR), `duration × fps` sai — va sai theo huong nguy hiem nhat:
 * no cho ra mot con so TRONG NHU DUNG. Neu lay con so do lam "so frame ky vong" thi bat bien
 * "khong co frame nao bi bo sot" mat het y nghia: he thong se so ket qua tracking voi mot uoc
 * luong, chu khong voi su that.
 *
 * Vi vay o day dung `-count_frames` cua ffprobe: no GIAI MA that va dem. Cham hon, va do la cai
 * gia phai tra de con so co nghia.
 */
import { run } from './ffmpeg.js';

const PROBE_TIMEOUT_MS = 120_000;

export interface FrameEntry {
  index: number;
  /** Moc thoi gian THAT cua frame, giay. `null` khi ffprobe khong doc duoc pts cua frame do. */
  ptsSeconds: number | null;
}

export interface FrameTimeline {
  /**
   * TONG so frame ky vong — con so ma bat bien "khong bo sot frame nao" so voi.
   *
   * Lay `declaredFrameCount` khi container co khai, neu khong thi lay so giai ma duoc. Vi sao uu
   * tien so KHAI: mot frame bi hong den muc khong giai ma noi se KHONG duoc dem vao
   * `nb_read_frames` — no bien mat khoi phep dem. Lay so giai ma lam tong thi frame hong tu dong
   * "khong ton tai", va yeu cau "frame loi decode phai duoc ghi nhan, khong bi bo qua khoi tong
   * so" that bai trong im lang.
   */
  expectedFrameCount: number;
  /** So frame container KHAI (`nb_frames`). `null` khi container khong khai. */
  declaredFrameCount: number | null;
  /** So frame GIAI MA duoc that (`nb_read_frames`). */
  decodedFrameCount: number;
  /**
   * So frame container khai ma KHONG giai ma duoc. Lon hon 0 la tep co frame hong.
   *
   * Do duoc that: `video-corrupt-frame.mp4` khai 10, giai ma duoc 9 => 1.
   */
  undecodableFrames: number;
  /** Frame rate trung binh THAT (`avg_frame_rate`), dung cho nguong temporal. `null` = khong doc duoc. */
  fps: number | null;
  /** True khi `r_frame_rate` khac `avg_frame_rate` — dau hieu VFR. */
  variableFrameRate: boolean;
  frames: FrameEntry[];
  /**
   * So frame KHONG lay duoc timestamp.
   *
   * Khac `expectedFrameCount - frames.length`: day la frame CO trong danh sach nhung thieu pts.
   * Ghi rieng de khong nham "frame hong" voi "frame bien mat".
   */
  framesWithoutTimestamp: number;
}

function parseRate(value: string | undefined | null): number | null {
  if (!value) return null;
  const [a, b] = value.split('/');
  const num = Number(a);
  const den = b === undefined ? 1 : Number(b);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  const rate = num / den;
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/**
 * Doc timeline tu mot tep tren dia.
 *
 * Nem `FfmpegError` khi ffprobe that bai — KHONG tra ve timeline rong. Mot timeline rong trong
 * giong het "video khong co frame nao", va do la mot loi khai sai ve tep cua nguoi dung.
 */
export async function readFrameTimeline(path: string): Promise<FrameTimeline> {
  // 1) Dem frame bang giai ma that + lay hai frame rate de biet co phai VFR khong.
  const meta = await run('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-count_frames',
    '-show_entries', 'stream=nb_read_frames,nb_frames,r_frame_rate,avg_frame_rate',
    '-of', 'json', path,
  ], PROBE_TIMEOUT_MS);

  const stream = (JSON.parse(meta.stdout) as { streams?: Array<Record<string, string>> }).streams?.[0] ?? {};
  const counted = Number(stream.nb_read_frames);
  const decodedFrameCount = Number.isFinite(counted) && counted >= 0 ? counted : 0;
  const declaredRaw = Number(stream.nb_frames);
  const declaredFrameCount = Number.isFinite(declaredRaw) && declaredRaw >= 0 ? declaredRaw : null;
  const expectedFrameCount = declaredFrameCount ?? decodedFrameCount;
  const undecodableFrames = Math.max(0, expectedFrameCount - decodedFrameCount);
  const rFps = parseRate(stream.r_frame_rate);
  const avgFps = parseRate(stream.avg_frame_rate);

  // 2) Lay timestamp THAT cua tung frame. Voi VFR day la nguon duy nhat dung.
  const pts = await run('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'frame=pts_time', '-of', 'csv=p=0', path,
  ], PROBE_TIMEOUT_MS);

  const frames: FrameEntry[] = [];
  let framesWithoutTimestamp = 0;
  const lines = pts.stdout.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  for (let i = 0; i < lines.length; i += 1) {
    // `csv=p=0` co the de lai dau phay thua o cuoi dong; cat no truoc khi doi so.
    const raw = lines[i]!.replace(/,+$/, '');
    const value = Number(raw);
    if (Number.isFinite(value)) frames.push({ index: i, ptsSeconds: value });
    else {
      frames.push({ index: i, ptsSeconds: null });
      framesWithoutTimestamp += 1;
    }
  }

  return {
    expectedFrameCount,
    declaredFrameCount,
    decodedFrameCount,
    undecodableFrames,
    fps: avgFps ?? rFps,
    /*
     * `r_frame_rate` la frame rate danh nghia cua container, `avg_frame_rate` la trung binh that.
     * Hai so lech nhau la dau hieu VFR. Dung sai nho de khong keu nham vi lam tron.
     */
    variableFrameRate: rFps !== null && avgFps !== null && Math.abs(rFps - avgFps) > 0.01,
    frames,
    framesWithoutTimestamp,
  };
}
