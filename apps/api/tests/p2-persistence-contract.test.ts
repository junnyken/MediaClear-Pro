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

/** Mot dong ho so sua keyframe (`D-074`). Du ca hai ve de doi chieu lai duoc. */
function aCorrection(id: string, frameIndex: number, reinterpolated: number[]) {
  const box = { x: 0.1, y: 0.1, width: 0.2, height: 0.2 };
  return {
    id, jobId: 'job_1', workspaceId: WS, frameIndex,
    beforeState: 'frame_low_confidence' as const,
    beforeSource: 'tracked' as const,
    beforeBox: box,
    beforeConfidence: 0.21,
    afterBox: { x: 0.5, y: 0.5, width: 0.2, height: 0.2 },
    reinterpolated,
    neighbours: reinterpolated.map((i) => ({
      frameIndex: i,
      beforeState: 'frame_tracked' as const, beforeSource: 'tracked' as const,
      beforeBox: box, beforeConfidence: 0.9,
      afterState: 'frame_correction_applied' as const, afterSource: 'interpolated' as const,
      afterBox: { x: 0.3, y: 0.3, width: 0.2, height: 0.2 }, afterConfidence: null,
    })),
    flickerBefore: 1,
    flickerAfter: 0,
    gateVerdictBefore: 'review_required' as const,
    gateVerdictAfter: 'completed' as const,
    correctedAt: at(2),
    actorUserId: 'usr_1',
  };
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

    /*
     * `blocked` phai mang DU ca hai truong ly do — rang buoc `processing_jobs_blocked_requires_reason`
     * co tu migration `0001`.
     *
     * Phep kiem nay ton tai vi mot loi THAT da lot qua 611 test (`D-066`): `blockJob` cua duong video
     * chi dat `reasonCode`. PostgreSQL nem loi => job KET o `processing` vinh vien; in-memory thi im
     * lang nhan => moi test deu xanh. Bo test hop dong chi phat hien duoc lech khi ca HAI adapter
     * cung bi doi hoi nhu nhau.
     */
    it('jobs: `blocked` mà THIẾU block_reason_kind bị TỪ CHỐI (cả hai adapter)', async () => {
      await db.jobs.create(aJob('job_chan', 'key_chan'));
      await expect(
        db.jobs.update({
          ...aJob('job_chan', 'key_chan'),
          state: 'blocked',
          reasonCode: ERROR_CODES.MCP_PROVIDER_UNAVAILABLE,
          blockReasonKind: null,
          updatedAt: at(31),
        }),
        'thieu block_reason_kind ma van ghi duoc => job se ket o `processing` tren ban that',
      ).rejects.toThrow(/blocked_requires_reason/);

      // Du ca hai truong thi ghi duoc binh thuong.
      const ok = await db.jobs.update({
        ...aJob('job_chan', 'key_chan'),
        state: 'blocked',
        reasonCode: ERROR_CODES.MCP_PROVIDER_UNAVAILABLE,
        blockReasonKind: 'provider_block',
        updatedAt: at(32),
      });
      expect(ok.state).toBe('blocked');
      expect(ok.blockReasonKind).toBe('provider_block');
    });

    it('jobs: cap nhat job khong ton tai bao khong tim thay', async () => {
      await expect(db.jobs.update(aJob('job_khong_co', 'key_x'))).rejects.toThrow(
        ERROR_CODES.MCP_RESOURCE_NOT_FOUND,
      );
    });

    /*
     * P3 (D-060): cuu job ket. Giong `claimQueued`, `claimStale` KHONG theo workspace - worker
     * khong thuoc ve khong gian lam viec nao. Nen cac ca duoi day phai tinh ca `job_2` o OTHER_WS.
     */
    it('jobs: claimStale chi dong vao job `processing` da im lang qua lau', async () => {
      // Hai job cua seedBase dang `queued` va rat cu - van tuyet doi khong duoc dong toi.
      expect(await db.jobs.claimStale(at(1000), at(900))).toBeNull();

      await db.jobs.create({ ...aJob('job_ket', 'key_ket'), state: 'processing', updatedAt: at(950) });
      // Moi hon moc `staleBefore` => dang chay binh thuong, chua phai ket.
      expect(await db.jobs.claimStale(at(1000), at(900))).toBeNull();

      await db.jobs.update({ ...aJob('job_ket', 'key_ket'), state: 'processing', updatedAt: at(800) });
      const claimed = await db.jobs.claimStale(at(1000), at(900));
      expect(claimed?.id).toBe('job_ket');
      // Tang NGAY luc nhan, truoc khi chay lai. Day la thu chan mot job doc lap vo tan.
      expect(claimed?.attemptCount).toBe(2);
      expect(claimed?.updatedAt).toBe(at(1000));

      // Da nhan roi thi worker thu hai khong duoc nhan lai cung job do.
      expect(await db.jobs.claimStale(at(1001), at(900))).toBeNull();
    });

    it('jobs: touch giu job khoi bi coi la ket - day la ly do nhip tim ton tai', async () => {
      await db.jobs.create({ ...aJob('job_dai', 'key_dai'), state: 'processing', updatedAt: at(800) });

      expect(await db.jobs.touch(WS, 'job_dai', at(950))).toBe(true);
      // Mot job video dai hang phut van dang chay => nhip tim phai lam no MIEN NHIEM voi claimStale.
      expect(await db.jobs.claimStale(at(1000), at(900))).toBeNull();

      // Ngung dap => lai thanh ket. Nhip tim chi hoan lai, khong mien vinh vien.
      expect((await db.jobs.claimStale(at(1000), at(960)))?.id).toBe('job_dai');
    });

    it('jobs: touch khong voi qua workspace khac va khong cham job da roi `processing`', async () => {
      await db.jobs.create({ ...aJob('job_tim', 'key_tim'), state: 'processing', updatedAt: at(800) });
      expect(await db.jobs.touch(OTHER_WS, 'job_tim', at(900))).toBe(false);
      expect(await db.jobs.touch(WS, 'job_khong_co', at(900))).toBe(false);

      await db.jobs.update({
        ...aJob('job_tim', 'key_tim'), state: 'failed',
        reasonCode: ERROR_CODES.MCP_PROVIDER_SUBMIT_FAILED, updatedAt: at(850),
      });
      /*
       * Job da that bai ma nhip tim cua worker cu van den muon => KHONG duoc cham. Neu cham, mot
       * job da dung se trong nhu dang chay va man hinh nguoi dung bao "dang xu ly" mai mai.
       */
      expect(await db.jobs.touch(WS, 'job_tim', at(900))).toBe(false);
      expect((await db.jobs.findById(WS, 'job_tim'))?.updatedAt).toBe(at(850));
    });

    /*
     * But toan `release` chi mang duoc ly do trong tu vung `RELEASE_REASONS`
     * (`usage_ledger_release_reason_known`, migration `0002`).
     *
     * Phep kiem nay ton tai vi mot loi TIEN BAC that da lot qua toan bo test (`D-066`): ma truyen
     * MA LOI (`MCP_PROVIDER_SUBMIT_FAILED`) thay vi ly do. PostgreSQL tu choi, `catch {}` nuot loi,
     * va khoan giu cua nguoi dung KHONG BAO GIO duoc tra lai — trong khi in-memory di qua binh
     * thuong nen moi test van xanh.
     */
    it('usage: `release` mang ly do LẠ bị TỪ CHỐI (cả hai adapter)', async () => {
      await expect(
        db.usage.append({
          ...aUsageEntry('use_la', 'job_1:release'),
          entryType: 'release',
          reasonCode: 'MCP_PROVIDER_SUBMIT_FAILED',
          expiresAt: null,
        }),
        'ly do la ma van ghi duoc => tren ban that but toan hoan tra bien mat trong im lang',
      ).rejects.toThrow(/release_reason_known/);

      // Ly do hop le thi ghi duoc.
      const ok = await db.usage.append({
        ...aUsageEntry('use_hop_le', 'job_1:release'),
        entryType: 'release',
        reasonCode: 'provider_error',
        expiresAt: null,
      });
      expect(ok.entryType).toBe('release');
      expect(ok.reasonCode).toBe('provider_error');
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
      const rows = (await db.audit.listByWorkspace(WS, { limit: 2 })).items;
      expect(rows.map((e) => e.id)).toEqual(['aud_3', 'aud_2']);
      expect(rows[0]?.detail).toEqual({ statementVersion: 2 });
      expect((await db.audit.listByWorkspace(OTHER_WS)).items).toEqual([]);
    });

    /*
     * `D-074` — mot lan sua keyframe la MOT giao dich, tren CA HAI ban luu tru.
     *
     * Day la cho bo doi chieu hai ban luu tru tung bat duoc `D-066`: PostgreSQL ep rang buoc con
     * in-memory thi nhan im lang, nen mot loi chi lo ra o mot ben. Giao dich cung vay — neu ban
     * trong bo nho ghi tung dong theo vong lap, no se de lai du lieu nua voi trong khi PostgreSQL
     * thi khong, va khac biet do chi lo ra tren production.
     */
    /*
     * `D-075`. Bien nhan KHONG he co phep kiem nao trong bo doi chieu hai ban luu tru cho toi day.
     *
     * Hau qua do duoc: mot dau phay doi trong mang tham so SQL lam MOI tham so sau no bi day lech
     * mot o. Typecheck xanh, lint xanh, 806 phep kiem xanh — vi moi test cham toi bien nhan deu
     * chay tren ban trong bo nho. Chi mot luot chay THAT tren PostgreSQL moi lo ra.
     *
     * Day la lan thu hai bo doi chieu hai ban luu tru phai duoc mo rong vi cung mot ly do (`D-066`).
     */
    it('receipts: MOI truong di qua tang luu tru va quay ve KHONG doi mot o nao', async () => {
      const receipt = {
        id: 'rcp_1', workspaceId: WS, jobId: 'job_1', sourceAssetId: 'ast_1', outputAssetId: null,
        operations: ['blur'] as const, providerRunIds: [],
        provenanceBeforeId: 'prv_1', provenanceAfterId: null,
        invisibleWatermarkDisclaimerKey: 'x.y', evidenceStatus: 'unknown' as const, createdAt: at(5),
        operationMode: 'mask' as const, presetId: 'p1',
        inputChecksum: 'a'.repeat(64), outputChecksum: 'b'.repeat(64),
        audioBefore: null, audioAfter: null, audioVerdict: 'preserved',
        outputVerified: true, failureReason: null, reviewReason: 'can xem lai',
        // Phase 5: cac truong de bi day lech nhat vi chung nam CUOI mang tham so.
        metadataVerdict: 'partially_preserved' as const,
        metadataEvidence: 'verified' as const,
        metadataStrippedCategories: ['location' as const, 'device' as const],
        disclosureState: 'provider_blocked' as const,
        disclosureLimitationKey: 'disclosure.limitation.provider_blocked',
        // KHONG dung `null`: mot o `null` khong canh duoc viec o do bi ghi `null` mat.
        // Do dung la cach doi chung am `NC7` lot qua o lan chay dau.
        brandKitId: 'bkt_thu', brandKitVersion: 7, schemaVersion: 3,
        brandLogoAssetId: 'blg_thu',
        // `brandOverlayApplied` la o RIENG, khong suy tu `brandKitId !== null` (`D-077`).
        brandOverlayApplied: true, disclosureOverlayApplied: true,
      };
      await db.provenance.create({
        id: 'prv_1', workspaceId: WS,
        originalMetadataPresence: 'present', aiProvenancePresence: 'unknown',
        preservationRequested: true, preservationAttempted: true, preservationResult: 'partial',
        limitationNote: null, evidenceStatus: 'unknown', recordedAt: at(4),
      });
      await db.receipts.create(receipt);

      const doc = await db.receipts.findByJob(WS, 'job_1');
      expect(doc, 'bien nhan bien mat sau khi ghi').not.toBeNull();
      // So TUNG truong: mot tham so bi day lech se lam mot o mang gia tri cua o ben canh.
      expect(doc).toEqual(receipt);
    });

    it('jobFrames: mot lan sua ghi audit + moi frame trong MOT giao dich', async () => {
      await db.jobFrames.saveTimeline({
        jobId: 'job_1', workspaceId: WS, expectedFrameCount: 3, declaredFrameCount: 3,
        decodedFrameCount: 3, undecodableFrames: 0, fps: 10, variableFrameRate: false, createdAt: at(1),
      });
      await db.jobFrames.replaceFrames(WS, 'job_1', [0, 1, 2].map((i) => ({
        jobId: 'job_1', workspaceId: WS, frameIndex: i, state: 'frame_tracked' as const,
        box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 }, confidence: 0.9,
        source: 'tracked' as const, updatedAt: at(1),
      })));

      await db.jobFrames.applyCorrectionAtomically({
        audit: aCorrection('aud_1', 1, [0, 2]),
        frames: [0, 1, 2].map((i) => ({
          jobId: 'job_1', workspaceId: WS, frameIndex: i,
          state: 'frame_correction_applied' as const,
          box: { x: 0.5, y: 0.5, width: 0.2, height: 0.2 }, confidence: null,
          source: i === 1 ? ('manual' as const) : ('interpolated' as const), updatedAt: at(2),
        })),
      });

      const frames = await db.jobFrames.listFrames(WS, 'job_1');
      expect(frames.every((f) => f.box?.x === 0.5)).toBe(true);
      const corrections = await db.jobFrames.listCorrections(WS, 'job_1');
      expect(corrections).toHaveLength(1);
      expect(corrections[0]?.reinterpolated).toEqual([0, 2]);
      expect(corrections[0]?.neighbours).toHaveLength(2);
      expect(corrections[0]?.gateVerdictBefore).toBe('review_required');
      expect(corrections[0]?.gateVerdictAfter).toBe('completed');
    });

    it('jobFrames: HONG giua chung thi KHONG ghi gi ca — khong audit, khong frame', async () => {
      await db.jobFrames.saveTimeline({
        jobId: 'job_1', workspaceId: WS, expectedFrameCount: 2, declaredFrameCount: 2,
        decodedFrameCount: 2, undecodableFrames: 0, fps: 10, variableFrameRate: false, createdAt: at(1),
      });
      await db.jobFrames.replaceFrames(WS, 'job_1', [0, 1].map((i) => ({
        jobId: 'job_1', workspaceId: WS, frameIndex: i, state: 'frame_tracked' as const,
        box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 }, confidence: 0.9,
        source: 'tracked' as const, updatedAt: at(1),
      })));
      const truoc = await db.jobFrames.listFrames(WS, 'job_1');

      /*
       * Frame 0 ghi duoc, frame 99 KHONG ton tai => loat ghi hong o giua. Neu khong co giao dich,
       * frame 0 se doi va dong audit da nam lai trong bang.
       */
      await expect(db.jobFrames.applyCorrectionAtomically({
        audit: aCorrection('aud_hong', 0, [99]),
        frames: [0, 99].map((i) => ({
          jobId: 'job_1', workspaceId: WS, frameIndex: i, state: 'frame_correction_applied' as const,
          box: { x: 0.9, y: 0.9, width: 0.05, height: 0.05 }, confidence: null,
          source: 'manual' as const, updatedAt: at(2),
        })),
      })).rejects.toThrow();

      expect(await db.jobFrames.listFrames(WS, 'job_1'), 'frame da doi trong khi loat ghi that bai').toEqual(truoc);
      expect(await db.jobFrames.listCorrections(WS, 'job_1'), 'dong audit nam lai sau mot lan ghi hong').toEqual([]);
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
