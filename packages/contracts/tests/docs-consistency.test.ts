/**
 * Docs consistency (MCP-08): tai lieu phai khop voi contract that trong code.
 * Test nay chan kieu "docs noi mot dang, code lam mot neo".
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_ROUTES } from '../src/api.js';
import { INVARIANTS } from '../src/invariants.js';
import { JOB_STATES } from '../src/vocabulary.js';

const DOCS = join(import.meta.dirname, '../../../docs');
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8');

describe('docs consistency', () => {
  it('moi route trong API_ROUTES deu duoc ghi trong API.md', () => {
    const api = read('API.md');
    for (const route of API_ROUTES) {
      expect(api, `API.md thieu route ${route.path}`).toContain(route.path);
    }
  });

  it('API.md khong ghi route la nghiep vu da chay khi code van tra 501', () => {
    const planned = API_ROUTES.filter((r) => r.status === 'planned');
    expect(planned.length).toBe(API_ROUTES.length - 1); // chi /healthz la implemented
    expect(read('API.md')).toContain('501');
  });

  it('moi invariant deu duoc liet ke trong TEST_STRATEGY.md', () => {
    const strategy = read('TEST_STRATEGY.md');
    for (const id of Object.keys(INVARIANTS)) {
      expect(strategy, `TEST_STRATEGY.md thieu ${id}`).toContain(id);
    }
  });

  it('moi job state deu duoc mo ta trong DATA_MODEL.md', () => {
    const model = read('DATA_MODEL.md');
    for (const state of JOB_STATES) {
      expect(model, `DATA_MODEL.md thieu state ${state}`).toContain(state);
    }
  });

  it('khong tai lieu nao claim xoa/kiem soat duoc watermark vo hinh (guardrail 4)', () => {
    const files = readdirSync(DOCS).filter((f) => f.endsWith('.md'));
    const offenders: string[] = [];
    const TRIGGER = /synthid|watermark vô hình|invisible watermark|dấu ẩn/i;
    // Phu dinh / nhan pham vi - du de mot CAU duoc coi la khong phai loi khang dinh nang luc.
    const NEGATION = /không|no |never|out_of_scope|claim|cannot|chưa|vi phạm|phủ định/i;
    for (const file of files) {
      // Markdown xuong dong cung => phai ghep lai thanh doan roi tach theo CAU,
      // neu khong se bao dong nam giua cau la vi pham (false positive).
      const paragraphs = read(file).split(/\n\s*\n/);
      for (const paragraph of paragraphs) {
        const joined = paragraph.replace(/\n/g, ' ');
        const sentences = joined.split(/(?<=[.!?:])\s+|\s\|\s/);
        for (const sentence of sentences) {
          if (!TRIGGER.test(sentence)) continue;
          if (!NEGATION.test(sentence)) offenders.push(`${file}: ${sentence.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('PROVIDER_BENCHMARK.md khong chua so lieu bia (chua chay benchmark)', () => {
    const bench = read('PROVIDER_BENCHMARK.md');
    const rows = bench.split('\n').filter((l) => /^\| S\d+ \|/.test(l));
    expect(rows.length).toBe(10);
    for (const row of rows) {
      // Moi o so lieu phai la 'unknown' hoac '—', khong duoc co con so.
      const cells = row.split('|').slice(4, -1).map((c) => c.trim());
      for (const cell of cells) {
        expect(/^(unknown|—|-)$/.test(cell), `so lieu bia trong benchmark: "${cell}"`).toBe(true);
      }
    }
  });
});
