/**
 * P2-MCP-23: trinh chay migration.
 *
 * Chay THAT tren PostgreSQL. Khong co MEDIACLEAR_TEST_DATABASE_URL thi bo qua ca khoi -
 * va khi bo qua thi bao ro, vi "xanh vi khong chay gi" la kieu xanh gia nguy hiem nhat.
 */
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import {
  MigrationChecksumError,
  checksumOf,
  opensOwnTransaction,
  readMigrations,
  runMigrations,
} from '../src/db/migrate.js';

const URL = process.env.MEDIACLEAR_TEST_DATABASE_URL;
const REPO_MIGRATIONS = join(import.meta.dirname, '../../../db/migrations');

describe('P2-MCP-23 — doc thu muc migration (khong can DB)', () => {
  it('doc dung TAT CA migration cua repo, theo thu tu ten tep', async () => {
    const files = await readMigrations(REPO_MIGRATIONS);
    expect(files.map((f) => f.name)).toEqual([
      '0001_phase1_init.sql',
      '0002_phase1_1_retention_and_reservation_ttl.sql',
      '0003_phase2_persistence_gaps.sql',
      '0004_phase2_password_auth_sessions.sql',
      '0005_phase2_output_assets.sql',
      '0006_phase2_provenance_receipts.sql',
      '0007_phase2_resumable_upload.sql',
    ]);
  });

  it('nhan ra migration DA PHAT HANH tu mo giao dich rieng', async () => {
    const files = await readMigrations(REPO_MIGRATIONS);
    // Moi tep cua repo deu boc `BEGIN; … COMMIT;` => trinh chay khong duoc boc them.
    expect(files.every((f) => f.selfTransacting)).toBe(true);
    expect(opensOwnTransaction('-- chu thich\n\nBEGIN;\nSELECT 1;')).toBe(true);
    expect(opensOwnTransaction('CREATE TABLE t (id text);')).toBe(false);
  });

  it('version la ten tep bo duoi .sql - khop voi thu migration tu ghi vao so', async () => {
    const files = await readMigrations(REPO_MIGRATIONS);
    expect(files.map((f) => f.version)).toEqual([
      '0001_phase1_init',
      '0002_phase1_1_retention_and_reservation_ttl',
      '0003_phase2_persistence_gaps',
      '0004_phase2_password_auth_sessions',
      '0005_phase2_output_assets',
      '0006_phase2_provenance_receipts',
      '0007_phase2_resumable_upload',
    ]);
  });

  it('tong kiem doi khi noi dung doi du chi mot ky tu', () => {
    const a = checksumOf('SELECT 1;');
    const b = checksumOf('SELECT 1; ');
    expect(a).not.toBe(b);
    expect(a).toBe(checksumOf('SELECT 1;'));
  });
});

describe.skipIf(!URL)('P2-MCP-23 — chay migration THAT tren PostgreSQL', () => {
  const pool = new Pool({ connectionString: URL });
  let schema: string;

  beforeEach(async () => {
    // Moi ca test mot schema rieng => khong ca nao thay du lieu cua ca nao.
    schema = `mcp_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    await pool.query(`CREATE SCHEMA "${schema}"`);
    await pool.query(`SET search_path TO "${schema}"`);
  });

  afterAll(async () => {
    await pool.end();
  });

  async function freshPool(): Promise<Pool> {
    const p = new Pool({ connectionString: URL });
    await p.query(`SET search_path TO "${schema}"`);
    return p;
  }

  it('chay lan dau: ap dung TAT CA migration cua repo', async () => {
    const p = await freshPool();
    const out = await runMigrations(p, REPO_MIGRATIONS);
    expect(out.applied).toEqual([
      '0001_phase1_init.sql',
      '0002_phase1_1_retention_and_reservation_ttl.sql',
      '0003_phase2_persistence_gaps.sql',
      '0004_phase2_password_auth_sessions.sql',
      '0005_phase2_output_assets.sql',
      '0006_phase2_provenance_receipts.sql',
      '0007_phase2_resumable_upload.sql',
    ]);
    expect(out.skipped).toEqual([]);

    expect(out.checksumBackfilled).toEqual([]);

    const tables = await p.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
      [schema],
    );
    const names = tables.rows.map((r) => r.table_name);
    expect(names).toContain('rights_attestations');
    expect(names).toContain('schema_migrations');
    expect(names).toContain('schema_migration_checksums');
    expect(names).toContain('sessions');
    expect(names).toContain('output_assets');
    expect(names).toContain('provenance_records');
    expect(names).toContain('processing_receipts');
    expect(names).toContain('upload_sessions');
    expect(names.length).toBeGreaterThanOrEqual(18); // 16 bang nghiep vu + 2 so

    // 0003 vá dung ba cho luoc do THIEU so voi kieu mien - kiem cot that su co mat.
    const cols = await p.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = $1
          AND ((table_name = 'source_files' AND column_name IN ('project_id','declared_media_type'))
            OR (table_name = 'validation_results' AND column_name = 'errors'))`,
      [schema],
    );
    expect(cols.rows).toHaveLength(3);
    await p.end();
  });

  it('CHAY LAN HAI khong lam gi - day dung la loi PHASE_1_REPORT §11 canh bao', async () => {
    const p1 = await freshPool();
    await runMigrations(p1, REPO_MIGRATIONS);
    await p1.end();

    const p2 = await freshPool();
    const out = await runMigrations(p2, REPO_MIGRATIONS);
    expect(out.applied, 'lan hai khong duoc ap dung lai gi').toEqual([]);
    /*
     * Suy ra tu thu muc, KHONG ghim so. Tinh chat can giu la "lan hai bo qua TAT CA" - ghim
     * con so khien moi migration moi lam test do vi mot ly do khong lien quan gi den tinh chat do.
     */
    const all = await readMigrations(REPO_MIGRATIONS);
    expect(out.skipped).toHaveLength(all.length);
    await p2.end();
  });

  it('sua migration DA PHAT HANH thi DUNG, khong im lang chay len', async () => {
    const p = await freshPool();
    await runMigrations(p, REPO_MIGRATIONS);

    // Gia lap: ai do sua noi dung migration da ap dung.
    const dir = await mkdtemp(join(tmpdir(), 'mcp-mig-'));
    const files = await readMigrations(REPO_MIGRATIONS);
    for (const f of files) {
      const body = f.name === '0001_phase1_init.sql' ? f.sql + '\n-- sua len sau khi da phat hanh\n' : f.sql;
      await writeFile(join(dir, f.name), body, 'utf8');
    }

    await expect(runMigrations(p, dir)).rejects.toThrow(MigrationChecksumError);
    await p.end();
  });

  it('migration loi giua chung KHONG de lai luoc do nua voi', async () => {
    const p = await freshPool();
    const dir = await mkdtemp(join(tmpdir(), 'mcp-mig-bad-'));
    await writeFile(
      join(dir, '0001_nua_voi.sql'),
      'CREATE TABLE ban_dau (id text PRIMARY KEY);\nCREATE TABLE ban_dau (id text PRIMARY KEY);\n',
      'utf8',
    );

    await expect(runMigrations(p, dir)).rejects.toThrow();

    const left = await p.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'ban_dau'`,
      [schema],
    );
    expect(left.rows, 'giao dich phai cuon lai, khong de lai bang nao').toEqual([]);

    const ledger = await p.query<{ version: string }>('SELECT version FROM schema_migrations');
    expect(ledger.rows, 'khong duoc ghi so cho migration that bai').toEqual([]);
    await p.end();
  });
});
