/**
 * P2-MCP-23: trinh chay migration.
 *
 * PHASE_1_REPORT §11 canh bao: chay migration lan hai tren DB co du lieu SE LOI vi chua co
 * trinh chay nao ghi so. Day la thu va dung lo hong do.
 *
 * QUAN TRONG - hai migration DA PHAT HANH (`0001`, `0002`) co hai dac diem ma trinh chay phai
 * TON TRONG, khong duoc ep chung theo y minh:
 *   1. Chung TU MO giao dich (`BEGIN; … COMMIT;`) ben trong tep.
 *   2. Chung TU GHI SO vao bang `schema_migrations (version text PRIMARY KEY, applied_at)`.
 * Vi vay trinh chay dung CHINH bang do lam nguon su that cho cau hoi "da chay chua", thay vi
 * dung them mot so thu hai roi de hai so noi khac nhau.
 *
 * Tong kiem nam o bang RIENG (`schema_migration_checksums`) de khong phai sua luoc do cua
 * migration da phat hanh - sua migration da phat hanh chinh la thu ma trinh chay nay di chan.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';

export interface MigrationFile {
  name: string;
  /** Ten tep bo duoi `.sql` - dung lam khoa trong `schema_migrations`. */
  version: string;
  sql: string;
  checksum: string;
  /** Tep co tu mo `BEGIN` khong. Neu co thi trinh chay KHONG boc them giao dich. */
  selfTransacting: boolean;
}

export interface MigrationOutcome {
  applied: string[];
  skipped: string[];
  /** Migration da chay TRUOC khi co trinh chay nay => chi ghi bu tong kiem, khong chay lai. */
  checksumBackfilled: string[];
}

/** Loi quy trinh, khong phai loi ky thuat: co nguoi sua migration da phat hanh. */
export class MigrationChecksumError extends Error {
  constructor(
    readonly migrationName: string,
    readonly recordedChecksum: string,
    readonly actualChecksum: string,
  ) {
    super(
      `Migration "${migrationName}" da duoc ap dung nhung noi dung tep hien tai khac voi luc ap dung ` +
        `(da ghi ${recordedChecksum.slice(0, 12)}…, hien tai ${actualChecksum.slice(0, 12)}…). ` +
        'Migration da phat hanh khong duoc sua; hay them mot migration moi.',
    );
    this.name = 'MigrationChecksumError';
  }
}

export function checksumOf(sql: string): string {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}

/** Bo chu thich dan dau roi xem cau lenh dau tien co phai BEGIN khong. */
export function opensOwnTransaction(sql: string): boolean {
  const withoutComments = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .trim();
  return /^BEGIN\s*;/i.test(withoutComments);
}

/** Doc thu muc migration theo THU TU TEN TEP - tien to so quyet dinh thu tu chay. */
export async function readMigrations(dir: string): Promise<MigrationFile[]> {
  const entries = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const out: MigrationFile[] = [];
  for (const name of entries) {
    const sql = await readFile(join(dir, name), 'utf8');
    out.push({
      name,
      version: name.replace(/\.sql$/, ''),
      sql,
      checksum: checksumOf(sql),
      selfTransacting: opensOwnTransaction(sql),
    });
  }
  return out;
}

/** Cung hinh dang voi bang ma `0001` tao ra - de chay tren DB da co san khong va cham. */
const CREATE_LEDGER = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version     text PRIMARY KEY,
    applied_at  timestamptz NOT NULL DEFAULT now()
  )
`;

const CREATE_CHECKSUMS = `
  CREATE TABLE IF NOT EXISTS schema_migration_checksums (
    version      text PRIMARY KEY,
    checksum     text NOT NULL,
    recorded_at  timestamptz NOT NULL DEFAULT now()
  )
`;

export async function runMigrations(pool: Pool, dir: string): Promise<MigrationOutcome> {
  await pool.query(CREATE_LEDGER);
  await pool.query(CREATE_CHECKSUMS);

  const files = await readMigrations(dir);

  const appliedRows = await pool.query<{ version: string }>('SELECT version FROM schema_migrations');
  const alreadyApplied = new Set(appliedRows.rows.map((r) => r.version));

  const checksumRows = await pool.query<{ version: string; checksum: string }>(
    'SELECT version, checksum FROM schema_migration_checksums',
  );
  const recordedChecksums = new Map(checksumRows.rows.map((r) => [r.version, r.checksum]));

  const applied: string[] = [];
  const skipped: string[] = [];
  const checksumBackfilled: string[] = [];

  for (const file of files) {
    if (alreadyApplied.has(file.version)) {
      const recorded = recordedChecksums.get(file.version);
      if (recorded === undefined) {
        // Migration nay chay TRUOC khi co trinh chay => chua co tong kiem. Ghi bu, khong chay lai.
        await pool.query('INSERT INTO schema_migration_checksums (version, checksum) VALUES ($1, $2)', [
          file.version,
          file.checksum,
        ]);
        checksumBackfilled.push(file.name);
      } else if (recorded !== file.checksum) {
        throw new MigrationChecksumError(file.name, recorded, file.checksum);
      }
      skipped.push(file.name);
      continue;
    }

    const client = await pool.connect();
    try {
      // Tep tu mo giao dich thi de no tu lo; boc them se lam COMMIT ben trong dong som giao dich ngoai.
      if (!file.selfTransacting) await client.query('BEGIN');
      await client.query(file.sql);
      // Tep co the da tu ghi so; `ON CONFLICT DO NOTHING` nen goi lai luon an toan.
      await client.query(
        'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING',
        [file.version],
      );
      await client.query(
        'INSERT INTO schema_migration_checksums (version, checksum) VALUES ($1, $2) ' +
          'ON CONFLICT (version) DO UPDATE SET checksum = EXCLUDED.checksum',
        [file.version, file.checksum],
      );
      if (!file.selfTransacting) await client.query('COMMIT');
      applied.push(file.name);
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Giao dich co the da hong san; loi goc moi la thu can nem len.
      }
      throw error;
    } finally {
      client.release();
    }
  }

  return { applied, skipped, checksumBackfilled };
}
