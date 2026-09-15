/**
 * P1.1-MCP-16: index MINI-SPEC phai la nguon tra cuu dung, kiem duoc bang may.
 * Test doc THU MUC THAT tren dia, khong dua vao viec con nguoi nho cap nhat.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_ROUTES } from '../src/api.js';

const ROOT = join(import.meta.dirname, '../../..');
const INDEX_PATH = join(ROOT, 'docs/MINI_SPEC_INDEX.md');
const CANONICAL = /^P(?:0|1|1\.1|2)-MCP-\d{2}$/;

interface Row {
  canonical: string;
  historical: string;
  phase: string;
  name: string;
  path: string;
  status: string;
}

function indexRows(): Row[] {
  const text = readFileSync(INDEX_PATH, 'utf8');
  const rows: Row[] = [];
  for (const line of text.split('\n')) {
    const match = /^\|\s*`(P[^`]+)`\s*\|([^|]*)\|([^|]*)\|([^|]*)\|\s*`([^`]+)`\s*\|([^|]*)\|/.exec(line);
    if (!match) continue;
    rows.push({
      canonical: match[1] as string,
      historical: (match[2] as string).trim(),
      phase: (match[3] as string).trim(),
      name: (match[4] as string).trim(),
      path: match[5] as string,
      status: (match[6] as string).trim(),
    });
  }
  return rows;
}

function miniSpecFiles(): string[] {
  const dirs = ['docs/mini-specs', 'docs/mini-specs/phase-1', 'docs/mini-specs/phase-1.1'];
  const files: string[] = [];
  for (const dir of dirs) {
    const full = join(ROOT, dir);
    if (!existsSync(full)) continue;
    for (const entry of readdirSync(full)) {
      if (entry.endsWith('.md')) files.push(`${dir}/${entry}`);
    }
  }
  return files;
}

describe('MINI_SPEC_INDEX', () => {
  const rows = indexRows();

  it('index ton tai va co du hang', () => {
    expect(existsSync(INDEX_PATH)).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(21);
  });

  it('khong co hai canonical ID trung nhau', () => {
    const seen = new Map<string, number>();
    for (const row of rows) seen.set(row.canonical, (seen.get(row.canonical) ?? 0) + 1);
    const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([id]) => id);
    expect(duplicates, 'canonical ID bi trung').toEqual([]);
  });

  it('moi canonical ID dung dinh dang co tien to phase', () => {
    const wrong = rows.filter((row) => !CANONICAL.test(row.canonical)).map((row) => row.canonical);
    expect(wrong, 'ID thieu tien to phase').toEqual([]);
  });

  it('moi file MINI-SPEC tren dia deu co hang trong index', () => {
    const indexed = new Set(rows.map((row) => row.path));
    const missing = miniSpecFiles().filter((file) => !indexed.has(file));
    expect(missing, 'file chua duoc ghi vao index').toEqual([]);
  });

  it('moi duong dan trong index deu tro toi file co that', () => {
    const broken = rows.filter((row) => !existsSync(join(ROOT, row.path))).map((row) => row.path);
    expect(broken, 'index tro toi file khong ton tai').toEqual([]);
  });

  it('historical ID cua Phase 0/Phase 1 khong bi xoa khoi index', () => {
    const historical = rows.filter((r) => r.phase !== 'Phase 1.1').map((r) => r.historical);
    expect(historical.every((h) => h.includes('MCP-'))).toBe(true);
    // Va chan da biet: MCP-10 xuat hien o CA HAI phase, ca hai deu phai co mat.
    const mcp10 = rows.filter((r) => r.historical.startsWith('`MCP-10') || r.historical.includes('MCP-10'));
    expect(mcp10.length).toBe(2);
  });

  it('MINI-SPEC moi (Phase 1.1) dung ID co tien to phase trong CA ten file', () => {
    const phase11 = miniSpecFiles().filter((f) => f.includes('phase-1.1/'));
    expect(phase11.length).toBeGreaterThanOrEqual(4);
    for (const file of phase11) {
      expect(file, 'file moi phai mang canonical ID').toMatch(/P1\.1-MCP-\d{2}\.md$/);
    }
  });

  it('moi tham chieu mcp trong API_ROUTES deu la canonical ID co trong index', () => {
    const canonicalIds = new Set(rows.map((row) => row.canonical));
    const orphans = [...new Set(API_ROUTES.map((route) => route.mcp))].filter((id) => !canonicalIds.has(id));
    expect(orphans, 'API_ROUTES tro toi MINI-SPEC khong co trong index').toEqual([]);
  });

  it('khong route nao con dung quy uoc cu (MCP-xx hoac MCP-xx-P1)', () => {
    const legacy = [...new Set(API_ROUTES.map((r) => r.mcp))].filter((id) => !CANONICAL.test(id));
    expect(legacy, 'con quy uoc cu trong ma nguon').toEqual([]);
  });
});
