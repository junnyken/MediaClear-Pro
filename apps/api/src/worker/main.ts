/**
 * Diem khoi dong cua tien trinh worker (P2-MCP-28).
 *
 * Chay RIENG, khong nam trong tien trinh API: mot job nang khong duoc lam cham duong phuc vu
 * nguoi dung, va tat worker de bao tri khong duoc lam sap API.
 *
 * Worker KHONG chay migration - viec do thuoc ve API. Neu ca hai cung chay migration, hai tien
 * trinh khoi dong cung luc se dam vao nhau.
 */
import { createAppContext } from '../app-context.js';
import { JobWorker } from './job-worker.js';

async function main(): Promise<void> {
  const ctx = createAppContext();
  const worker = new JobWorker(ctx, {
    idleDelayMs: Number(process.env.MEDIACLEAR_WORKER_IDLE_MS ?? 2000),
    log: (message) => console.log(message),
  });

  console.log(
    `[mediaclear-worker] bat dau · luu tru ${ctx.persistence.id} (${ctx.persistence.durability})` +
      ` · kho ${ctx.storage.id}`,
  );
  if (ctx.persistence.durability !== 'durable') {
    /*
     * Canh bao THAT: worker chay rieng tien trinh, nen luu tru in-memory nghia la no nhin vao
     * mot kho RONG khac han cua API. No se khong bao gio thay job nao.
     */
    console.warn(
      '[mediaclear-worker] CANH BAO: luu tru khong ben vung. Worker chay rieng tien trinh nen se' +
        ' KHONG thay job cua API. Dat MEDIACLEAR_DATABASE_URL (hoac DATABASE_URL) de dung chung PostgreSQL.',
    );
  }

  const shutdown = (signal: string) => {
    console.log(`[mediaclear-worker] nhan ${signal}, dung sau khi xong job hien tai`);
    worker.stop();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  const stats = await worker.start();
  console.log(`[mediaclear-worker] da dung · ${JSON.stringify(stats)}`);
  if (ctx.dbPool) await ctx.dbPool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
