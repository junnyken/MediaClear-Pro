-- P3 (D-070): mo duong DON DU LIEU that su xoa byte.
--
-- Su kien audit cua viec don can hai loai chu the MOI. Rang buoc `subject_type` o `0001` khong co
-- chung, nen moi dong audit cua viec don deu se bi tu choi — dung dang loi ma `D-066` vua gap
-- (ghi `blocked` thieu truong): PostgreSQL tu choi, in-memory di qua, test van xanh.
--
-- KHONG dung 'asset' cho du field: chu thich o `entities.ts` cam dung dieu do, va no dung —
-- mot tep nguon khong phai mot asset, va mot phien tai len cang khong phai.

BEGIN;

ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_subject_type_check;

ALTER TABLE audit_events
  ADD CONSTRAINT audit_events_subject_type_check CHECK (subject_type IN (
    'workspace', 'project', 'membership', 'asset', 'job', 'output',
    'attestation', 'usage', 'audit', 'provider_run',
    -- Moi tu D-070:
    'source_file', 'upload_session'
  ));

INSERT INTO schema_migrations (version) VALUES ('0009_phase3_cleanup_subject_types')
ON CONFLICT (version) DO NOTHING;

COMMIT;
