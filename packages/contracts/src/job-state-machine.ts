/**
 * MediaClear Pro - ProcessingJob state machine (MCP-03).
 *
 * Nguyen tac:
 * - Chi mot noi duy nhat dinh nghia transition hop le (khong copy sang service khac).
 * - 'blocked' la TERMINAL: go block = tao job MOI sau khi co attestation,
 *   khong "rua" trang thai cu (tranh mat audit trail). Xem DECISIONS.md D-005.
 * - 'completed' co GUARD cung: bat buoc output da verified (invariant I-2).
 */
import { ERROR_CODES, apiError, type ApiError } from './errors.js';
import { isTerminalJobState, type JobState } from './vocabulary.js';

export const ALLOWED_TRANSITIONS: Readonly<Record<JobState, readonly JobState[]>> = {
  uploaded: ['validating', 'cancelled'],
  validating: ['queued', 'blocked', 'failed', 'cancelled'],
  /*
   * P3: them `queued -> failed` va `processing -> blocked` theo de bai Phase 3.
   *
   * `queued -> failed`: mot job co the hong TRUOC khi worker kip nhan (vd tep nguon bien mat khoi
   * kho). Truoc day duong duy nhat la `blocked`, ma `blocked` mang nghia "chinh sach/phu thuoc
   * chan" chu khong phai "xu ly that bai" - hai thu khac nhau, va gop chung lam nguoi doc hieu sai
   * nguyen nhan.
   *
   * `processing -> blocked`: dang chay ma phat hien phu thuoc khong san sang (kho luu tru khong
   * toi duoc, provider khong dung duoc) thi do la `blocked`, khong phai `failed`.
   */
  queued: ['processing', 'blocked', 'failed', 'cancelled'],
  processing: ['review_required', 'completed', 'failed', 'blocked', 'cancelled'],
  review_required: ['processing', 'completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  blocked: [],
  cancelled: [],
};

export interface TransitionContext {
  /** Bat buoc cho transition -> 'completed'. */
  outputAssetId?: string | null;
  outputValidated?: boolean;
  /** Ma ly do khi -> 'blocked' | 'failed'. */
  reasonCode?: string | null;
}

export interface TransitionResult {
  allowed: boolean;
  error: ApiError | null;
}

/**
 * Kiem tra mot transition co hop le khong. Pure function.
 * KHONG tu thuc hien side-effect (ghi DB, tru credit) - do tang service lam.
 */
export function canTransition(
  from: JobState,
  to: JobState,
  context: TransitionContext = {},
): TransitionResult {
  if (isTerminalJobState(from)) {
    return { allowed: false, error: apiError(ERROR_CODES.MCP_STATE_TERMINAL, { from, to }) };
  }
  const allowedTargets = ALLOWED_TRANSITIONS[from];
  if (!allowedTargets.includes(to)) {
    return {
      allowed: false,
      error: apiError(ERROR_CODES.MCP_STATE_INVALID_TRANSITION, { from, to }),
    };
  }
  // Invariant I-2: khong bao gio 'completed' khi output chua ton tai/chua verify.
  if (to === 'completed') {
    const hasOutput = typeof context.outputAssetId === 'string' && context.outputAssetId.length > 0;
    if (!hasOutput || context.outputValidated !== true) {
      return {
        allowed: false,
        error: apiError(ERROR_CODES.MCP_STATE_OUTPUT_NOT_VERIFIED, { from, to }),
      };
    }
  }
  return { allowed: true, error: null };
}

/**
 * Invariant I-3: job dang 'blocked' (hoac bat ky state nao ngoai queued/processing)
 * KHONG duoc phep submit provider job.
 */
export function canSubmitProviderJob(state: JobState): boolean {
  return state === 'queued' || state === 'processing';
}

/**
 * Ban day du cua I-3 cho tang service: tra ve ly do tu choi thay vi chi boolean.
 * Job 'blocked' tra MCP_STATE_JOB_BLOCKED de phan biet voi cac state khac.
 */
export function assertCanSubmitProviderJob(state: JobState): TransitionResult {
  if (state === 'blocked') {
    return { allowed: false, error: apiError(ERROR_CODES.MCP_STATE_JOB_BLOCKED, { state }) };
  }
  if (!canSubmitProviderJob(state)) {
    return { allowed: false, error: apiError(ERROR_CODES.MCP_STATE_INVALID_TRANSITION, { state }) };
  }
  return { allowed: true, error: null };
}

/**
 * Owner decision Q-08: go block KHONG phai transition - phai tao ProcessingJob MOI.
 * Ham nay chi ton tai de goi ten hanh vi do va de test khang dinh job cu giu nguyen.
 */
export interface UnblockOutcome {
  /** Job cu: giu nguyen state 'blocked' va toan bo audit history. */
  previousJobStaysBlocked: true;
  /** Job moi bat dau lai tu 'uploaded'. */
  newJobInitialState: Extract<JobState, 'uploaded'>;
}

export function resolveBlockedJob(): UnblockOutcome {
  return { previousJobStaysBlocked: true, newJobInitialState: 'uploaded' };
}
