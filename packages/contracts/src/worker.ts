/**
 * MediaClear Pro - Worker & client extension points (theo yeu cau owner 2026-09-15).
 *
 * Phase 0 KHONG tao Python service va KHONG tao Chrome Extension.
 * File nay chi chot ranh gioi de hai thu do gan vao o phase sau ma khong pha domain:
 *
 * 1) WorkerJobEnvelope: payload JSON thuan, khong chua kieu rieng cua Node/TS runtime
 *    => mot media worker Python doc duoc truc tiep tu queue/HTTP. Version hoa bang
 *    'envelopeVersion' de doi contract ma khong lam chet worker cu.
 *
 * 2) ApiClientKind: moi client (web hom nay, Chrome Extension sau nay) deu di qua
 *    CUNG API. Khong co field nao danh rieng cho extension, khong co engine rieng
 *    (guardrail 12).
 */
import type { CleanupOperation, MediaType } from './vocabulary.js';
import type { NormalizedRegion } from './provider.js';

export const WORKER_ENVELOPE_VERSION = 1 as const;

export interface WorkerJobEnvelope {
  envelopeVersion: typeof WORKER_ENVELOPE_VERSION;
  jobId: string;
  workspaceId: string;
  mediaType: MediaType;
  operations: CleanupOperation[];
  regions: NormalizedRegion[];
  /** URL co thoi han. Worker khong duoc tu truy cap storage bang credential rieng. */
  sourceUrl: string;
  outputUploadUrl: string;
  preserveOriginalMetadata: true;
  preserveAiProvenance: true;
  idempotencyKey: string;
  /** Deadline tuyet doi, ISO-8601. Worker qua han phai tra failed, khong tu gia han. */
  deadlineAt: string;
}

export interface WorkerResultEnvelope {
  envelopeVersion: typeof WORKER_ENVELOPE_VERSION;
  jobId: string;
  status: 'succeeded' | 'failed';
  outputStorageKey: string | null;
  outputChecksumSha256: string | null;
  /** Worker phai bao cao lai thuc te metadata sau xu ly, khong duoc mac dinh 'preserved'. */
  metadataPreservedReported: boolean | null;
  audioStreamPresentReported: boolean | null;
  errorCode: string | null;
  latencyMs: number | null;
}

/** Cac loai client duoc phep goi API. Extension tuong lai chi them gia tri o day. */
export const API_CLIENT_KINDS = ['web', 'chrome_extension'] as const;
export type ApiClientKind = (typeof API_CLIENT_KINDS)[number];

/**
 * Phase 0: chi 'web' duoc kich hoat. 'chrome_extension' da co cho trong vocabulary
 * nhung trang thai la 'planned' - chua co implementation nao.
 */
export const ENABLED_API_CLIENT_KINDS: readonly ApiClientKind[] = ['web'];
