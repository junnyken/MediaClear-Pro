/**
 * Nhat ky request (prompt Phase 1 muc 13).
 *
 * Ghi: requestId, workspaceId, userId, subject id, operation, ket qua, ma loi, thoi gian.
 * KHONG ghi: byte media, API key, session token, mat khau, signed URL day du.
 * Co test rieng kiem tra khong co token nao lot vao nhat ky.
 */
export interface RequestLogEntry {
  requestId: string;
  method: string;
  route: string;
  workspaceId: string | null;
  userId: string | null;
  subjectId: string | null;
  operation: string;
  resultState: 'ok' | 'error';
  httpStatus: number;
  errorCode: string | null;
  durationMs: number;
  usageOperation: string | null;
}

const MAX_ENTRIES = 500;

export class RequestLog {
  private readonly entries: RequestLogEntry[] = [];

  constructor(private readonly echoToStdout: boolean) {}

  append(entry: RequestLogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) this.entries.shift();
    if (this.echoToStdout) {
      console.log(JSON.stringify({ kind: 'request', ...entry }));
    }
  }

  list(): readonly RequestLogEntry[] {
    return this.entries;
  }
}
