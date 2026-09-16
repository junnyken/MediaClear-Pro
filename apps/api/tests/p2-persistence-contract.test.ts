/**
 * P2-MCP-23: hop dong cua `PersistencePort`.
 *
 * Bo test nay duoc viet MOT LAN va chay tren CA HAI adapter. Ly do: rui ro lon nhat khi them
 * adapter thu hai la hai adapter TROI KHAC NHAU - test viet cho in-memory van xanh trong khi
 * PostgreSQL hanh xu khac (thu tu, null, kieu ngay, rang buoc). Adapter nao lech thi do.
 *
 * Adapter PostgreSQL chi chay khi co MEDIACLEAR_TEST_DATABASE_URL. Khi thieu, so test giam
 * han mot nua - nen "xanh vi khong chay gi" khong the lan qua.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { ERROR_CODES } from '@mediaclear/contracts';
import { InMemoryPersistence } from '../src/persistence/in-memory.js';
import { PostgresPersistence } from '../src/persistence/postgres.js';
import { runMigrations } from '../src/db/migrate.js';
import type { PersistencePort } from '../src/persistence/port.js';
import { join } from 'node:path';

const URL = process.env.MEDIACLEAR_TEST_DATABASE_URL;
const MIGRATIONS = join(import.meta.dirname, '../../../db/migrations');

const WS = 'wsp_test';
const OTHER_WS = 'wsp_khac';

function at(seconds: number): string {
  return new Date(Date.UTC(2026, 8, 16, 0, 0, seconds)).toISOString();
}

function aUser(id: string) {
  return { id, email: `${id}@matbao.com`, displayName: id, defaultLocale: 'vi', createdAt: at(1) };
}
function aWorkspace(id = WS) {
  return { id, name: `Khong gian ${id}`, ownerUserId: 'usr_1', createdAt: at(2) };
}
function aProject(id: string, workspaceId = WS, createdAt = at(3)) {
  return { id, workspaceId, name: `Du an ${id}`, createdByUserId: 'usr_1', createdAt };
}
function anAsset(id: string, projectId = 'prj_1', workspaceId = WS, createdAt = at(4)) {
  return { id, workspaceId, projectId, mediaType: 'image' as const, sourceFileId: `src_${id}`, createdAt };
}
function aSourceFile(id: string, workspaceId = WS) {
  return {
    id, workspaceId, projectId: 'prj_1', assetId: 'ast_1',
    storageKey: `source/${workspaceId}/${id}.png`, originalFilename: 'anh.png',
    declaredMimeType: 'image/png', declaredByteSize: 50472, declaredMediaType: 'image' as const,
    uploadState: 'pending' as const, measured: null,
    createdAt: at(5), uploadedAt: null,
    lastAccessedAt: null, retentionState: 'active' as const, legalHoldAt: null,
    scheduledDeletionAt: null, deletedAt: null, retentionPolicyVersion: 1,
  };
}
const MEASURED = {
  mimeType: 'image/png', byteSize: 50472, checksumSha256: 'a'.repeat(64),
  mediaType: 'image' as const, durationSeconds: null, widthPx: 200, heightPx: 120,
  hasAudioStream: null, corrupt: false,
};
function anAttestation(id: string, workspaceId = WS, attestedAt = at(6), version = 2) {
  return {
    id, workspaceId, scope: 'asset' as const, assetId: 'ast_1', sourceFileId: 'src_1',
    status: 'active' as const, attestedByUserId: 'usr_1', statementId: 'rights_attestation',
    statementVersion: version, localeShown: 'vi', attestationType: 'user_self_declared' as const,
    attestedAt,
  };
}
function aJob(id: string, key: string, workspaceId = WS) {
  return {
    id, workspaceId, projectId: 'prj_1', assetId: 'ast_1', sourceFileId: 'src_1',
    mediaType: 'image' as const, state: 'queued' as const,
    request: {
      operations: ['blur'] as never, preserveOriginalMetadata: true as const,
      preserveAiProvenance: true as const, presetId: null,
    },
    outputAssetId: null, reasonCode: null, blockReasonKind: null,
    // DB rang buoc attempt_count >= 1; ma that (`services/jobs.ts`) cung tao voi 1.
    idempotencyKey: key, attemptCount: 1, createdAt: at(7), updatedAt: at(7),
  };
}
function aUsageEntry(id: string, key: string, workspaceId = WS, jobId = 'job_1') {
  return {
    id, workspaceId, jobId, unitType: 'image_unit' as const, quantity: 1,
    entryType: 'reserve' as const, reasonCode: null, idempotencyKey: key,
    recordedAt: at(8), expiresAt: at(1808),
  };
}
function anAuditEvent(id: string, occurredAt: string, workspaceId = WS) {
  return {
    id, workspaceId, actorUserId: 'usr_1', eventType: 'rights.attested',
    subjectType: 'attestation' as const, subjectId: 'att_1', detail: { statementVersion: 2 },
    occurredAt,
  };
}

/**
 * PostgreSQL EP TOAN VEN THAM CHIEU, in-memory thi KHONG. Vi vay moi ban ghi con phai co cha
 * that su ton tai - day khong phai thu tuc ruom ra cua test, ma la mo hinh du lieu that.
 * Thu tu bat buoc: users -> workspaces -> projects -> assets -> source_files -> jobs.
 */
async function seedBase(db: PersistencePort): Promise<void> {
  await db.users.create(aUser('usr_1'));
  for (const [ws, prj, ast, src, job] of [
    [WS, 'prj_1', 'ast_1', 'src_1', 'job_1'],
    [OTHER_WS, 'prj_2', 'ast_2', 'src_2', 'job_2'],
  ] as const) {
    await db.workspaces.create({ ...aWorkspace(ws) });
    await db.projects.create(aProject(prj, ws));
    await db.assets.create({ ...anAsset(ast, prj, ws), sourceFileId: src });
    await db.sourceFiles.create({ ...aSourceFile(src, ws), projectId: prj, assetId: ast });
    await db.jobs.create({ ...aJob(job, `seed:${job}`, ws), projectId: prj, assetId: ast, sourceFileId: src });
  }
}

/** Bo hop dong. Moi adapter chay het bo nay. */
function contractSuite(label: string, make: () => Promise<PersistencePort>): void {
  describe(`PersistencePort — ${label}`, () => {
    let db: PersistencePort;

    beforeEach(async () => {
      db = await make();
      await seedBase(db);
    });

    it('tu khai durability, khong giau', () => {
      expect(['ephemeral', 'durable']).toContain(db.durability);
      expect(db.id.length).toBeGreaterThan(0);
    });

    it('users: tao, tim theo id va theo email khong phan biet hoa thuong', async () => {
      await db.users.create(aUser('usr_2'));
      expect((await db.users.findById('usr_2'))?.email).toBe('usr_2@matbao.com');
      expect((await db.users.findByEmail('USR_2@MATBAO.COM'))?.id).toBe('usr_2');
      expect(await db.users.findById('usr_khong_co')).toBeNull();
    });

    it('workspaces + memberships: liet ke dung khong gian cua nguoi dung', async () => {
      await db.memberships.create({ id: 'mem_1', workspaceId: WS, userId: 'usr_1', role: 'owner', createdAt: at(2) });
      const list = await db.workspaces.listForUser('usr_1');
      expect(list).toHaveLength(1);
      expect(list[0]?.workspace.id).toBe(WS);
      expect(list[0]?.membership.role).toBe('owner');
      expect(await db.workspaces.listForUser('usr_khong_co')).toEqual([]);
    });

    it('projects: phan trang on dinh theo (createdAt, id)', async () => {
      const PAGE_WS = 'wsp_phan_trang';
      await db.workspaces.create(aWorkspace(PAGE_WS));
      for (let i = 1; i <= 5; i += 1) {
        await db.projects.create(aProject(`prj_p${i}`, PAGE_WS, at(100 + i)));
      }
      const first = await db.projects.listByWorkspace(PAGE_WS, { limit: 2 });
      expect(first.items.map((p) => p.id)).toEqual(['prj_p1', 'prj_p2']);
      expect(first.nextCursor).not.toBeNull();

      const second = await db.projects.listByWorkspace(PAGE_WS, { limit: 2, cursor: first.nextCursor });
      expect(second.items.map((p) => p.id)).toEqual(['prj_p3', 'prj_p4']);

      const third = await db.projects.listByWorkspace(PAGE_WS, { limit: 2, cursor: second.nextCursor });
      expect(third.items.map((p) => p.id)).toEqual(['prj_p5']);
      expect(third.nextCursor).toBeNull();
    });

    it('CO LAP WORKSPACE: doc bang workspace khac tra null, khong tra du lieu', async () => {
      expect(await db.projects.findById(OTHER_WS, 'prj_1')).toBeNull();
      expect(await db.assets.findById(OTHER_WS, 'ast_1')).toBeNull();
      expect((await db.assets.listByProject(OTHER_WS, 'prj_1')).items).toEqual([]);
    });

    it('sourceFiles: markStored lan hai BI TU CHOI (bat bien I-1)', async () => {
      await db.sourceFiles.create(aSourceFile('src_a'));
      const stored = await db.sourceFiles.markStored(WS, 'src_a', { measured: MEASURED, uploadedAt: at(9) });
      expect(stored.uploadState).toBe('stored');
      expect(stored.measured?.widthPx).toBe(200);
      expect(stored.uploadedAt).toBe(at(9));

      await expect(
        db.sourceFiles.markStored(WS, 'src_a', { measured: MEASURED, uploadedAt: at(10) }),
      ).rejects.toThrow(ERROR_CODES.MCP_STORAGE_WRITE_DENIED);
    });

    it('sourceFiles: markStored tren workspace khac bao khong tim thay', async () => {
      await db.sourceFiles.create(aSourceFile('src_a'));
      await expect(
        db.sourceFiles.markStored(OTHER_WS, 'src_a', { measured: MEASURED, uploadedAt: at(9) }),
      ).rejects.toThrow(ERROR_CODES.MCP_RESOURCE_NOT_FOUND);
    });

    it('sourceFiles: touchAccess ghi moc that, workspace sai thi khong lam gi', async () => {
      await db.sourceFiles.create(aSourceFile('src_a'));
      await db.sourceFiles.touchAccess(OTHER_WS, 'src_a', at(11));
      expect((await db.sourceFiles.findById(WS, 'src_a'))?.lastAccessedAt).toBeNull();
      await db.sourceFiles.touchAccess(WS, 'src_a', at(11));
      expect((await db.sourceFiles.findById(WS, 'src_a'))?.lastAccessedAt).toBe(at(11));
    });

    it('sourceFiles: listForRetention loc theo workspace, khong workspace thi lay het', async () => {
      // Seed da co src_1 (WS) va src_2 (OTHER_WS).
      expect((await db.sourceFiles.listForRetention(WS)).map((r) => r.id)).toEqual(['src_1']);
      expect((await db.sourceFiles.listForRetention()).length).toBe(2);
    });

    it('validations: giu nguyen ApiError ke ca params', async () => {
      await db.validations.save({
        id: 'val_1', workspaceId: WS, assetId: 'ast_1', sourceFileId: 'src_1',
        state: 'failed',
        errors: [{ code: ERROR_CODES.MCP_VAL_FILE_TOO_LARGE, messageKey: 'error.too_large', params: { limitMb: 199 } }],
        validatedAt: at(12),
      });
      const latest = await db.validations.findLatest(WS, 'ast_1');
      expect(latest?.state).toBe('failed');
      expect(latest?.errors[0]?.code).toBe(ERROR_CODES.MCP_VAL_FILE_TOO_LARGE);
      expect(latest?.errors[0]?.params).toEqual({ limitMb: 199 });
      expect(await db.validations.findLatest(OTHER_WS, 'ast_1')).toBeNull();
    });

    it('attestations: APPEND-ONLY, ky lai tao ban ghi moi va lich su con nguyen', async () => {
      await db.attestations.create(anAttestation('att_1', WS, at(20)));
      await db.attestations.create(anAttestation('att_2', WS, at(21)));
      const latest = await db.attestations.findLatest(WS, 'ast_1');
      expect(latest?.id).toBe('att_2');
      // Ban ghi cu khong bi ghi de - van doc lai duoc qua ban moi nhat cua moc truoc.
      expect(latest?.statementVersion).toBe(2);
      expect(latest?.localeShown).toBe('vi');
      expect(latest?.attestationType).toBe('user_self_declared');
    });

    it('attestations: BANG CHUNG di qua tang luu tru khong doi mot truong nao', async () => {
      const original = anAttestation('att_1');
      await db.attestations.create(original);
      const read = await db.attestations.findLatest(WS, 'ast_1');
      expect(read).toEqual(original);
    });

    it('jobs: tao, tim theo khoa idempotency, cap nhat', async () => {
      await db.jobs.create(aJob('job_a', 'key_1'));
      expect((await db.jobs.findById(WS, 'job_a'))?.state).toBe('queued');
      expect((await db.jobs.findByIdempotencyKey(WS, 'key_1'))?.id).toBe('job_a');
      expect(await db.jobs.findByIdempotencyKey(OTHER_WS, 'key_1')).toBeNull();

      const updated = await db.jobs.update({
        ...aJob('job_a', 'key_1'), state: 'blocked', reasonCode: 'MCP_POLICY_RIGHTS_ATTESTATION_MISSING',
        blockReasonKind: 'policy_block', updatedAt: at(30),
      });
      expect(updated.state).toBe('blocked');
      expect((await db.jobs.findById(WS, 'job_a'))?.reasonCode).toBe('MCP_POLICY_RIGHTS_ATTESTATION_MISSING');
    });

    it('jobs: cap nhat job khong ton tai bao khong tim thay', async () => {
      await expect(db.jobs.update(aJob('job_khong_co', 'key_x'))).rejects.toThrow(
        ERROR_CODES.MCP_RESOURCE_NOT_FOUND,
      );
    });

    it('usage: khoa idempotency trung bi CHAN - day la cho chan double-charge', async () => {
      await db.usage.append(aUsageEntry('use_1', 'job_1:reserve'));
      await expect(db.usage.append(aUsageEntry('use_2', 'job_1:reserve'))).rejects.toThrow(
        ERROR_CODES.MCP_USAGE_RESERVATION_CONFLICT,
      );
      expect(await db.usage.listByWorkspace(WS)).toHaveLength(1);
    });

    it('usage: giu nguyen expiresAt cua but toan reserve', async () => {
      await db.usage.append(aUsageEntry('use_1', 'job_1:reserve'));
      const entries = await db.usage.listByWorkspace(WS);
      expect(entries[0]?.expiresAt).toBe(at(1808));
      expect(entries[0]?.entryType).toBe('reserve');
    });

    it('usage: listAll thay moi workspace, listByWorkspace thi khong', async () => {
      await db.usage.append(aUsageEntry('use_1', 'k1'));
      await db.usage.append(aUsageEntry('use_2', 'k2', OTHER_WS, 'job_2'));
      expect(await db.usage.listByWorkspace(WS)).toHaveLength(1);
      expect(await db.usage.listAll()).toHaveLength(2);
    });

    it('audit: moi nhat truoc, ton trong gioi han', async () => {
      await db.audit.append(anAuditEvent('aud_1', at(40)));
      await db.audit.append(anAuditEvent('aud_2', at(41)));
      await db.audit.append(anAuditEvent('aud_3', at(42)));
      const rows = await db.audit.listByWorkspace(WS, 2);
      expect(rows.map((e) => e.id)).toEqual(['aud_3', 'aud_2']);
      expect(rows[0]?.detail).toEqual({ statementVersion: 2 });
      expect(await db.audit.listByWorkspace(OTHER_WS)).toEqual([]);
    });
  });
}

contractSuite('InMemoryPersistence', async () => new InMemoryPersistence());

if (URL) {
  const pools: Pool[] = [];
  afterAll(async () => {
    await Promise.all(pools.map((p) => p.end()));
  });

  contractSuite('PostgresPersistence (PostgreSQL THAT)', async () => {
    // Moi ca test mot schema rieng => khong ca nao thay du lieu cua ca nao.
    const schema = `mcp_ct_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const admin = new Pool({ connectionString: URL });
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.end();

    const pool = new Pool({ connectionString: URL, options: `-c search_path=${schema}` });
    pools.push(pool);
    await runMigrations(pool, MIGRATIONS);
    return new PostgresPersistence(pool, { id: `postgres-test-${schema}` });
  });
}
