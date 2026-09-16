#!/bin/sh
# Chon thanh phan chay theo MEDIACLEAR_ROLE (P2-MCP-26).
#
# Mot anh, hai vai. Vibe Host tao hai website tu CUNG mot repo, khac nhau o bien moi truong.
set -eu

ROLE="${MEDIACLEAR_ROLE:-api}"
PORT="${PORT:-3000}"

case "$ROLE" in
  api)
    # Migration chay o trong server.js truoc khi nhan request dau tien.
    echo "[mediaclear] vai: api | cong: $PORT"
    exec env PORT="$PORT" node apps/api/dist/server.js
    ;;
  worker)
    # Worker KHONG mo cong mang: no khong phuc vu request nao, chi doc hang doi.
    echo "[mediaclear] vai: worker"
    exec node apps/api/dist/worker/main.js
    ;;
  web)
    echo "[mediaclear] vai: web | cong: $PORT | api: ${MEDIACLEAR_API_BASE_URL:-(chua dat)}"
    cd apps/web
    exec ./node_modules/.bin/next start -p "$PORT"
    ;;
  *)
    echo "[mediaclear] MEDIACLEAR_ROLE khong hop le: '$ROLE' (chi nhan 'api', 'web' hoac 'worker')" >&2
    exit 2
    ;;
esac
