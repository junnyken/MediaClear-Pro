import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    // Test LUON chay tren source, khong chay tren dist cu (tranh xanh gia).
    alias: {
      '@mediaclear/contracts': src('./packages/contracts/src/index.ts'),
      '@mediaclear/i18n': src('./packages/i18n/src/index.ts'),
      '@mediaclear/design-tokens': src('./packages/design-tokens/src/index.ts'),
    },
  },
  test: {
    include: ['packages/**/tests/**/*.test.ts', 'apps/**/tests/**/*.test.ts'],
    environment: 'node',
    /*
     * `D-076`/`D-077`. Han mac dinh 5s la QUA CHAT cho bo test nay.
     *
     * Nhieu tep test chay SONG SONG nhung cung tranh nhau MOT PostgreSQL va MOT ffmpeg — hai tai
     * nguyen noi tiep. Do duoc `2026-09-18`: `p2-audit-pagination` va `p2-migrate` chay RIENG thi
     * xanh het (14/14 va 8/8), chay trong ca bo thi qua gio — khong mot khang dinh nao sai, chi la
     * het gio cho.
     *
     * Do la mot loai DO GIA: no khong chi ra loi nao, nhung no lam ca bo test mat gia tri canh bao
     * (mot lan do that se lan trong nhung lan do gia). Nang han la cach dung: cac phep kiem do
     * khang dinh TINH DUNG, khong khang dinh do tre. Muon canh do tre thi phai la mot phep kiem
     * RIENG voi nguong duoc chon co ly do.
     */
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
