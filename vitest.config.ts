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
  },
});
