/**
 * Dọn dữ liệu — ĐƯỜNG DUY NHẤT trong hệ thống này thực sự XOÁ BYTE (`D-070`).
 *
 * Cho tới `D-070`, luật lưu giữ chỉ có đường "thử mà không xoá" (`P1.1-MCP-18`, `D-031`) vì owner
 * chưa cho phép xoá. Owner đã cho phép, nên đường xoá tồn tại — nhưng nó được dựng với giả định
 * rằng **chính nó là thứ nguy hiểm nhất trong repo này**, và mọi lựa chọn dưới đây theo giả định đó.
 *
 * NĂM LỚP CHẶN, mỗi lớp chặn một kiểu hỏng khác nhau:
 *
 *  1. `dryRun` MẶC ĐỊNH `true`. Muốn xoá thật phải nói ra. Quên tham số ⇒ không xoá gì.
 *  2. Worker chỉ chạy bản xoá thật khi `MEDIACLEAR_CLEANUP_ENABLED=1`. Mặc định TẮT.
 *  3. Trần mỗi lượt (`limit`). Một lỗi logic chỉ hỏng tối đa `limit` bản ghi, không quét sạch kho.
 *  4. Kiểm lại luật NGAY TRƯỚC khi xoá từng bản ghi, không tin danh sách đã dựng ở trên. Danh sách
 *     dựng lúc T, xoá lúc T+n — giữ-theo-pháp-lý có thể vừa được đặt trong khoảng đó.
 *  5. Xoá byte TRƯỚC, đánh dấu bản ghi SAU. Nếu đổi thứ tự, một sự cố giữa chừng sẽ để lại bản ghi
 *     nói "đã xoá" trong khi byte vẫn nằm đó — tức là hồ sơ nói dối.
 *
 * KHÔNG bao giờ `DELETE FROM`: bản ghi ở lại làm bia mộ. Xoá dòng là xoá luôn bằng chứng rằng tệp
 * từng tồn tại và đã bị dọn theo luật nào.
 */
import { retentionDecisionFor, type RetentionSubject } from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import type { SourceFileRecord, UploadSessionRecord } from '../persistence/types.js';
import { AUDIT_EVENTS, recordAudit } from './audit.js';
import { storageKeyFor } from '@mediaclear/contracts';

/** Trần mặc định mỗi lượt. Nhỏ có chủ ý: dọn chậm nhiều lượt an toàn hơn dọn nhanh một lượt. */
export const DEFAULT_CLEANUP_LIMIT = 50;

export interface CleanupOptions {
  /** MẶC ĐỊNH `true`. Chỉ đếm, không xoá gì. */
  dryRun?: boolean;
  limit?: number;
}

export interface CleanupResult {
  dryRun: boolean;
  /** Số bản ghi đủ điều kiện dọn theo luật. */
  candidates: number;
  /** Số byte THẬT SỰ đã xoá. `dryRun` ⇒ luôn 0. */
  deleted: number;
  /** Bản ghi đủ điều kiện nhưng xoá không thành — cần người nhìn. */
  failed: number;
  ids: string[];
}

function toSubject(record: SourceFileRecord): RetentionSubject {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    dataClass: 'source_asset',
    createdAt: record.createdAt,
    lastAccessedAt: record.lastAccessedAt,
    deletedAt: record.deletedAt,
    retentionState: record.retentionState,
    legalHoldAt: record.legalHoldAt,
    byteSize: record.measured?.byteSize ?? null,
  };
}

/**
 * Dọn tệp nguồn đã hết thời hạn lưu giữ.
 *
 * Luật nằm ở `retentionDecisionFor` của contract — hàm này KHÔNG tự quyết định gì. Nó chỉ lấy dữ
 * liệu, hỏi luật, rồi thi hành. Giữ-theo-pháp-lý được chính luật đó loại ra TRƯỚC mọi điều kiện
 * khác, và ở đây còn được hỏi lại lần nữa ngay trước khi xoá.
 */
export async function runRetentionCleanup(ctx: AppContext, options: CleanupOptions = {}): Promise<CleanupResult> {
  const dryRun = options.dryRun ?? true;
  const limit = options.limit ?? DEFAULT_CLEANUP_LIMIT;
  const asOf = ctx.now();

  const all = await ctx.persistence.sourceFiles.listForRetention(null);
  const candidates = all.filter((r) => retentionDecisionFor(toSubject(r), asOf).isCandidate).slice(0, limit);

  const result: CleanupResult = { dryRun, candidates: candidates.length, deleted: 0, failed: 0, ids: [] };
  if (dryRun) {
    result.ids = candidates.map((r) => r.id);
    return result;
  }

  for (const record of candidates) {
    /*
     * Lớp chặn 4. Đọc LẠI bản ghi và hỏi LẠI luật. Danh sách trên được dựng ở một thời điểm khác;
     * trong khoảng đó ai đó có thể vừa đặt giữ-theo-pháp-lý, hoặc người dùng vừa mở tệp (làm mới
     * `lastAccessedAt`). Tin danh sách cũ là xoá nhầm.
     */
    const fresh = await ctx.persistence.sourceFiles.findById(record.workspaceId, record.id);
    if (!fresh) continue;
    if (!retentionDecisionFor(toSubject(fresh), ctx.now()).isCandidate) continue;

    try {
      // Lớp chặn 5: byte trước, bản ghi sau.
      await ctx.storage.deleteObject({ bucket: ctx.bucket, key: fresh.storageKey });
      await ctx.persistence.sourceFiles.markDeleted(fresh.workspaceId, fresh.id, ctx.now().toISOString());
      result.deleted += 1;
      result.ids.push(fresh.id);
      await recordAudit(ctx.persistence, {
        workspaceId: fresh.workspaceId,
        actorUserId: null,
        eventType: AUDIT_EVENTS.SOURCE_FILE_DELETED,
        subjectType: 'source_file',
        subjectId: fresh.id,
        detail: { reason: 'retention_expired', policyVersion: fresh.retentionPolicyVersion },
      });
    } catch {
      /*
       * Xoá hỏng KHÔNG được đánh dấu là đã xoá: bản ghi phải tiếp tục nói sự thật (byte vẫn còn).
       * Đếm riêng để người vận hành nhìn thấy, thay vì nuốt im lặng.
       */
      result.failed += 1;
    }
  }
  return result;
}

function chunkKey(session: UploadSessionRecord, index: number): string {
  return storageKeyFor(session.workspaceId, 'staging', `${session.id}_${String(index).padStart(5, '0')}`, '.part');
}

/**
 * Dọn mảnh thừa của phiên tải lên quá hạn (`P2-MCP-35` để lại).
 *
 * Ít nguy hiểm hơn hẳn việc dọn theo luật lưu giữ: mảnh `staging` là dữ liệu DANG DỞ của một lượt
 * tải lên chưa bao giờ hoàn tất. Tệp gốc của người dùng nằm ở lớp `source`, hàm này không đụng tới.
 *
 * Vẫn giữ nguyên `dryRun` mặc định và trần mỗi lượt: "ít nguy hiểm hơn" không phải "vô hại".
 */
export async function runUploadSessionCleanup(ctx: AppContext, options: CleanupOptions = {}): Promise<CleanupResult> {
  const dryRun = options.dryRun ?? true;
  const limit = options.limit ?? DEFAULT_CLEANUP_LIMIT;

  const expired = await ctx.persistence.uploadSessions.listExpired(ctx.now().toISOString(), limit);
  const result: CleanupResult = { dryRun, candidates: expired.length, deleted: 0, failed: 0, ids: [] };
  if (dryRun) {
    result.ids = expired.map((s) => s.id);
    return result;
  }

  for (const session of expired) {
    let anyFailed = false;
    /*
     * Chỉ xoá những mảnh ĐÃ NHẬN. Đi hết `totalChunks` sẽ gọi xoá lên cả những khoá chưa từng
     * được ghi — không hỏng gì, nhưng biến mọi lượt dọn thành một tràng lỗi giả ở tầng kho.
     */
    for (const index of session.receivedChunks) {
      try {
        await ctx.storage.deleteObject({ bucket: ctx.bucket, key: chunkKey(session, index) });
      } catch {
        anyFailed = true;
      }
    }
    try {
      await ctx.persistence.uploadSessions.setState(session.workspaceId, session.id, 'aborted');
    } catch {
      anyFailed = true;
    }

    if (anyFailed) {
      result.failed += 1;
      continue;
    }
    result.deleted += 1;
    result.ids.push(session.id);
    await recordAudit(ctx.persistence, {
      workspaceId: session.workspaceId,
      actorUserId: null,
      eventType: AUDIT_EVENTS.UPLOAD_SESSION_CLEANED,
      subjectType: 'upload_session',
      subjectId: session.id,
      detail: { chunks: session.receivedChunks.length, reason: 'expired' },
    });
  }
  return result;
}
