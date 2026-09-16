/**
 * Lich kiem LUC CHAY cho TOAN BO phan hoi ma giao dien doc (dong not D-047).
 *
 * `D-051` da dong lo hong nay cho cac endpoint Phase 3. Tep nay dong phan con lai.
 *
 * Vi sao can: truoc day moi man hinh TU KHAI lai hinh dang phan hoi bang `apiFetch<T>` — mot loi
 * khang dinh kieu khong ai kiem. Hau qua do duoc, khong phai gia dinh:
 *
 *  - `MeResponse` duoc khai BA KIEU khac nhau o ba tep (co `email` o trang nay, khong co o trang kia)
 *  - `UsageResponse` khai 4 truong o `page.tsx` va 7 truong o `usage/page.tsx`
 *  - `AssetView` khai mot mau o `upload/page.tsx` va mau khac o `assets/[assetId]/page.tsx`
 *
 * Khong ban nao trong so do duoc doi chieu voi may chu. Doi hinh dang phan hoi lam trang hong LUC
 * CHAY trong khi `tsc` ca hai ben deu xanh — da xay ra that o trang Hoat dong (D-047).
 *
 * Nguyen tac: truong THUA bi bo qua (may chu them field khong lam hong giao dien cu), truong
 * THIEU bao loi — do moi la thu pha giao dien. Nen mot man hinh chi dung mot phan phan hoi VAN
 * dung duoc lich kiem day du.
 */
import { arrayOf, boolean, nullable, number, object, optional, string } from './schema.js';
import { JOB_STATE_SCHEMA } from './phase3.js';
import type { Infer } from './schema.js';

/* ------------------------------------------------------------- chung --- */

/** Loi tra ve cho client: `messageKey` la KHOA i18n, khong phai cau da dich. */
export const API_ERROR_SCHEMA = object({
  code: string(),
  messageKey: string(),
  params: optional(object({})),
});

const ID_NAME = { id: string(), name: string() };

/* -------------------------------------------------------- phien / me --- */

export const SESSION_RESPONSE_SCHEMA = object({
  token: string(),
  userId: string(),
  expiresAt: string(),
  productionAuthProvider: boolean(),
});
export type SessionResponse = Infer<typeof SESSION_RESPONSE_SCHEMA>;

export const ME_RESPONSE_SCHEMA = object({
  user: object({
    id: string(),
    email: string(),
    displayName: string(),
    defaultLocale: string(),
  }),
  workspaces: arrayOf(object({ ...ID_NAME, role: string() })),
});
export type MeResponse = Infer<typeof ME_RESPONSE_SCHEMA>;

/* ------------------------------------------------ workspace / project --- */

export const WORKSPACE_LIST_SCHEMA = object({
  items: arrayOf(object({ ...ID_NAME, role: string() })),
});

/*
 * Hai route nay tra object PHANG, khong boc trong `workspace:`/`project:`.
 *
 * Ban dau toi khai chung la `{ workspace: {...} }` — va phep kiem lap tuc bat sai. Day dung la
 * ly do lich kiem ton tai: mot `interface` viet tay se im lang chap nhan hinh dang sai cho toi
 * khi nguoi dung bam vao va trang hong.
 */
export const WORKSPACE_CREATED_SCHEMA = object({ ...ID_NAME, role: string() });
export const PROJECT_CREATED_SCHEMA = object({ ...ID_NAME, createdAt: string() });

export const PROJECT_LIST_SCHEMA = object({
  items: arrayOf(object({ ...ID_NAME, createdAt: string() })),
  nextCursor: nullable(string()),
});

export const PROJECT_DETAIL_SCHEMA = object({ ...ID_NAME, createdAt: string() });

export const ASSET_LIST_SCHEMA = object({
  items: arrayOf(object({ id: string(), mediaType: string(), createdAt: string() })),
  nextCursor: nullable(string()),
});

/* ----------------------------------------------------------- tep goc --- */

/** `measured` la `null` khi CHUA co byte nao ve — khong phai so 0. */
export const MEASURED_SCHEMA = object({
  mimeType: string(),
  byteSize: number(),
  checksumSha256: string(),
  mediaType: string(),
  durationSeconds: nullable(number()),
  widthPx: nullable(number()),
  heightPx: nullable(number()),
  hasAudioStream: nullable(boolean()),
  corrupt: boolean(),
});

export const ASSET_VIEW_SCHEMA = object({
  asset: object({ id: string(), mediaType: string(), projectId: string() }),
  sourceFile: object({
    originalFilename: string(),
    declaredMimeType: string(),
    uploadState: string(),
    measured: nullable(MEASURED_SCHEMA),
  }),
  validation: object({
    state: string(),
    errors: arrayOf(API_ERROR_SCHEMA),
    validatedAt: nullable(string()),
  }),
  rightsAttestation: object({
    status: string(),
    attestedAt: nullable(string()),
    statementVersion: nullable(number()),
  }),
});

export const RETENTION_VIEW_SCHEMA = object({
  assetId: string(),
  retentionState: string(),
  lastAccessedAt: nullable(string()),
  retainUntil: nullable(string()),
  deletionCandidate: boolean(),
  reason: nullable(string()),
});

export const UPLOAD_INTENT_SCHEMA = object({
  assetId: string(),
  sourceFileId: string(),
  uploadUrl: string(),
  expiresAt: optional(string()),
});

export const VALIDATION_RESULT_SCHEMA = object({
  assetId: string(),
  valid: boolean(),
  errors: arrayOf(API_ERROR_SCHEMA),
});

export const RIGHTS_STATEMENT_SCHEMA = object({
  statement: object({
    id: string(),
    version: number(),
    i18nKey: string(),
    validityDays: number(),
  }),
});

/* --------------------------------------------------------- muc dung --- */

export const USAGE_SUMMARY_SCHEMA = object({
  workspaceId: string(),
  imageUnitsCommitted: number(),
  videoMinuteUnitsCommitted: number(),
  imageUnitsReserved: number(),
  videoMinuteUnitsReserved: number(),
  /** P1.1: da qua han giu nhung chua hoan tra — KHONG dem nhu dang giu. */
  imageUnitsExpired: number(),
  videoMinuteUnitsExpired: number(),
  entries: arrayOf(object({
    id: string(),
    jobId: string(),
    unitType: string(),
    quantity: number(),
    entryType: string(),
    reasonCode: nullable(string()),
    recordedAt: string(),
  })),
});

/* -------------------------------------------------------------- job --- */

export const JOB_VIEW_SCHEMA = object({
  job: object({
    id: string(),
    assetId: string(),
    state: JOB_STATE_SCHEMA,
    reasonCode: nullable(string()),
    blockReasonKind: nullable(string()),
    request: object({ operations: arrayOf(string()) }),
    outputAssetId: nullable(string()),
  }),
  providerCapability: string(),
  productionProcessingEnabled: boolean(),
  usage: object({
    unitType: string(),
    quantity: number(),
    state: string(),
    expiresAt: nullable(string()),
  }),
});

export const JOB_CREATED_SCHEMA = object({ job: object({ id: string(), state: JOB_STATE_SCHEMA }) });

export const SIGNED_URL_SCHEMA = object({
  url: string(),
  expiresAt: optional(string()),
  byteSize: optional(number()),
  checksumSha256: optional(string()),
});

/* -------------------------------------------------------- nhat ky --- */

export const AUDIT_PAGE_SCHEMA = object({
  items: arrayOf(object({
    id: string(),
    eventType: string(),
    subjectType: string(),
    subjectId: nullable(string()),
    occurredAt: string(),
  })),
  nextCursor: nullable(string()),
});

/* ------------------------------------------- ban ket qua / bien nhan --- */

export const JOB_OUTPUT_SCHEMA = object({
  outputAssetId: string(),
  mimeType: string(),
  byteSize: number(),
  checksumSha256: string(),
  /** I-2: chi true SAU KHI doc lai byte va do lai. */
  validated: boolean(),
  createdAt: string(),
});

const AUDIO_ROW_SCHEMA = object({
  present: boolean(),
  codec: nullable(string()),
  durationSeconds: nullable(number()),
  channelCount: nullable(number()),
});

const PROVENANCE_ROW_SCHEMA = object({
  id: string(),
  originalMetadataPresence: string(),
  aiProvenancePresence: string(),
  /** KHOA i18n, khong phai cau chu — giao dien phai `translate()` no. */
  limitationNote: nullable(string()),
  evidenceStatus: string(),
});

export const JOB_RECEIPT_SCHEMA = object({
  receipt: object({
    id: string(),
    jobId: string(),
    operations: arrayOf(string()),
    evidenceStatus: string(),
    provenanceBeforeId: string(),
    provenanceAfterId: nullable(string()),
    invisibleWatermarkDisclaimerKey: string(),
    /* P3: `null` voi bien nhan ANH — "khong ap dung", khong phai "chua do duoc". */
    operationMode: nullable(string()),
    presetId: nullable(string()),
    audioBefore: nullable(AUDIO_ROW_SCHEMA),
    audioAfter: nullable(AUDIO_ROW_SCHEMA),
    audioVerdict: nullable(string()),
    outputVerified: boolean(),
    reviewReason: nullable(string()),
  }),
  provenanceBefore: PROVENANCE_ROW_SCHEMA,
  provenanceAfter: nullable(PROVENANCE_ROW_SCHEMA),
});

export const JOB_PREVIEW_SCHEMA = object({
  mode: string(),
  /** Luon false (I-12). Loi TU KHAI kiem tra duoc tu ben ngoai. */
  billable: boolean(),
  operation: string(),
  widthPx: number(),
  heightPx: number(),
  byteSize: number(),
  imageDataUri: string(),
});
