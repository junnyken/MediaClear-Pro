/**
 * JobWorker - tien trinh chay job (P2-MCP-28, owner decision Q-02).
 *
 * Truoc muc nay, job chi chay khi co nguoi GOI TAY route noi bo. Day la thu lam no tu chay.
 *
 * Vi sao hang doi nam tren PostgreSQL chu khong phai Redis: co so du lieu DA CO SAN va da ben
 * vung (P2-MCP-23). Them mot ha tang nua chi de xep hang la them mot thu co the chet rieng,
 * phai sao luu rieng, va phai giai thich cho nguoi van hanh rieng. `FOR UPDATE SKIP LOCKED`
 * du cho muc dung MVP; doi sang Redis sau van duoc vi cong `claimQueued` khong lo ra ben trong.
 *
 * Worker KHONG tu viet lai logic xu ly - no goi `executeClaimedJob`, dung ham ma route noi bo
 * dung. Hai ban logic se troi khac nhau, va cho troi se la cho tinh muc dung.
 */
import { ERROR_CODES, apiError, type ProcessingJob } from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import { executeClaimedJob, failJob, type RunJobOutcome } from '../services/run-job.js';
import { AUDIT_EVENTS, recordAudit } from '../services/audit.js';

export interface JobWorkerOptions {
  /** Nghi bao lau khi khong con gi de lam. Qua ngan thi quay CPU, qua dai thi job cho lau. */
  idleDelayMs?: number;
  /** Nghi bao lau sau mot loi khong doan truoc - tranh quay vong chet. */
  errorDelayMs?: number;
  /** Dung sau bao nhieu vong. Khong dat = chay mai. Dung cho test va cho lenh chay mot luot. */
  maxCycles?: number;
  /** Ghi log. Mac dinh im lang de test khong bi nhieu. */
  log?: (message: string) => void;
  /** Bao lau khong co nhip tim thi coi la job ket. Phai LON HON nhieu lan `heartbeatMs`. */
  staleAfterMs?: number;
  /** Khoang cach giua hai nhip tim khi dang chay mot job. */
  heartbeatMs?: number;
  /** Nhan lai qua so lan nay thi dung han thay vi cuu tiep. */
  maxAttempts?: number;
}

export interface JobWorkerStats {
  cycles: number;
  claimed: number;
  completed: number;
  failed: number;
  /** Rieng so job KET da nhan lai - de nguoi van hanh thay con so nay tang bat thuong. */
  reclaimed: number;
  /** So job bi bo vi vuot tran so lan thu. */
  abandoned: number;
}

const DEFAULT_IDLE_MS = 2000;
const DEFAULT_ERROR_MS = 5000;

/*
 * Nhip tim 30 giay, coi la ket sau 5 phut => phai lo MUOI nhip lien tiep moi bi nhan lai.
 * Con so nay khong phai "job chay lau nhat bao nhieu": job video dai bao lau cung duoc, vi khi
 * no con chay thi nhip tim van doi `updated_at`. No la "worker im lang bao lau thi coi nhu chet".
 */
const DEFAULT_HEARTBEAT_MS = 30_000;
const DEFAULT_STALE_AFTER_MS = 5 * 60_000;

/*
 * Ba lan. Job ket vi may bi thay hay mat dien thi lan hai da chay xong. Job ket vi CHINH NO lam
 * worker chet thi moi lan cuu lai giet them mot worker - tran nay la thu chan vong do.
 */
const DEFAULT_MAX_ATTEMPTS = 3;

export class JobWorker {
  private running = false;
  private stopRequested = false;
  readonly stats: JobWorkerStats = { cycles: 0, claimed: 0, completed: 0, failed: 0, reclaimed: 0, abandoned: 0 };

  constructor(
    private readonly ctx: AppContext,
    private readonly options: JobWorkerOptions = {},
  ) {}

  /** Yeu cau dung. Vong dang chay se chay NOT job hien tai roi moi dung - khong bo giua chung. */
  stop(): void {
    this.stopRequested = true;
  }

  get isRunning(): boolean {
    return this.running;
  }

  /**
   * Nhan MOT job va chay. Tra null khi khong con gi.
   * Tach rieng de test goi duoc tung buoc mot thay vi phai chay ca vong lap.
   */
  async runOnce(): Promise<RunJobOutcome | null> {
    const now = this.ctx.now().toISOString();
    const queued = await this.ctx.persistence.jobs.claimQueued(now);
    if (queued) {
      this.stats.claimed += 1;
      return await this.execute(queued);
    }

    /*
     * Het viec moi => moi di cuu job ket. Thu tu nay co chu dinh: job dang cho la viec CHAC CHAN
     * chua ai lam, con job ket chi la NGHI NGO. Uu tien viec chac chan truoc.
     */
    const staleBefore = new Date(this.ctx.now().getTime() - this.staleAfterMs).toISOString();
    const stale = await this.ctx.persistence.jobs.claimStale(now, staleBefore);
    if (!stale) return null;

    this.stats.claimed += 1;
    this.stats.reclaimed += 1;
    await recordAudit(this.ctx.persistence, {
      workspaceId: stale.workspaceId,
      actorUserId: null,
      eventType: AUDIT_EVENTS.PROCESSING_JOB_RECLAIMED,
      subjectType: 'job',
      subjectId: stale.id,
      detail: { attemptCount: stale.attemptCount, staleBefore },
    });

    /*
     * Tran duoc kiem SAU khi `claimStale` da tang `attemptCount` trong cung mot cau lenh. Nho vay
     * mot job doc - job lam worker chet truoc khi chay xong - van bi dem len moi lan nhan lai, va
     * chac chan dung han sau `maxAttempts`. Neu dem sau khi chay xong thi no lap vo tan.
     */
    if (stale.attemptCount > this.maxAttempts) {
      this.stats.abandoned += 1;
      this.stats.failed += 1;
      return await failJob(this.ctx, stale, apiError(ERROR_CODES.MCP_JOB_MAX_ATTEMPTS_EXCEEDED, {
        attemptCount: String(stale.attemptCount),
        maxAttempts: String(this.maxAttempts),
      }));
    }
    return await this.execute(stale);
  }

  private get staleAfterMs(): number {
    return this.options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  }

  private get maxAttempts(): number {
    return this.options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  }

  /**
   * Chay job, vua chay vua bao "toi con song".
   *
   * Khong co nhip tim thi chinh `claimStale` tro thanh mot loi MOI: mot job video render lau hon
   * nguong se bi worker thu hai nhan mat va render lan nua trong khi worker thu nhat van dang
   * chay. Nhip tim la thu lam cho "im lang lau" khac han "dang lam viec lau".
   */
  private async execute(job: ProcessingJob): Promise<RunJobOutcome> {
    const beat = setInterval(() => {
      void this.ctx.persistence.jobs
        .touch(job.workspaceId, job.id, this.ctx.now().toISOString())
        .catch(() => {
          /* Mat mot nhip khong sao - con `staleAfterMs / heartbeatMs` nhip nua moi bi nhan lai. */
        });
    }, this.options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS);
    // Nhip tim khong duoc giu tien trinh song khi moi viec khac da xong.
    beat.unref?.();
    try {
      const outcome = await executeClaimedJob(this.ctx, job);
      if (outcome.state === 'completed') this.stats.completed += 1;
      else this.stats.failed += 1;
      return outcome;
    } finally {
      clearInterval(beat);
    }
  }

  async start(): Promise<JobWorkerStats> {
    if (this.running) return this.stats;
    this.running = true;
    this.stopRequested = false;
    const idle = this.options.idleDelayMs ?? DEFAULT_IDLE_MS;
    const onError = this.options.errorDelayMs ?? DEFAULT_ERROR_MS;
    const log = this.options.log ?? (() => {});
    const maxCycles = this.options.maxCycles;

    try {
      while (!this.stopRequested) {
        if (maxCycles !== undefined && this.stats.cycles >= maxCycles) break;
        this.stats.cycles += 1;
        try {
          const outcome = await this.runOnce();
          if (!outcome) {
            if (maxCycles !== undefined) continue;
            await sleep(idle);
            continue;
          }
          log(`[worker] ${outcome.jobId} -> ${outcome.state}${outcome.error ? ` (${outcome.error.code})` : ''}`);
        } catch (error) {
          /*
           * Mot job hong KHONG duoc lam chet worker: nhung job con lai van phai duoc chay.
           * Nghi mot nhip roi di tiep - neu khong, mot loi lap lai se thanh vong quay chet
           * dot CPU va lam day nhat ky.
           */
          log(`[worker] loi ngoai du tinh: ${error instanceof Error ? error.message : String(error)}`);
          if (maxCycles === undefined) await sleep(onError);
        }
      }
    } finally {
      this.running = false;
    }
    return this.stats;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
