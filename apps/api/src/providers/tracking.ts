/**
 * MCP-41 — cong cho provider theo doi vung di chuyen, va mot ban GIA TAT DINH.
 *
 * KET LUAN BUOC 0 (khao sat truoc khi viet ma): repository **khong co** provider tracking nao, va
 * `PROVIDER_BENCHMARK.md` ghi ro **chua chay benchmark nao** — moi o so lieu la `unknown`. Vi vay:
 *
 *  - khong goi thang mot API cu the nao; toan bo pipeline noi qua cong nay;
 *  - provider that duoc ghi la `blocked`, KHONG phai `verified`;
 *  - ban gia duoi day la TAT DINH, de test kiem duoc hanh vi pipeline ma khong can AI.
 *
 * RUI RO NATIVE BINDING (cau 3 cua Buoc 0): mot bo tracking that se keo theo OpenCV binding hoac
 * ONNX runtime — deu la native, dung dang rui ro da lam hong build Docker o `D-039` (argon2 ->
 * scrypt). Ban gia nay **khong co phu thuoc native nao**, nen Phase 4 chay tron ven trong anh Docker
 * hien tai. Khi chon provider that, rui ro build phai duoc danh gia TRUOC.
 */
import type { MaskBox, MaskSource } from '@mediaclear/contracts';

export interface TrackFrameInput {
  frameIndex: number;
  /** Vi tri o frame truoc — diem xuat phat de suy vi tri moi. */
  previous: MaskBox;
  ptsSeconds: number | null;
}

export interface TrackFrameOutput {
  /** false = provider that bai/qua han cho frame nay. */
  ok: boolean;
  box: MaskBox | null;
  /**
   * Do tin cay [0,1]. `null` nghia la provider KHONG tra ve so nao.
   *
   * `null` khac han `0`: `0` la "do duoc va rat thap", `null` la "khong do duoc". Nham hai cai la
   * lap lai `D-044` o mot tang khac.
   */
  confidence: number | null;
  source: MaskSource;
}

export interface MotionTrackingProvider {
  id: string;
  /** false = chi dung cho dev/test, khong duoc phuc vu traffic that. */
  readonly isProductionProvider: boolean;
  trackFrame(input: TrackFrameInput): Promise<TrackFrameOutput>;
}

export interface DeterministicTrackingOptions {
  /** Do dich moi frame theo truc x (ti le khung hinh). 0 = logo dung yen. */
  driftPerFrame?: number;
  /** Frame bi che khuat -> confidence thap. */
  occludedFrames?: readonly number[];
  /** Frame provider qua han -> `ok: false`. */
  timeoutFrames?: readonly number[];
  /** Frame provider khong tra confidence -> `null`. */
  noConfidenceFrames?: readonly number[];
  confidence?: number;
  lowConfidence?: number;
}

/**
 * Provider GIA, tat dinh.
 *
 * Tat dinh la yeu cau bat buoc chu khong phai tien nghi: mot provider ngau nhien lam test cho ra
 * ket qua khac nhau moi lan chay, va khi do khong ai phan biet duoc "pipeline hong" voi "hom nay
 * provider doan kem".
 */
export class DeterministicTrackingProvider implements MotionTrackingProvider {
  readonly id = 'deterministic-tracking';
  /** Noi that: day KHONG phai provider production. `/healthz` va tai lieu deu doc truong nay. */
  readonly isProductionProvider = false;

  constructor(private readonly options: DeterministicTrackingOptions = {}) {}

  async trackFrame(input: TrackFrameInput): Promise<TrackFrameOutput> {
    const o = this.options;
    if (o.timeoutFrames?.includes(input.frameIndex)) {
      // Qua han: KHONG duoc doan vi tri. Tra ve that bai va de tang tren danh dau `frame_failed`.
      return { ok: false, box: null, confidence: null, source: 'tracked' };
    }
    const drift = o.driftPerFrame ?? 0;
    const box: MaskBox = {
      x: input.previous.x + drift,
      y: input.previous.y,
      width: input.previous.width,
      height: input.previous.height,
    };
    if (o.noConfidenceFrames?.includes(input.frameIndex)) {
      return { ok: true, box, confidence: null, source: 'tracked' };
    }
    const occluded = o.occludedFrames?.includes(input.frameIndex) ?? false;
    return {
      ok: true,
      box,
      confidence: occluded ? (o.lowConfidence ?? 0.2) : (o.confidence ?? 0.95),
      source: 'tracked',
    };
  }
}
