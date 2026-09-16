/**
 * DeterministicImageProvider - xu ly anh TAT DINH bang sharp (P2-MCP-27).
 *
 * Owner decision Q-06 (2026-09-16): lam thao tac tat dinh TRUOC, chua chon provider AI.
 * Nho vay job di den `completed` ma khong phu thuoc mot dich vu AI nao, khong ton tien moi lan
 * goi, va ket qua LAP LAI DUOC - cung dau vao cho ra cung dau ra.
 *
 * Lam duoc: `crop` · `blur` · `brand_overlay` tren ANH.
 * KHONG lam: mo ta ngu nghia (`visible_logo_cleanup`, `inpaint`, ...) va moi thao tac tren VIDEO.
 * Nhung thu do can AI hoac pipeline khung hinh - tu khai `support: 'unknown'` con hon khai bua
 * roi tra ve mot ket qua sai lam.
 *
 * `preserveOriginalMetadata` va `preserveAiProvenance` la `true` CO DINH (guardrail 6, 7):
 * sharp mac dinh XOA metadata, nen moi duong ghi deu phai goi `.withMetadata()`. Quen mot cho la
 * vi pham cam ket giu nguyen thong tin goc ma khong ai nhan ra ngay.
 */
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import {
  ERROR_CODES,
  type MediaProcessingProvider,
  type MediaType,
  type NormalizedRegion,
  type ProviderCapability,
  type ProviderEstimate,
  type ProviderEstimateInput,
  type ProviderJobReference,
  type ProviderJobStatus,
  type ProviderResult,
  type CleanupOperation,
} from '@mediaclear/contracts';

/** Do mo cua vung che. Du de khong doc duoc chu, khong lon toi muc bien thanh mang mau. */
const BLUR_SIGMA = 18;

/** Thao tac lam duoc, va lam duoc tren loai media nao. */
const SUPPORTED: ReadonlyArray<{ operation: CleanupOperation; mediaType: MediaType }> = [
  { operation: 'crop', mediaType: 'image' },
  { operation: 'blur', mediaType: 'image' },
  { operation: 'brand_overlay', mediaType: 'image' },
];

export interface ProcessedImage {
  bytes: Uint8Array;
  mimeType: string;
  byteSize: number;
  checksumSha256: string;
  widthPx: number;
  heightPx: number;
}

/** Ket qua giu trong bo nho giua `submit()` va `getResult()`. */
interface Pending {
  status: ProviderJobStatus;
  result: ProviderResult;
}

export class DeterministicImageProvider implements MediaProcessingProvider {
  readonly id = 'deterministic-image';
  /**
   * TU KHAI la provider production. Khac `NoopContractProvider` (`false`): day xu ly byte that
   * va tra ra anh that, nen no duoc phep phuc vu traffic that.
   */
  readonly isProductionProvider = true;
  /**
   * KHONG dung AI. Day la diem quan trong nhat cua provider nay: no phuc vu traffic that
   * nhung chay hoan toan bang libvips tren may cua chinh minh - khong goi mo hinh nao,
   * khong ton tien moi lan chay, va cho ket qua LAP LAI DUOC.
   */
  readonly usesAiModel = false;

  private readonly pending = new Map<string, Pending>();

  capabilities(): ProviderCapability[] {
    return SUPPORTED.map(({ operation, mediaType }) => ({
      operation,
      mediaType,
      // 'verified' vi da co test chay that tren byte that, khong phai loi khai suong.
      support: 'verified',
      maxDurationSeconds: null,
      maxWidthPx: null,
      notes: 'Xu ly tat dinh bang libvips; khong goi dich vu AI nao.',
    }));
  }

  estimate(input: ProviderEstimateInput): ProviderEstimate {
    // Chay tren may cua chinh minh => khong co chi phi goi dich vu ngoai. `0` la so THAT,
    // khong phai cho du truong: co bang chung vi khong he co loi goi ra ngoai nao.
    const supported = SUPPORTED.some(
      (s) => s.operation === input.operation && s.mediaType === input.mediaType,
    );
    if (!supported) {
      return { costUsd: null, costEvidence: 'unknown', etaSeconds: null, etaEvidence: 'unknown' };
    }
    return { costUsd: 0, costEvidence: 'verified', etaSeconds: 1, etaEvidence: 'unconfirmed' };
  }

  async submit(): Promise<ProviderJobReference> {
    // Cong nay nhan URL. Tang tren (`runJob`) doc byte roi goi `process()` truc tiep, nen
    // `submit()` chi dung cho cac duong goi theo dung hop dong provider.
    throw new Error(
      `${ERROR_CODES.MCP_PROVIDER_CAPABILITY_UNSUPPORTED}: DeterministicImageProvider xu ly tai cho, dung process()`,
    );
  }

  async getStatus(ref: ProviderJobReference): Promise<ProviderJobStatus> {
    return (
      this.pending.get(ref.externalJobId)?.status ?? {
        state: 'failed',
        progressPercent: null,
        errorCode: ERROR_CODES.MCP_PROVIDER_RESULT_MISSING,
      }
    );
  }

  async getResult(ref: ProviderJobReference): Promise<ProviderResult> {
    return (
      this.pending.get(ref.externalJobId)?.result ?? {
        outputUrl: null,
        modelVersion: null,
        actualCostUsd: null,
        latencyMs: null,
        evidenceStatus: 'unknown',
        errorCode: ERROR_CODES.MCP_PROVIDER_RESULT_MISSING,
      }
    );
  }

  supports(operation: CleanupOperation, mediaType: MediaType): boolean {
    return SUPPORTED.some((s) => s.operation === operation && s.mediaType === mediaType);
  }

  /**
   * Xu ly THAT tren byte. Tra ra anh MOI - khong bao gio sua anh dau vao (bat bien I-1).
   *
   * `regions` la toa do CHUAN HOA 0..1 nen doc lap do phan giai: cung mot vung cho ket qua
   * giong nhau du anh to hay nho.
   */
  async process(
    source: Uint8Array,
    operation: CleanupOperation,
    regions: readonly NormalizedRegion[],
  ): Promise<ProcessedImage> {
    const input = Buffer.from(source);
    const meta = await sharp(input).metadata();
    const width = meta.width;
    const height = meta.height;
    if (!width || !height) {
      throw new Error(ERROR_CODES.MCP_VAL_DIMENSION_UNKNOWN);
    }

    let pipeline = sharp(input);

    if (operation === 'crop') {
      const box = pixelBox(regions[0], width, height);
      if (!box) throw new Error(ERROR_CODES.MCP_VAL_REQUEST_INVALID);
      pipeline = pipeline.extract(box);
    } else {
      // blur / brand_overlay: ghep cac mieng da xu ly de len anh goc, giu nguyen phan con lai.
      const overlays = [];
      for (const region of regions) {
        const box = pixelBox(region, width, height);
        if (!box) continue;
        const piece =
          operation === 'blur'
            ? await sharp(input).extract(box).blur(BLUR_SIGMA).toBuffer()
            : await solidPatch(box.width, box.height);
        overlays.push({ input: piece, left: box.left, top: box.top });
      }
      if (overlays.length === 0) throw new Error(ERROR_CODES.MCP_VAL_REQUEST_INVALID);
      pipeline = pipeline.composite(overlays);
    }

    // `.withMetadata()` la BAT BUOC: sharp mac dinh xoa sach metadata, ma he thong cam ket
    // giu nguyen thong tin goc (guardrail 6).
    const bytes = await pipeline.withMetadata().png().toBuffer();
    const outMeta = await sharp(bytes).metadata();
    return {
      bytes: new Uint8Array(bytes),
      mimeType: 'image/png',
      byteSize: bytes.byteLength,
      checksumSha256: createHash('sha256').update(bytes).digest('hex'),
      widthPx: outMeta.width ?? 0,
      heightPx: outMeta.height ?? 0,
    };
  }
}

/** Mang mau xam dac, dung cho `brand_overlay` khi chua co logo thay the. */
function solidPatch(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 32, g: 34, b: 38, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

/**
 * Doi vung chuan hoa 0..1 sang o pixel, va KEP vao trong anh.
 *
 * Tra null thay vi nem loi khi vung khong hop le: caller quyet dinh coi do la loi hay bo qua.
 * Lam tron xuong roi kep de khong bao gio xin sharp mot o vuot ra ngoai anh - sharp se nem loi
 * kho hieu, con nguoi dung thi chi thay "xu ly that bai".
 */
function pixelBox(
  region: NormalizedRegion | undefined,
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number } | null {
  if (!region) return null;
  const left = clamp(Math.floor(region.x * width), 0, width - 1);
  const top = clamp(Math.floor(region.y * height), 0, height - 1);
  const w = clamp(Math.floor(region.width * width), 1, width - left);
  const h = clamp(Math.floor(region.height * height), 1, height - top);
  if (w < 1 || h < 1) return null;
  return { left, top, width: w, height: h };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}
