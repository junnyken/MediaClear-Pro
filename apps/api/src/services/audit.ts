/**
 * Audit service (muc 13 prompt Phase 1).
 *
 * Ghi: request id, workspace, user, subject, operation, ket qua, ma loi, thoi gian.
 * KHONG ghi: byte media, API key, session token, mat khau, signed URL day du.
 * Redaction la bat buoc va co test rieng - khong dua vao "nho khong log".
 */
import type { AuditEvent } from '@mediaclear/contracts';
import type { PersistencePort } from '../persistence/port.js';
import { newId, nowIso } from '../ids.js';

export type AuditDetail = Record<string, string | number | boolean | null>;

const FORBIDDEN_KEY = /(token|secret|password|authorization|api[_-]?key|signature|cookie)/i;
/** Chuoi trong detail bi cat ngan: audit khong phai cho de nhet du lieu. */
const MAX_VALUE_LENGTH = 200;
const URL_LIKE = /^https?:\/\//i;

export function redactAuditDetail(detail: Record<string, unknown>): AuditDetail {
  const out: AuditDetail = {};
  for (const [key, value] of Object.entries(detail)) {
    if (FORBIDDEN_KEY.test(key)) {
      out[key] = '[redacted]';
      continue;
    }
    if (value === null || value === undefined) {
      out[key] = null;
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
      continue;
    }
    if (typeof value === 'string') {
      // URL co chu ky khong duoc ghi nguyen van.
      out[key] = URL_LIKE.test(value) ? '[url_redacted]' : value.slice(0, MAX_VALUE_LENGTH);
      continue;
    }
    // Object/array/binary khong bao gio vao audit detail.
    out[key] = '[unsupported]';
  }
  return out;
}

export interface AuditInput {
  workspaceId: string;
  actorUserId: string | null;
  eventType: string;
  subjectType: AuditEvent['subjectType'];
  subjectId: string;
  detail?: Record<string, unknown>;
}

export async function recordAudit(persistence: PersistencePort, input: AuditInput): Promise<AuditEvent> {
  return persistence.audit.append({
    id: newId('aud'),
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    eventType: input.eventType,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    detail: redactAuditDetail(input.detail ?? {}),
    occurredAt: nowIso(),
  });
}

/** Danh sach event toi thieu theo prompt Phase 1 muc 13. */
export const AUDIT_EVENTS = {
  WORKSPACE_CREATED: 'workspace_created',
  WORKSPACE_MEMBER_ADDED: 'workspace_member_added',
  PROJECT_CREATED: 'project_created',
  ASSET_UPLOAD_STARTED: 'asset_upload_started',
  ASSET_UPLOAD_COMPLETED: 'asset_upload_completed',
  ASSET_VALIDATION_PASSED: 'asset_validation_passed',
  ASSET_VALIDATION_FAILED: 'asset_validation_failed',
  RIGHTS_ATTESTATION_CREATED: 'rights_attestation_created',
  PROCESSING_JOB_CREATED: 'processing_job_created',
  PROCESSING_JOB_BLOCKED: 'processing_job_blocked',
  PROCESSING_JOB_CANCELLED: 'processing_job_cancelled',
  /** P2-MCP-27: job that su chay xong va ket qua DA duoc do lai. */
  PROCESSING_JOB_COMPLETED: 'processing_job_completed',
  PROCESSING_JOB_FAILED: 'processing_job_failed',
  /** P3-MCP-33: ra duoc ket qua nhung co canh bao — nguoi that phai xem truoc khi nhan. */
  PROCESSING_JOB_REVIEW_REQUIRED: 'processing_job_review_required',
  /**
   * P2-MCP-29: mot URL tai ban ket qua da duoc phat. Ghi o luc PHAT URL chu khong phai luc
   * tai xong - kho luu tru phuc vu byte truc tiep, API khong nhin thay luot tai do. Noi
   * "da phat quyen tai" la dieu he thong biet chac; noi "da tai ve" thi khong.
   */
  OUTPUT_DOWNLOAD_URL_ISSUED: 'output_download_url_issued',
  USAGE_RESERVED: 'usage_reserved',
  USAGE_RELEASED: 'usage_released',
  /** P1.1: reservation qua han 30 phut va duoc hoan tra tu dong. */
  USAGE_RESERVATION_EXPIRED: 'usage_reservation_expired',
  PERMISSION_DENIED: 'permission_denied',
} as const;

export type AuditEventType = (typeof AUDIT_EVENTS)[keyof typeof AUDIT_EVENTS];
