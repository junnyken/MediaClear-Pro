-- 0013_p5_metadata_unmeasured_and_branding
--
-- `D-076` (Q-P5-02) va `D-077` (Q-P5-03). CHI THEM COT/BANG. Khong xoa, khong doi kieu.

BEGIN;

-- ---------------------------------------------------------------- D-076
--
-- The he thong BIET la co the ton tai nhung KHONG doc duoc.
--
-- Phai LUU, khong duoc tinh lai luc doc: danh sach nay la thuoc tinh cua LAN DO do, khong phai cua
-- ma nguon hom nay. Neu ve sau bo doc them the moi, mot anh chup cu tinh lai theo danh sach moi se
-- noi rang lan do cu đã đo nhung the no chua he doc — tuc la ho so noi doi ve qua khu.
ALTER TABLE job_metadata_snapshots
  ADD COLUMN unmeasured_keys text[] NOT NULL DEFAULT '{}';

-- ---------------------------------------------------------------- D-077
--
-- Tep logo cua mot phien ban bo nhan dien.
--
-- Bang RIENG, khong nhet vao `brand_kit_versions`: phien ban la BAT BIEN, con tep logo can duoc do
-- lai (kich thuoc, checksum) va co vong doi rieng. Gop chung se buoc phai UPDATE mot dong bat bien.
CREATE TABLE brand_logo_assets (
  id             text PRIMARY KEY,
  workspace_id   text NOT NULL REFERENCES workspaces (id),
  brand_kit_id   text NOT NULL REFERENCES brand_kits (id),
  storage_key    text NOT NULL,
  mime_type      text NOT NULL,
  byte_size      bigint NOT NULL CHECK (byte_size > 0),
  width_px       integer NOT NULL CHECK (width_px > 0),
  height_px      integer NOT NULL CHECK (height_px > 0),
  checksum_sha256 text NOT NULL,
  created_at     timestamptz NOT NULL,
  created_by_user_id text REFERENCES users (id)
);

CREATE INDEX brand_logo_assets_kit_idx ON brand_logo_assets (workspace_id, brand_kit_id, created_at DESC);

-- Bien nhan ghi ro CO ap dung lop phu hay khong, va ap dung nhung gi.
--
-- `brand_overlay_applied` la mot cot RIENG, khong suy tu `brand_kit_id IS NOT NULL`: nguoi dung co
-- the chon mot bo nhan dien roi TAT lop phu. Suy tu su co mat cua id se noi sai trong dung ca do.
ALTER TABLE processing_receipts
  ADD COLUMN brand_logo_asset_id text,
  ADD COLUMN brand_overlay_applied boolean NOT NULL DEFAULT false,
  ADD COLUMN disclosure_overlay_applied boolean NOT NULL DEFAULT false;

-- Lop phu cua MOT luot xu ly. `NULL` = nguoi dung khong chon gi — va do la mac dinh.
--
-- Mot cot jsonb chu khong phai bon cot roi: bon truong nay chi co nghia KHI DI CUNG NHAU. Tach ra
-- se mo kha nang mot job co `applyLogo = true` ma khong co `brandKitId` nao.
ALTER TABLE processing_jobs
  ADD COLUMN branding jsonb;

COMMIT;
