/**
 * MediaClear Pro - Centralized limits & policy constants.
 *
 * NGUON SU THAT DUY NHAT cho moi gia tri gioi han. Cam hard-code lai o bat ky
 * lop nao khac (validation, API, UI, worker, docs deu doc tu day).
 *
 * Owner decisions 2026-09-15 (Q-03, Q-09): xem docs/DECISIONS.md D-018, D-022.
 * Quy uoc: 1 MB = 1 MiB = 1024 * 1024 bytes.
 */

/** 199 MB. Gia tri toi da HOP LE (inclusive): dung 199 MB van duoc chap nhan. */
export const MAX_FILE_SIZE_BYTES = 199 * 1024 * 1024; // 208_666_624

/** 09:59 = 599 giay. Inclusive: 599 duoc chap nhan, 600 (10:00) bi tu choi. */
export const MAX_VIDEO_DURATION_SECONDS = 599;

/** Inclusive. */
export const MAX_VIDEO_WIDTH = 3840;
export const MAX_VIDEO_HEIGHT = 3840;

export const SUPPORTED_IMAGE_FORMATS = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const SUPPORTED_VIDEO_FORMATS = ['video/mp4', 'video/quicktime', 'video/webm'] as const;

/** Gioi han anh - giu nguyen tu Phase 0 (khong nam trong owner decision Q-03). */
export const MAX_IMAGE_DIMENSION_PX = 8000;
export const MIN_IMAGE_DIMENSION_PX = 64;

/** Q-09: attestation cap asset, hieu luc 365 ngay. */
export const RIGHTS_ATTESTATION_VALIDITY_DAYS = 365;

/** Q-10: preview mien phi, khong tinh vao usage. */
export const PREVIEW_IS_BILLABLE = false;

/** Q-10: video lam tron LEN theo phut xu ly. */
export const VIDEO_USAGE_ROUNDING = 'ceil_minute' as const;

export type SupportedImageFormat = (typeof SUPPORTED_IMAGE_FORMATS)[number];
export type SupportedVideoFormat = (typeof SUPPORTED_VIDEO_FORMATS)[number];

/* ------------------------------------------------ Phase 1.1 hardening --- */

/**
 * Q-17: reservation KHONG duoc song vo thoi han. 30 phut.
 * Bien inclusive: dung 1800 giay van con hieu luc, 1801 giay moi het han.
 */
export const USAGE_RESERVATION_TTL_SECONDS = 1800;

/**
 * Q-18 - retention policy v1. Moi lop du lieu mot luat rieng, khong lop nao an theo lop khac.
 * Source/output tinh theo LAN TRUY CAP CUOI, khong phai ngay tao.
 */
export const SOURCE_OUTPUT_RETENTION_DAYS = 30;
export const FAILED_INTERMEDIATE_RETENTION_DAYS = 7;
export const PREVIEW_PROXY_RETENTION_HOURS = 24;
export const AUDIT_RETENTION_DAYS = 365;
export const USAGE_LEDGER_RETENTION_MONTHS = 24;
export const DELETED_TOMBSTONE_RETENTION_DAYS = 30;

/** Phien ban luat luu giu dang ap dung; ghi lai tren tung ban ghi de biet ap luat nao. */
export const RETENTION_POLICY_VERSION = 1;
