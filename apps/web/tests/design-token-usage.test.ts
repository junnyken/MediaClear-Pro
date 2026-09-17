/**
 * Moi `var(--mcp-*)` dung trong giao dien phai CO THAT trong bo token.
 *
 * Vi sao can: token bia ra hong IM LANG. Trinh duyet gap `var(--khong-ton-tai)` khong co gia tri
 * du phong thi BO LUON thuoc tinh do — khong loi, khong canh bao. `tsc`, `eslint`, toan bo test
 * va ca `next build` deu xanh.
 *
 * Day khong phai gia dinh: trong lan dung o chon tep (`D-064`) toi da dung ba ten khong ton tai —
 * `--mcp-border`, `--mcp-surface-2`, `--mcp-accent` — va chi phat hien ra khi NHIN vao anh chup
 * thay o chon tep khong co vien. Phep chan nay bien "nhin moi thay" thanh "test do".
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_DIR = join(import.meta.dirname, '../app');
const TOKENS_CSS = join(import.meta.dirname, '../../../packages/design-tokens/src/tokens.css');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

/** Ten token DA KHAI BAO, doc thang tu tep css chu khong chep tay sang day. */
function declaredTokens(): Set<string> {
  const css = readFileSync(TOKENS_CSS, 'utf8');
  return new Set([...css.matchAll(/(--mcp-[a-z0-9-]+)\s*:/g)].map((m) => m[1] as string));
}

describe('token giao dien', () => {
  it('bo token khong rong (neu rong thi phep chan duoi thanh vo nghia)', () => {
    expect(declaredTokens().size).toBeGreaterThan(10);
  });

  it('khong man hinh nao dung token CHUA duoc khai bao', () => {
    const declared = declaredTokens();
    const offenders: string[] = [];
    for (const file of sourceFiles(APP_DIR)) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/var\(\s*(--mcp-[a-z0-9-]+)\s*([,)])/g)) {
        const name = m[1] as string;
        // Co gia tri du phong (`var(--x, ...)`) thi khong hong im lang.
        if (m[2] === ',') continue;
        if (!declared.has(name)) offenders.push(`${file.replace(APP_DIR, 'app')}: ${name}`);
      }
    }
    expect(offenders, 'token khong ton tai => trinh duyet bo luon thuoc tinh, khong bao loi').toEqual([]);
  });
});
