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
import { ALL_ERROR_CODES } from '../src/errors.js';
import { WORKSPACE_ROLES } from '../src/tenancy.js';
import {
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_HEIGHT,
  MAX_VIDEO_WIDTH,
  RIGHTS_ATTESTATION_VALIDITY_DAYS,
} from '../src/config.js';

const DOCS = join(import.meta.dirname, '../../../docs');
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8');

describe('docs consistency', () => {
  it('moi route trong API_ROUTES deu duoc ghi trong API.md', () => {
    const api = read('API.md');
    for (const route of API_ROUTES) {
      expect(api, `API.md thieu route ${route.path}`).toContain(route.path);
    }
  });

  it('API.md ghi DUNG trang thai cua tung route (khong the noi da chay khi chua chay)', () => {
    const api = read('API.md');
    const missing: string[] = [];
    for (const route of API_ROUTES) {
      // Hang bang phai khop chinh xac ca trang thai: docs khong duoc "lac" khoi code.
      const row = `| ${route.method} | \`${route.path}\` | ${route.status} |`;
      if (!api.includes(row)) missing.push(row);
    }
    expect(missing, 'API.md lech trang thai so voi API_ROUTES').toEqual([]);
    expect(api).toContain('501');
  });

  it('moi ma loi trong catalogue deu co trong bang mapping cua API.md', () => {
    const api = read('API.md');
    for (const code of ALL_ERROR_CODES) {
      expect(api, `API.md thieu mapping cho ${code}`).toContain(code);
    }
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

  it('moi role deu duoc mo ta trong POLICY.md', () => {
    const policy = read('POLICY.md');
    for (const role of WORKSPACE_ROLES) {
      expect(policy, `POLICY.md thieu role ${role}`).toContain(role);
    }
  });

  it('cac gioi han trong docs khop voi config tap trung', () => {
    const scope = read('PRODUCT_SCOPE.md');
    expect(scope).toContain('199 MB');
    expect(scope).toContain('09:59');
    expect(scope).toContain(String(MAX_VIDEO_DURATION_SECONDS));
    expect(scope).toContain(String(MAX_VIDEO_WIDTH));
    expect(scope).toContain(String(MAX_VIDEO_HEIGHT));
    expect(scope).toContain(String(RIGHTS_ATTESTATION_VALIDITY_DAYS));
  });

  it('khong con cau hoi nao vua "da chot" vua "dang mo" trong OPEN_QUESTIONS.md', () => {
    const doc = read('OPEN_QUESTIONS.md');
    const openSection = doc.slice(doc.indexOf('## 1. Đang mở'), doc.indexOf('## 2. Đã giải quyết'));
    const resolvedSection = doc.slice(doc.indexOf('## 2. Đã giải quyết'));
    const idsIn = (text: string) =>
      new Set([...text.matchAll(/^\| (Q-\d+) \|/gm)].map((m) => m[1] as string));
    const open = idsIn(openSection);
    const resolved = idsIn(resolvedSection);
    const both = [...open].filter((id) => resolved.has(id));
    expect(both, `cau hoi ton tai o ca hai trang thai: ${both.join(', ')}`).toEqual([]);
    // 7 cau hoi owner da chot phai nam o muc da giai quyet.
    for (const id of ['Q-01', 'Q-03', 'Q-04', 'Q-06', 'Q-08', 'Q-09', 'Q-10']) {
      expect(resolved.has(id), `${id} chua duoc danh dau resolved`).toBe(true);
      expect(open.has(id), `${id} van con o muc dang mo`).toBe(false);
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
