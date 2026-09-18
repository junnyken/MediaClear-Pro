#!/usr/bin/env bash
#
# Dung lai moi truong phat trien sau khi workspace mat goi he thong.
#
# VI SAO CAN TEP NAY: workspace nay tung mat CUNG LUC `ffmpeg`, toan bo font, `libnss3`/`libnspr4`
# va ca container PostgreSQL sau mot lan khoi dong lai (2026-09-18). Hau qua te nhat khong phai la
# loi — ma la 78 phep kiem bi BO QUA IM LANG trong khi ca bo test van bao xanh.
#
# Chay tep nay truoc khi ket luan bat cu dieu gi tu ket qua test.
#
#   bash scripts/dev-setup.sh          # cai + dung + kiem
#   bash scripts/dev-setup.sh --check  # CHI kiem, khong cai gi
#
set -uo pipefail

CHI_KIEM=0
[ "${1:-}" = "--check" ] && CHI_KIEM=1

PG_CONTAINER=mcp-pg
PG_PORT=55432
PG_USER=mcp
PG_PASS=mcp
TEST_DB=mcp_test

thieu=()

echo "=== Kiem moi truong ==="

# --- cong cu media -------------------------------------------------------------
if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; then
  echo "  ffmpeg/ffprobe : co  ($(ffmpeg -version 2>/dev/null | head -1 | cut -d' ' -f3))"
else
  echo "  ffmpeg/ffprobe : THIEU"
  thieu+=(ffmpeg)
fi

# --- font ----------------------------------------------------------------------
#
# Dem font KHONG du de ket luan: font co the co mat ma van khong ve duoc chu Viet co dau.
# Nhung o muc script nay, dem font la phep kiem re va du de phat hien truong hop mat sach.
SO_FONT=$(fc-list 2>/dev/null | wc -l)
if [ "$SO_FONT" -gt 0 ]; then
  echo "  font           : co  ($SO_FONT font)"
else
  echo "  font           : THIEU  -> lop phu cong bo AI se KHONG ve duoc chu"
  thieu+=(fontconfig)
fi

# --- thu vien cho Chrome (bam tay giao dien) ------------------------------------
#
# KHONG dung `grep -q` trong mot ong khi da bat `pipefail`: `grep -q` thoat NGAY sau lan khop dau
# tien, `ldconfig` nhan SIGPIPE, va `pipefail` lay ma loi cua `ldconfig` lam ma cua ca ong. Ket qua
# la mot bao cao "THIEU" hoan toan sai — chinh tep nay da mac loi do o ban dau tien.
SO_NSS=$(ldconfig -p 2>/dev/null | grep -c libnss3 || true)
if [ "${SO_NSS:-0}" -gt 0 ]; then
  echo "  libnss3        : co"
else
  echo "  libnss3        : THIEU  -> Chrome se bao 'Target closed'"
  thieu+=(libnss3)
fi

# --- PostgreSQL ------------------------------------------------------------------
SO_PG=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -cx "$PG_CONTAINER" || true)
if [ "${SO_PG:-0}" -gt 0 ]; then
  echo "  PostgreSQL     : dang chay ($PG_CONTAINER:$PG_PORT)"
else
  echo "  PostgreSQL     : KHONG chay"
  thieu+=(postgres)
fi

if [ "$CHI_KIEM" = "1" ]; then
  if [ ${#thieu[@]} -eq 0 ]; then
    echo "=> DAY DU."
    exit 0
  fi
  echo "=> THIEU: ${thieu[*]}   (chay lai khong kem --check de cai)"
  exit 1
fi

if [ ${#thieu[@]} -eq 0 ]; then
  echo "=> DAY DU, khong can cai gi."
else
  echo
  echo "=== Cai lai: ${thieu[*]} ==="

  # `apt-get update` TRUOC: chi so cu se bao "Unable to locate package" cho nhung goi CO THAT.
  CAN_APT=$(printf '%s\n' "${thieu[@]}" | grep -cE 'ffmpeg|fontconfig|libnss3' || true)
  if [ "${CAN_APT:-0}" -gt 0 ]; then
    sudo apt-get update -qq || true
  fi

  for goi in "${thieu[@]}"; do
    case "$goi" in
      ffmpeg)      sudo apt-get install -y -qq ffmpeg ;;
      fontconfig)  sudo apt-get install -y -qq fontconfig fonts-dejavu-core ;;
      libnss3)     sudo apt-get install -y -qq libnss3 libnspr4 libgbm1 libasound2t64 ;;
      postgres)
        docker rm -f "$PG_CONTAINER" >/dev/null 2>&1 || true
        docker run -d --name "$PG_CONTAINER" \
          -e POSTGRES_USER="$PG_USER" -e POSTGRES_PASSWORD="$PG_PASS" -e POSTGRES_DB=mcp \
          -p "$PG_PORT:5432" postgres:16 >/dev/null
        echo -n "  doi PostgreSQL san sang"
        until docker exec "$PG_CONTAINER" pg_isready -U "$PG_USER" >/dev/null 2>&1; do
          echo -n "."; sleep 2
        done
        echo " xong"
        ;;
    esac
  done
fi

# --- database cho test -----------------------------------------------------------
docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d postgres \
  -c "CREATE DATABASE $TEST_DB;" >/dev/null 2>&1 || true

echo
echo "=== Kiem lai bang CHINH cong chan cua bo test ==="
cd "$(dirname "$0")/.." || exit 1
MEDIACLEAR_REQUIRE_FULL_ENV=1 \
MEDIACLEAR_TEST_DATABASE_URL="postgres://$PG_USER:$PG_PASS@127.0.0.1:$PG_PORT/$TEST_DB" \
  pnpm -s exec vitest run apps/api/tests/p0-environment.test.ts 2>&1 | grep -E "\[moi truong\]|Tests " || true

cat <<EOF

=== Chay test ===

  export MEDIACLEAR_TEST_DATABASE_URL='postgres://$PG_USER:$PG_PASS@127.0.0.1:$PG_PORT/$TEST_DB'
  export MEDIACLEAR_REQUIRE_FULL_ENV=1     # thieu cong cu => DO, khong bo qua im lang
  pnpm check

Luon doc CA so 'skipped', khong chi 'passed'. '0 skipped' moi la con so co nghia.
EOF
