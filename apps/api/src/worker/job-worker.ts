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
import type { AppContext } from '../app-context.js';
import { executeClaimedJob, type RunJobOutcome } from '../services/run-job.js';

export interface JobWorkerOptions {
  /** Nghi bao lau khi khong con gi de lam. Qua ngan thi quay CPU, qua dai thi job cho lau. */
  idleDelayMs?: number;
  /** Nghi bao lau sau mot loi khong doan truoc - tranh quay vong chet. */
  errorDelayMs?: number;
  /** Dung sau bao nhieu vong. Khong dat = chay mai. Dung cho test va cho lenh chay mot luot. */
  maxCycles?: number;
  /** Ghi log. Mac dinh im lang de test khong bi nhieu. */
  log?: (message: string) => void;
}

export interface JobWorkerStats {
  cycles: number;
  claimed: number;
  completed: number;
  failed: number;
}

const DEFAULT_IDLE_MS = 2000;
const DEFAULT_ERROR_MS = 5000;

export class JobWorker {
  private running = false;
  private stopRequested = false;
  readonly stats: JobWorkerStats = { cycles: 0, claimed: 0, completed: 0, failed: 0 };

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
    const claimed = await this.ctx.persistence.jobs.claimQueued(this.ctx.now().toISOString());
    if (!claimed) return null;
    this.stats.claimed += 1;
    const outcome = await executeClaimedJob(this.ctx, claimed);
    if (outcome.state === 'completed') this.stats.completed += 1;
    else this.stats.failed += 1;
    return outcome;
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
