/**
 * P1.1-Q20-MCP-20: cau chu canonical va tinh bat bien cua van ban da phat hanh.
 *
 * Hai nhom khang dinh:
 *  1. Cau owner duyet phai dung TUNG CHU.
 *  2. Van ban cua version DA PHAT HANH khong bao gio duoc sua - do la bang chung
 *     cho nhung loi khai da ky. Doi chu = phai len version moi, khong sua tai cho.
 */
import { describe, expect, it } from 'vitest';
import { RIGHTS_STATEMENT } from '../../contracts/src/policy.js';
import { MESSAGES } from '../src/index.js';

/** Ban owner duyet (Q-20 closure prompt muc 3). Khong duoc sua o day de "cho test xanh". */
const CANONICAL_VI = 'MediaClear Pro chỉ hỗ trợ xử lý logo, nhãn hiệu và dấu hiệu nhận diện nhìn thấy được';
const RIGHTS_CONFIRMATION_VI = 'Tôi xác nhận rằng tôi sở hữu nội dung này hoặc có quyền chỉnh sửa nội dung này.';

/**
 * Van ban DA PHAT HANH. Khoa cung o day de moi lan ai do sua file dich deu bi chan.
 * v1 = ban Phase 0/1, v2 = ban owner duyet o Phase 1.1 (dang hieu luc).
 */
const PUBLISHED_STATEMENTS: Record<string, string> = {
  'rights.attestation.v1.statement':
    'Tôi xác nhận tôi sở hữu hoặc có quyền chỉnh sửa nội dung này, và tôi chịu trách nhiệm về việc sử dụng kết quả sau khi xử lý.',
  'rights.attestation.v2.statement': RIGHTS_CONFIRMATION_VI,
};

describe('Q-20 — cau chu canonical', () => {
  it('cau pham vi ho tro dung tung chu ban owner duyet', () => {
    expect(MESSAGES.vi['policy.visible_identity_scope']).toBe(CANONICAL_VI);
  });

  it('cau xac nhan quyen dung tung chu ban owner duyet', () => {
    expect(MESSAGES.vi['rights.attestation.v2.statement']).toBe(RIGHTS_CONFIRMATION_VI);
  });

  it('ban English cua cau pham vi dung tu ngu owner dua', () => {
    const en = MESSAGES.en['policy.visible_identity_scope'] ?? '';
    expect(en).toContain('only supports processing visible logos');
    expect(en).toContain('trademarks');
    expect(en).toContain('identifying marks');
  });

  it('cau ve du lieu con sot KHONG hua hen dieu he thong khong lam duoc', () => {
    for (const locale of ['vi', 'en'] as const) {
      const text = MESSAGES[locale]['provenance.retained_data_note'] ?? '';
      expect(text.length).toBeGreaterThan(20);
      // "co the van duoc giu" - khong khang dinh luon con, cung khong hua go bo.
      expect(text).not.toMatch(/luôn (còn|được giữ)|always (remain|retained)/i);
      expect(text).not.toMatch(/sẽ (gỡ|xoá|xóa|loại bỏ)|will remove|can remove/i);
    }
  });

  it('khong cau nao khang dinh kiem soat duoc dau hieu nhan dien vo hinh', () => {
    const forbidden = /(có thể|we can|able to)\s*(xoá|xóa|gỡ|vô hiệu|remove|disable|control)\s*(được)?\s*(synthid|dấu hiệu nhận diện vô hình|invisible)/i;
    for (const locale of ['vi', 'en'] as const) {
      const offenders = Object.entries(MESSAGES[locale])
        .filter(([, value]) => forbidden.test(value))
        .map(([key]) => key);
      expect(offenders, `locale ${locale}`).toEqual([]);
    }
  });
});

describe('Q-20 — van ban da phat hanh khong bi sua', () => {
  it('van ban v1 va v2 giu nguyen tung chu', () => {
    for (const [key, text] of Object.entries(PUBLISHED_STATEMENTS)) {
      expect(MESSAGES.vi[key], `van ban da phat hanh bi sua: ${key}`).toBe(text);
    }
  });

  it('van ban v1 va v2 khac nhau - neu giong thi viec len version la vo nghia', () => {
    expect(MESSAGES.vi['rights.attestation.v1.statement']).not.toBe(MESSAGES.vi['rights.attestation.v2.statement']);
  });

  it('ban v1 van doc duoc o ca hai locale (ho so lich su phai tra cuu duoc)', () => {
    expect(MESSAGES.vi['rights.attestation.v1.statement']).toBeTruthy();
    expect(MESSAGES.en['rights.attestation.v1.statement']).toBeTruthy();
  });

  it('version dang hieu luc van la 2 va tro dung khoa v2', () => {
    expect(RIGHTS_STATEMENT.version).toBe(2);
    expect(RIGHTS_STATEMENT.i18nKey).toBe('rights.attestation.v2.statement');
    expect(MESSAGES.vi[RIGHTS_STATEMENT.i18nKey]).toBe(RIGHTS_CONFIRMATION_VI);
  });
});

describe('Q-20 — khoa dich', () => {
  it('moi khoa rights/provenance/policy co o CA HAI locale', () => {
    const keys = Object.keys(MESSAGES.vi).filter((k) => /^(rights|provenance|policy)\./.test(k));
    expect(keys.length).toBeGreaterThan(20);
    const missing = keys.filter((k) => MESSAGES.en[k] === undefined);
    expect(missing).toEqual([]);
  });

  it('khong gia tri nao trong ra nhu mot khoa dich tho', () => {
    for (const locale of ['vi', 'en'] as const) {
      const rawish = Object.entries(MESSAGES[locale])
        .filter(([, value]) => /^[a-z0-9_]+(\.[a-z0-9_]+){2,}$/.test(value.trim()))
        .map(([key]) => key);
      expect(rawish, `locale ${locale}`).toEqual([]);
    }
  });

  it('noi suy khong lech giua vi va en', () => {
    const placeholders = (s: string) => (s.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).sort().join(',');
    const mismatched = Object.keys(MESSAGES.vi).filter(
      (k) => placeholders(MESSAGES.vi[k] ?? '') !== placeholders(MESSAGES.en[k] ?? ''),
    );
    expect(mismatched, 'lech tham so noi suy').toEqual([]);
  });

  it('khoa moi cua Q-20 deu khong gan version (nhan giao dien, khong phai van ban ky)', () => {
    for (const key of ['rights.attestation.scope_heading', 'rights.attestation.statement_version_label']) {
      expect(MESSAGES.vi[key], `thieu ${key}`).toBeTruthy();
      expect(key).not.toMatch(/\.v\d+\./);
    }
  });
});
