/**
 * Ve ky HMAC cho bien upload/download (tach ra o P2-MCP-24).
 *
 * Truoc day logic nay nam ben trong LocalFsStorageAdapter. Khi co adapter thu hai (S3/R2),
 * de nguyen o do se dan den mot trong hai ket cuc: hoac chep doi logic ky - roi hai ban troi
 * khac nhau, hoac adapter moi phai ke thua adapter local - dieu vo nghia. Nen tach ra dung chung.
 *
 * Vi sao van dung ticket cua minh thay vi presigned URL cua S3: bien upload/download giu nguyen
 * MOT cho duy nhat (API), nen kiem tra quyen, gioi han kich thuoc va bat bien I-1 chi phai dung
 * o mot noi. Doi sang presigned URL tra thang cho trinh duyet la mot thay doi kien truc rieng,
 * keo theo CORS va mat diem kiem - khong gop vao luot nay.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ERROR_CODES, apiError, type ApiError, type ObjectStorageAdapter } from '@mediaclear/contracts';
import { assertSafeObjectKey } from './object-key.js';

export interface UploadTicketPayload {
  bucket: string;
  key: string;
  contentType: string;
  maxByteSize: number;
  /** epoch giay */
  exp: number;
  /** 'upload' | 'download' - ticket khong dung cheo muc dich duoc. */
  use: 'upload' | 'download';
}

export type TicketResult =
  | { ok: true; payload: UploadTicketPayload }
  | { ok: false; error: ApiError };

export function signTicket(secret: string, payload: UploadTicketPayload): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

/** Tra payload neu ticket hop le; nguoc lai tra ApiError (khong lo chi tiet ra ngoai). */
export function verifyTicket(
  secret: string,
  token: string,
  use: 'upload' | 'download',
  nowMs = Date.now(),
): TicketResult {
  const invalid = { ok: false as const, error: apiError(ERROR_CODES.MCP_STORAGE_UPLOAD_TICKET_INVALID) };
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return invalid;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return invalid;
  let payload: UploadTicketPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as UploadTicketPayload;
  } catch {
    return invalid;
  }
  if (payload.use !== use) return invalid;
  if (!Number.isFinite(payload.exp) || payload.exp * 1000 < nowMs) return invalid;
  if (assertSafeObjectKey(payload.key)) return invalid;
  return { ok: true, payload };
}

/**
 * Be mat that su ma ung dung can o tang luu tru: hop dong chung CONG voi ve ky ticket.
 *
 * Ton tai vi bien upload/download cua API can `sign`/`verifyTicket`, ma hai thu do khong thuoc
 * `ObjectStorageAdapter` - chung la lua chon cua ung dung nay, khong phai cua giao thuc S3.
 */
export interface TicketedStorageAdapter extends ObjectStorageAdapter {
  sign(payload: UploadTicketPayload): string;
  verifyTicket(token: string, use: 'upload' | 'download', nowMs?: number): TicketResult;
}
