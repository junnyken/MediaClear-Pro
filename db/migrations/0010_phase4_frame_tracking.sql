-- 0010_phase4_frame_tracking
--
-- P4-MCP-40…44: luu trang thai TUNG FRAME va lich su sua tay.
--
-- Vi sao mot dong moi frame chu khong phai mot khoi JSON: bat bien "khong frame nao bi bo sot" duoc
-- kiem bang cach DEM dong. Nhet ca timeline vao mot o jsonb thi phep dem tro thanh viec doc mot o
-- do ung dung tu ghi ra — tuc la ung dung tu cham diem chinh minh.
--
-- CHI THEM. Khong xoa, khong doi kieu.

BEGIN;

CREATE TABLE job_frames (
  job_id          text NOT NULL REFERENCES processing_jobs (id),
  workspace_id    text NOT NULL REFERENCES workspaces (id),
  frame_index     integer NOT NULL CHECK (frame_index >= 0),
  state           text NOT NULL CHECK (state IN (
    'frame_tracked', 'frame_low_confidence', 'frame_review_required',
    'frame_correction_applied', 'frame_failed'
  )),
  -- Toa do CHUAN HOA [0,1], cung he voi `regions` cua Phase 3. `null` khi khong co mask.
  box_x           double precision,
  box_y           double precision,
  box_width       double precision,
  box_height      double precision,
  -- `null` KHAC `0`: null = provider khong tra so nao, 0 = do duoc va rat thap.
  confidence      double precision CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  source          text NOT NULL CHECK (source IN ('tracked', 'interpolated', 'manual')),
  updated_at      timestamptz NOT NULL,
  PRIMARY KEY (job_id, frame_index),
  -- Mask phai co DU bon toa do hoac khong co gi. Mot mask thieu mot canh la mot mask vo nghia.
  CONSTRAINT job_frames_box_complete CHECK (
    (box_x IS NULL AND box_y IS NULL AND box_width IS NULL AND box_height IS NULL)
    OR (box_x IS NOT NULL AND box_y IS NOT NULL AND box_width IS NOT NULL AND box_height IS NOT NULL)
  )
);

CREATE INDEX job_frames_job_idx ON job_frames (job_id, frame_index);

-- Tong so frame KY VONG, do bang MCP-40 tren tep that. Tach khoi `job_frames` co chu dinh: no la
-- con so de DOI CHIEU, nen khong duoc suy ra tu chinh bang frame.
CREATE TABLE job_frame_timelines (
  job_id                text PRIMARY KEY REFERENCES processing_jobs (id),
  workspace_id          text NOT NULL REFERENCES workspaces (id),
  expected_frame_count  integer NOT NULL CHECK (expected_frame_count >= 0),
  declared_frame_count  integer,
  decoded_frame_count   integer NOT NULL CHECK (decoded_frame_count >= 0),
  undecodable_frames    integer NOT NULL DEFAULT 0 CHECK (undecodable_frames >= 0),
  fps                   double precision,
  variable_frame_rate   boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL
);

-- Lich su sua tay. APPEND-ONLY: khong co duong UPDATE hay DELETE nao trong ma.
CREATE TABLE job_frame_corrections (
  id              text PRIMARY KEY,
  job_id          text NOT NULL REFERENCES processing_jobs (id),
  workspace_id    text NOT NULL REFERENCES workspaces (id),
  frame_index     integer NOT NULL CHECK (frame_index >= 0),
  -- Ban ghi TRUOC khi sua. Thieu ve nay thi khong doi chieu lai duoc quyet dinh cua nguoi dung.
  before_state    text NOT NULL,
  before_source   text NOT NULL,
  before_box      jsonb,
  before_confidence double precision,
  after_box       jsonb NOT NULL,
  reinterpolated  integer[] NOT NULL DEFAULT '{}',
  corrected_at    timestamptz NOT NULL,
  actor_user_id   text REFERENCES users (id)
);

CREATE INDEX job_frame_corrections_job_idx ON job_frame_corrections (job_id, corrected_at);

COMMENT ON TABLE job_frame_corrections IS
  'APPEND-ONLY. Moi lan nguoi that sua mask la mot dong moi, giu CA truoc lan sau. Ghi de la xoa bang chung.';

INSERT INTO schema_migrations (version) VALUES ('0010_phase4_frame_tracking')
ON CONFLICT (version) DO NOTHING;

COMMIT;
