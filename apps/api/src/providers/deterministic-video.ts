/**
 * DeterministicVideoProvider — xu ly video TAT DINH bang ffmpeg (P3-MCP-30…34).
 *
 * Song song voi `DeterministicImageProvider` cua P2-MCP-27 va theo dung cung nguyen tac:
 * khong goi mo hinh AI nao, khong ton tien moi lan chay, ket qua lap lai duoc.
 *
 * Lam duoc tren VIDEO: `brand_overlay` (static mask, to dac mot vung) · `crop` · `blur`.
 * KHONG lam: `inpaint`, `tracked_inpaint`, `visible_logo_cleanup`, `object_cleanup` — nhung thu
 * do can bam chuyen dong hoac mo hinh AI, thuoc Phase 4. Tu khai `unknown` con hon khai bua.
 *
 * Diem khac quan trong nhat so voi ban anh: AUDIO. Moi duong ghi deu `-c:a copy` (sao chep nguyen
 * luong tieng). Va sau khi render, `renderVideo` DO LAI audio tren byte ket qua — de bai cam xuat
 * video khi audio bi mat ngoai y muon, nen cho do phai la mot phep DO chu khong phai loi hua.
 */
import { createHash } from 'node:crypto';
import {
  ERROR_CODES,
  VIDEO_OPERATION_MODES,
  type AudioTrack,
  type CleanupOperation,
  type MediaProcessingProvider,
  type MediaType,
  type NormalizedRegion,
  type ProviderCapability,
  type ProviderEstimate,
  type ProviderEstimateInput,
  type ProviderJobReference,
  type ProviderJobStatus,
  type ProviderResult,
  type VideoOperationMode,
} from '@mediaclear/contracts';
import { renderVideo, ffmpegAvailable, type VideoProbe } from '../media/ffmpeg.js';

/** Thao tac lam duoc, va lam duoc tren loai media nao. Chi VIDEO. */
const SUPPORTED: ReadonlyArray<{ operation: CleanupOperation; mediaType: MediaType }> = [
  { operation: 'brand_overlay', mediaType: 'video' },
  { operation: 'crop', mediaType: 'video' },
  { operation: 'blur', mediaType: 'video' },
];

/**
 * Anh xa thao tac cua he thong sang ba che do cua Phase 3.
 *
 * `brand_overlay` = static mask: to DAC mot vung co dinh. Day dung la cach Q-15 da chot
 * ("static mask map vao `blur`/`brand_overlay` tren mot vung co dinh") — khong tao enum moi.
 */
export function operationToMode(operation: CleanupOperation): VideoOperationMode | null {
  if (operation === 'brand_overlay') return 'mask';
  if (operation === 'crop') return 'crop';
  if (operation === 'blur') return 'blur';
  return null;
}

export interface ProcessedVideo {
  bytes: Uint8Array;
  mimeType: string;
  byteSize: number;
  checksumSha256: string;
  widthPx: number | null;
  heightPx: number | null;
  durationSeconds: number | null;
  audioBefore: AudioTrack;
  audioAfter: AudioTrack;
  mode: VideoOperationMode;
}

interface Pending {
  status: 'succeeded';
}

export class DeterministicVideoProvider implements MediaProcessingProvider {
  readonly id = 'deterministic-video';
  /** Xu ly byte that va tra ra video that => duoc phep phuc vu traffic that. */
  readonly isProductionProvider = true;
  /** KHONG dung AI. Giong ban anh: chay bang ffmpeg tren may cua chinh minh. */
  readonly usesAiModel = false;

  private readonly pending = new Map<string, Pending>();

  capabilities(): ProviderCapability[] {
    return SUPPORTED.map(({ operation, mediaType }) => ({
      operation,
      mediaType,
      support: 'verified',
      maxDurationSeconds: null,
      maxWidthPx: null,
      notes: 'Xu ly tat dinh bang ffmpeg; khong goi dich vu AI nao; audio sao chep nguyen luong.',
    }));
  }

  estimate(input: ProviderEstimateInput): ProviderEstimate {
    const supported = SUPPORTED.some((s) => s.operation === input.operation && s.mediaType === input.mediaType);
    if (!supported) {
      return { costUsd: null, costEvidence: 'unknown', etaSeconds: null, etaEvidence: 'unknown' };
    }
    // Chay tren may minh => khong co chi phi goi dich vu ngoai. Thoi gian thi PHU THUOC do dai
    // video nen khong doan: `unknown`, khong dien mot con so cho du truong.
    return { costUsd: 0, costEvidence: 'verified', etaSeconds: null, etaEvidence: 'unknown' };
  }

  async submit(): Promise<ProviderJobReference> {
    const id = `dvid_${createHash('sha256').update(String(Date.now() + Math.random())).digest('hex').slice(0, 24)}`;
    this.pending.set(id, { status: 'succeeded' });
    return { providerId: this.id, externalJobId: id, submittedAt: new Date().toISOString() };
  }

  async getStatus(ref: ProviderJobReference): Promise<ProviderJobStatus> {
    const entry = this.pending.get(ref.externalJobId);
    if (!entry) return { state: 'failed', progressPercent: null, errorCode: ERROR_CODES.MCP_PROVIDER_RESULT_MISSING };
    return { state: 'succeeded', progressPercent: 100, errorCode: null };
  }

  async getResult(): Promise<ProviderResult> {
    /*
     * Ban tat dinh chay TRONG tien trinh nay: khong co URL nao de lay ve. Tra `outputUrl: null`
     * kem `evidenceStatus: 'unconfirmed'` thay vi bia mot URL — hop dong noi ro khong duoc tra
     * URL rong roi bao thanh cong.
     */
    return {
      outputUrl: null,
      modelVersion: null,
      actualCostUsd: 0,
      latencyMs: null,
      evidenceStatus: 'unconfirmed',
      errorCode: null,
    };
  }

  supports(operation: CleanupOperation, mediaType: MediaType): boolean {
    return SUPPORTED.some((s) => s.operation === operation && s.mediaType === mediaType);
  }

  /** Phai hoi TRUOC khi nhan job: thieu ffmpeg thi day la `blocked`, khong phai `failed`. */
  async ready(): Promise<boolean> {
    return ffmpegAvailable();
  }

  /**
   * Xu ly THAT tren byte. Tra video MOI — khong bao gio sua video dau vao (I-1).
   *
   * `regions` la toa do CHUAN HOA 0..1 nen doc lap do phan giai: vung chon tren ban proxy nho ap
   * dung dung len ban goc lon.
   */
  async process(
    source: Uint8Array,
    operation: CleanupOperation,
    regions: readonly NormalizedRegion[],
    options: { cropAspect?: string | null } = {},
  ): Promise<ProcessedVideo> {
    const mode = operationToMode(operation);
    if (mode === null || !this.supports(operation, 'video')) {
      throw new Error(ERROR_CODES.MCP_PROVIDER_CAPABILITY_UNSUPPORTED);
    }
    if (mode !== 'crop' && regions.length === 0) {
      // Mask/blur ma khong co vung thi khong biet che cho nao. Tu choi con hon che bua ca khung.
      throw new Error(ERROR_CODES.MCP_VAL_REQUEST_INVALID);
    }

    const rendered = await renderVideo(source, {
      mode,
      regions,
      cropAspect: options.cropAspect ?? null,
    });

    const audioBefore = await audioOf(source);
    return {
      bytes: rendered.bytes,
      mimeType: 'video/mp4',
      byteSize: rendered.byteSize,
      checksumSha256: createHash('sha256').update(Buffer.from(rendered.bytes)).digest('hex'),
      widthPx: rendered.probe.widthPx,
      heightPx: rendered.probe.heightPx,
      durationSeconds: rendered.probe.durationSeconds,
      audioBefore,
      audioAfter: rendered.probe.audio,
      mode,
    };
  }
}

/** Tach ra de `process` chi co mot cho doc audio dau vao. */
async function audioOf(source: Uint8Array): Promise<AudioTrack> {
  const { probeVideo } = await import('../media/ffmpeg.js');
  const probe: VideoProbe = await probeVideo(source);
  return probe.audio;
}

/** Chi de test khang dinh y dinh: ba che do, khong cai nao mang ten AI. */
export const VIDEO_MODES = VIDEO_OPERATION_MODES;
