/**
 * Hop dong DUNG CHUNG cho Phase 3 (P3-MCP-30 … P3-MCP-34) — dong lo hong D-047.
 *
 * MOI kieu o day duoc SUY RA tu chinh lich kiem luc chay (`Infer<typeof …>`). Khong the sua kieu
 * ma quen sua phep kiem, vi chung khong phai hai khai bao — chung la mot.
 *
 * Giao dien va may chu deu import tu day. Truoc Phase 3, giao dien TU KHAI lai hinh dang phan hoi
 * bang `apiFetch<T>` — mot loi khang dinh kieu khong ai kiem — nen doi hinh dang o may chu lam
 * trang hong LUC CHAY trong khi `tsc` ca hai ben deu xanh.
 */
import { EVIDENCE_STATUSES, JOB_STATES } from './vocabulary.js';
import { arrayOf, boolean, enumOf, nullable, number, object, optional, string, type Infer } from './schema.js';

/* ------------------------------------------------------------ trang thai --- */

/**
 * NGUON DUY NHAT cho trang thai job, ca kieu lan phep kiem. Doc thang tu `JOB_STATES` — khong
 * chep lai danh sach, vi chep la tao ra ban thu hai co the troi.
 */
export const JOB_STATE_SCHEMA = enumOf(JOB_STATES);

/** Cach xu ly. KHONG cai nao la "AI cleanup" — day la ba phep tat dinh. */
export const VIDEO_OPERATION_MODES = ['mask', 'crop', 'blur'] as const;
export type VideoOperationMode = (typeof VIDEO_OPERATION_MODES)[number];
export const VIDEO_OPERATION_MODE_SCHEMA = enumOf(VIDEO_OPERATION_MODES);

export const EVIDENCE_STATUS_SCHEMA = enumOf(EVIDENCE_STATUSES);

/* ---------------------------------------------------------------- vung --- */

/** Toa do CHUAN HOA 0..1 nen doc lap do phan giai: vung chon tren proxy ap dung dung len ban goc. */
export const REGION_SCHEMA = object({
  x: number(),
  y: number(),
  width: number(),
  height: number(),
  startSeconds: nullable(number()),
  endSeconds: nullable(number()),
});
export type Region = Infer<typeof REGION_SCHEMA>;

export interface RegionProblem {
  field: string;
  reason: 'out_of_range' | 'empty_area' | 'exceeds_bounds';
}

/**
 * Vung phai NAM TRON trong khung hinh. Vung tran ra ngoai bi tu choi chu khong bi cat am tham:
 * cat am tham nghia la nguoi dung tuong da che mot vung ma thuc te che vung khac.
 */
export function validateRegion(region: Region): RegionProblem[] {
  const problems: RegionProblem[] = [];
  const inUnit = (n: number): boolean => Number.isFinite(n) && n >= 0 && n <= 1;
  if (!inUnit(region.x)) problems.push({ field: 'x', reason: 'out_of_range' });
  if (!inUnit(region.y)) problems.push({ field: 'y', reason: 'out_of_range' });
  if (!inUnit(region.width)) problems.push({ field: 'width', reason: 'out_of_range' });
  if (!inUnit(region.height)) problems.push({ field: 'height', reason: 'out_of_range' });
  if (problems.length > 0) return problems;
  if (region.width <= 0 || region.height <= 0) problems.push({ field: 'width', reason: 'empty_area' });
  if (region.x + region.width > 1) problems.push({ field: 'x', reason: 'exceeds_bounds' });
  if (region.y + region.height > 1) problems.push({ field: 'y', reason: 'exceeds_bounds' });
  return problems;
}

/* --------------------------------------------------------------- audio --- */

/**
 * `present: false` nghia la DA DO va khong thay. Khac han "chua do duoc" — cung bai hoc D-044.
 * Cac truong con lai `null` khi bo do khong doc duoc, KHONG dien so 0.
 */
export const AUDIO_TRACK_SCHEMA = object({
  present: boolean(),
  codec: nullable(string()),
  durationSeconds: nullable(number()),
  channelCount: nullable(number()),
});
export type AudioTrack = Infer<typeof AUDIO_TRACK_SCHEMA>;

/**
 * Dung sai thoi luong audio sau khi render (Q-P3-03) — CO CO SO DO DUOC.
 *
 * Do that tren 12 luot render (2 video x {mask, blur, crop 9:16, crop 16:9, crop 1:1, proxy}):
 *
 *   mask / blur / crop (moi ti le)  -> lech DUNG 0.000000 giay
 *   proxy (ma hoa lai audio)        -> lech 0.021995 giay
 *
 * Ly do khac nhau: duong render dung `-c:a copy` (SAO CHEP nguyen luong tieng) nen khong the
 * lech; chi duong proxy MA HOA LAI moi co sai so lam tron khung cuoi.
 *
 * 0,25 giay = khoang **11 lan** bien do lon nhat do duoc. Du rong de khong bao dong gia, du hep
 * de bat duoc audio bi cat that (mot doan tieng bi mat luon tinh bang phan muoi giay tro len).
 * Co test ghim ca hai con so; doi hang so nay la doi mot cho.
 */
export const AUDIO_DURATION_TOLERANCE_SECONDS = 0.25;

export type AudioVerdict =
  | 'preserved'
  | 'absent_by_design'
  | 'lost'
  | 'duration_drift'
  /** P3: so kenh doi (vd stereo bi ep ve mono). Tieng VAN CON nhung KHAC ban goc. */
  | 'channel_changed'
  | 'changed_by_preset'
  | 'unknown';

/**
 * So sanh audio truoc/sau. Quy tac quan trong nhat: input CO audio ma output KHONG co thi la
 * `lost` — va job khong duoc `completed`.
 *
 * Phan biet ro `absent_by_design` (video von khong co audio) voi `lost` (co roi mat). Gop hai cai
 * nay se lam mot loi that tro thanh binh thuong.
 */
export function compareAudio(
  before: AudioTrack,
  after: AudioTrack,
  options: { presetChangesAudio?: boolean; toleranceSeconds?: number } = {},
): AudioVerdict {
  if (!before.present && !after.present) return 'absent_by_design';
  if (before.present && !after.present) return 'lost';
  if (!before.present && after.present) return 'changed_by_preset';
  if (options.presetChangesAudio === true) return 'changed_by_preset';

  /*
   * So KENH. Truoc day `channelCount` co trong luoc do nhung `compareAudio` KHONG dung lan nao —
   * mot lo hong cua cong audio: stereo bi ep ve mono thi tieng VAN CON, thoi luong VAN DUNG, nen
   * moi phep kiem khac deu qua, va he thong se bao `preserved` cho mot ban da mat mot kenh tieng.
   *
   * Duong render hien tai dung `-c:a copy` nen khong doi kenh — nhung cong phai chan duoc dieu do
   * BAT KE duong nao trong tuong lai lam no doi (vd mot preset them `-ac 1`).
   *
   * Chi ket luan khi DO DUOC ca hai phia: `null` la "chua do", khong duoc suy ra la "khong doi".
   */
  if (
    before.channelCount !== null &&
    after.channelCount !== null &&
    before.channelCount !== after.channelCount
  ) {
    return 'channel_changed';
  }

  if (before.durationSeconds === null || after.durationSeconds === null) return 'unknown';
  const tolerance = options.toleranceSeconds ?? AUDIO_DURATION_TOLERANCE_SECONDS;
  return Math.abs(before.durationSeconds - after.durationSeconds) > tolerance ? 'duration_drift' : 'preserved';
}

/** Chi hai ket qua nay duoc phep di tiep toi `completed`. */
export function audioAllowsCompletion(verdict: AudioVerdict): boolean {
  return verdict === 'preserved' || verdict === 'absent_by_design';
}

/* -------------------------------------------------------------- preset --- */

/**
 * `status` noi ve dieu he thong TU DO DUOC, khong phai ve viec nen tang co chap nhan hay khong.
 * Khong bao gio dat `verified` tu tai lieu quang cao (Q-P3-04).
 */
export const EXPORT_PRESET_SCHEMA = object({
  id: string(),
  label: string(),
  aspectRatio: string(),
  targetResolution: nullable(string()),
  videoCodec: string(),
  audioCodec: string(),
  container: string(),
  maxDurationSeconds: nullable(number()),
  maxFileSizeBytes: nullable(number()),
  status: EVIDENCE_STATUS_SCHEMA,
  /** Tro toi ban ghi test da chung minh; null = chua co bang chung nao. */
  evidence: nullable(string()),
});
export type ExportPreset = Infer<typeof EXPORT_PRESET_SCHEMA>;

/* ------------------------------------------------------------- bien nhan --- */

/**
 * Bien nhan cua mot luot xu ly video. `outputVerified` la loi khai KIEM CHUNG DUOC: chi true sau
 * khi doc lai byte da ghi va do lai (I-2).
 */
export const VIDEO_RECEIPT_SCHEMA = object({
  jobId: string(),
  assetId: string(),
  originalAssetId: string(),
  operationMode: VIDEO_OPERATION_MODE_SCHEMA,
  presetId: nullable(string()),
  inputChecksum: nullable(string()),
  outputChecksum: nullable(string()),
  audioBefore: AUDIO_TRACK_SCHEMA,
  audioAfter: nullable(AUDIO_TRACK_SCHEMA),
  audioVerdict: string(),
  outputVerified: boolean(),
  /** null khi khong goi provider nao. KHONG BAO GIO `verified` neu chua co bang chung. */
  providerStatus: nullable(EVIDENCE_STATUS_SCHEMA),
  createdAt: string(),
  failureReason: nullable(string()),
  reviewReason: nullable(string()),
});
export type VideoReceipt = Infer<typeof VIDEO_RECEIPT_SCHEMA>;

/* ----------------------------------------------------- phan hoi cua API --- */

export const VIDEO_PROXY_SCHEMA = object({
  proxyAssetId: string(),
  originalAssetId: string(),
  widthPx: number(),
  heightPx: number(),
  durationSeconds: nullable(number()),
  byteSize: number(),
  hasAudio: boolean(),
});
export type VideoProxy = Infer<typeof VIDEO_PROXY_SCHEMA>;

export const VIDEO_JOB_VIEW_SCHEMA = object({
  jobId: string(),
  assetId: string(),
  state: JOB_STATE_SCHEMA,
  operationMode: nullable(VIDEO_OPERATION_MODE_SCHEMA),
  presetId: nullable(string()),
  regions: arrayOf(REGION_SCHEMA),
  outputAssetId: nullable(string()),
  /** Ly do co CAU TRUC, khong phai cau chu tu do. */
  reasonCode: nullable(string()),
  receipt: nullable(VIDEO_RECEIPT_SCHEMA),
  /** Ghi ro khi kho luu tru hien la dia tam — nguoi dung phai biet tep co the mat. */
  storageEphemeral: boolean(),
  blockedByQ23: optional(boolean()),
});
export type VideoJobView = Infer<typeof VIDEO_JOB_VIEW_SCHEMA>;

export const PRESET_LIST_SCHEMA = object({ presets: arrayOf(EXPORT_PRESET_SCHEMA) });
export type PresetList = Infer<typeof PRESET_LIST_SCHEMA>;
