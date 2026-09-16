-- 0003_phase2_persistence_gaps
--
-- P2-MCP-23. Khi hien thuc adapter PostgreSQL, ba cho lo ra: luoc do THIEU so voi kieu mien,
-- nen neu chi luu bang luoc do cu thi ban ghi doc ra se KHAC ban ghi ghi vao.
--
--   1. source_files.project_id          - SourceFileRecord.projectId khong co cho de luu
--   2. source_files.declared_media_type - SourceFileRecord.declaredMediaType khong co cho de luu
--   3. validation_results.errors        - chi luu error_codes (text[]) nen MAT `params`
--                                         (vd { limitMb: 199 }) va mat kha nang dung lai messageKey
--
-- CHI THEM COT. Khong xoa, khong doi kieu, khong dung cot cu lai. `error_codes` giu nguyen de
-- ho so cu van doc duoc.

BEGIN;

-- 1 + 2 ---------------------------------------------------------------------------------------
ALTER TABLE source_files
  ADD COLUMN IF NOT EXISTS project_id           text,
  ADD COLUMN IF NOT EXISTS declared_media_type  text;

-- Backfill: project cua source file chinh la project cua asset chua no.
UPDATE source_files sf
   SET project_id = a.project_id
  FROM assets a
 WHERE a.id = sf.asset_id
   AND sf.project_id IS NULL;

-- Backfill: suy tu MIME da khai. Chi hai nhanh vi he thong chi nhan image/* va video/*.
UPDATE source_files
   SET declared_media_type = CASE
         WHEN declared_mime_type LIKE 'image/%' THEN 'image'
         WHEN declared_mime_type LIKE 'video/%' THEN 'video'
       END
 WHERE declared_media_type IS NULL;

-- De NOT NULL that su co nghia: neu con dong nao khong backfill duoc thi day la du lieu hong,
-- va migration PHAI do chu khong duoc im lang bo qua.
ALTER TABLE source_files
  ALTER COLUMN project_id          SET NOT NULL,
  ALTER COLUMN declared_media_type SET NOT NULL;

ALTER TABLE source_files
  ADD CONSTRAINT source_files_declared_media_type_chk
  CHECK (declared_media_type IN ('image', 'video'));

CREATE INDEX IF NOT EXISTS source_files_project_idx
  ON source_files (workspace_id, project_id);

COMMENT ON COLUMN source_files.project_id IS
  'P2-MCP-23: project chua asset. Truoc day phai suy qua assets nen adapter doc ra thieu field.';
COMMENT ON COLUMN source_files.declared_media_type IS
  'P2-MCP-23: loai media NGUOI DUNG KHAI luc upload, khac voi loai DO DUOC o measured.';

-- 3 -------------------------------------------------------------------------------------------
ALTER TABLE validation_results
  ADD COLUMN IF NOT EXISTS errors jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill tu error_codes: giu lai ma loi. `params` cua ho so cu da mat that su nen
-- KHONG bia ra - de trong, dung hon la dien so doan.
UPDATE validation_results
   SET errors = (
         SELECT COALESCE(jsonb_agg(jsonb_build_object('code', c)), '[]'::jsonb)
           FROM unnest(error_codes) AS c
       )
 WHERE errors = '[]'::jsonb
   AND array_length(error_codes, 1) IS NOT NULL;

COMMENT ON COLUMN validation_results.errors IS
  'P2-MCP-23: ApiError day du (code + messageKey + params). error_codes giu lai cho ho so cu.';

INSERT INTO schema_migrations (version) VALUES ('0003_phase2_persistence_gaps')
ON CONFLICT (version) DO NOTHING;

COMMIT;
