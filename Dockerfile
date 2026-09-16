# MediaClear Pro - mot anh cho CA HAI thanh phan (P2-MCP-26).
#
# Vi sao MOT Dockerfile chu khong phai hai: day la monorepo pnpm, `apps/api` phu thuoc
# `@mediaclear/contracts` qua `workspace:*`. Build rieng `apps/api` lam ngu canh build se
# KHONG co cac goi o goc => hong. Nen build ca workspace mot lan, roi chon thanh phan nao
# chay bang bien `MEDIACLEAR_ROLE`.

# ---------- Chang 1: cai phu thuoc ----------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

# Chi chep manifest truoc de tan dung cache: doi ma nguon khong bat cai lai tu dau.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json      packages/contracts/
COPY packages/i18n/package.json           packages/i18n/
COPY packages/design-tokens/package.json  packages/design-tokens/
COPY apps/api/package.json                apps/api/
COPY apps/web/package.json                apps/web/
RUN pnpm install --frozen-lockfile

# ---------- Chang 2: build ----------
FROM deps AS build
WORKDIR /app
COPY . .
# Build goi workspace TRUOC roi moi build web: Next dong goi ban dist cua cac goi nay.
# Bo qua buoc nay tung lam giao dien hien ra KHOA DICH THO (bai hoc Phase 1).
RUN pnpm build:packages \
 && pnpm --filter @mediaclear/api build \
 && pnpm --filter @mediaclear/web build

# ---------- Chang 3: chay ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Cua dev PHAI dong o production: neu khong, bat ky ai go bat ky email nao cung vao duoc.
ENV MEDIACLEAR_DEV_AUTH=0
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

# ffmpeg cho toan bo Phase 3 (P3-MCP-30…34). KHONG co no thi worker nhan job video roi hong NGAY:
# `sharp` chi lam duoc anh. Cai o chang CHAY chu khong phai chang build, vi worker la thu can no.
RUN apt-get update \
 && apt-get install --no-install-recommends -y ffmpeg \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build /app ./

# Khong chay bang root.
RUN useradd --system --create-home --uid 10001 mediaclear \
 && chown -R mediaclear:mediaclear /app
USER mediaclear

COPY --chown=mediaclear:mediaclear docker/entrypoint.sh /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
