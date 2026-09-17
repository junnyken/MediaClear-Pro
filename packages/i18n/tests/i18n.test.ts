import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, MESSAGES, formatBytes, formatDuration, t } from '../src/index.js';
import { ALL_ERROR_CODES, errorI18nKey } from '../../contracts/src/errors.js';
import { EVIDENCE_STATUSES, JOB_STATES } from '../../contracts/src/vocabulary.js';
import { FRAME_STATES, MASK_SOURCES, QUALITY_GATE_REASONS, QUALITY_GATE_VERDICTS } from '../../contracts/src/phase4.js';

describe('i18n foundation', () => {
  it('tieng Viet la locale mac dinh', () => {
    expect(DEFAULT_LOCALE).toBe('vi');
  });

  it('vi va en co key trung khop tuyet doi', () => {
    const viKeys = Object.keys(MESSAGES.vi).sort();
    const enKeys = Object.keys(MESSAGES.en).sort();
    expect(enKeys).toEqual(viKeys);
  });

  it('khong co gia tri rong o bat ky locale nao', () => {
    for (const [locale, table] of Object.entries(MESSAGES)) {
      for (const [key, value] of Object.entries(table)) {
        expect(value.trim().length, `${locale}.${key} rong`).toBeGreaterThan(0);
      }
    }
  });

  it('moi ma loi trong catalogue deu co ban dich o ca hai locale', () => {
    for (const code of ALL_ERROR_CODES) {
      const key = errorI18nKey(code);
      expect(MESSAGES.vi[key], `thieu vi: ${key}`).toBeDefined();
      expect(MESSAGES.en[key], `thieu en: ${key}`).toBeDefined();
    }
  });

  it('moi job state va evidence status deu co nhan hien thi', () => {
    for (const s of JOB_STATES) expect(MESSAGES.vi[`job_state.${s}`]).toBeDefined();
    for (const s of EVIDENCE_STATUSES) expect(MESSAGES.vi[`evidence.${s}`]).toBeDefined();
  });

  /*
   * `D-074`. Giao dien dich cac gia tri nay bang KHOA DONG — `translate(`gate_verdict.${v}`)`.
   *
   * Phep chan i18n ben `apps/web` chi quet duoc `translate('chuoi tinh')`, nen khoa dong nam ngoai
   * tam nhin cua no: them mot gia tri vao enum ma quen them ban dich se lam man hinh hien nguyen
   * `gate_verdict.<gi do>` cho nguoi dung, va KHONG test nao do duoc. Day la duong chan con lai.
   */
  it('moi gia tri enum Phase 4 duoc dich bang khoa DONG deu co nhan o ca hai ngon ngu', () => {
    const bang: Array<[string, readonly string[]]> = [
      ['gate_verdict', QUALITY_GATE_VERDICTS],
      ['gate_reason', QUALITY_GATE_REASONS],
      ['frame_state', FRAME_STATES],
      ['mask_source', MASK_SOURCES],
    ];
    const thieu: string[] = [];
    for (const [tienTo, values] of bang) {
      for (const v of values) {
        const key = `${tienTo}.${v}`;
        if (MESSAGES.vi[key] === undefined) thieu.push(`vi: ${key}`);
        if (MESSAGES.en[key] === undefined) thieu.push(`en: ${key}`);
      }
    }
    expect(thieu, 'man hinh se hien khoa tho thay vi cau chu').toEqual([]);
  });

  it('wording tieng Viet khong ro ri thuat ngu ky thuat cho nguoi dung cuoi', () => {
    /*
     * Danh sach nay duoc MO RONG o P3 (D-059) sau khi ra soat 77 khoa moi: chuoi
     * `provenance.limitation.no_c2pa_reader` da de lot `C2PA / Content Credentials` ra man hinh
     * nguoi dung — dung ten chuan thi chinh xac voi nguoi trong nghe, nhung voi nguoi dung cuoi no
     * khong mang thong tin gi. Ten chuan thuoc ve TAI LIEU, khong thuoc ve giao dien.
     */
    const jargon = /inpaint|mask|provenance|metadata|watermark|endpoint|payload|C2PA|Content Credentials|checksum|codec|proxy|token|SHA-?256|JSON|API\b/i;
    const offenders = Object.entries(MESSAGES.vi)
      .filter(([, value]) => jargon.test(value))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });

  it('gia tri khong xac dinh hien thi "Chua xac dinh", khong hien 0', () => {
    expect(formatDuration('vi', null)).toBe('Chưa xác định');
    expect(formatBytes('vi', null)).toBe('Chưa xác định');
  });

  /*
   * Bam tay tren the "Tep ket qua" moi thay: ham nay luon chia cho 1 MB nen mot tep 5421 byte
   * hien la "0 MB". Nguoi dung co moi ly do de hieu rang tep cua ho rong. Test cu chi kiem ca
   * `null` nen khong bat duoc.
   */
  it('kich thuoc nho KHONG duoc hien la "0 MB"', () => {
    expect(formatBytes('vi', 5421)).not.toContain('0 MB');
    expect(formatBytes('vi', 5421)).toBe('5,3 KB');
    expect(formatBytes('vi', 900)).toBe('900 B');
    expect(formatBytes('vi', 0)).toBe('0 B');
    expect(formatBytes('vi', 5 * 1024 * 1024)).toBe('5 MB');
    expect(formatDuration('vi', 61)).toBe('1:01');
  });

  /*
   * Q-24: nhan cho tung loai su kien o trang Nhat ky. Truoc day man hinh hien nguyen chuoi tieng
   * Anh `snake_case` (vd `output_download_url_issued`) cho nguoi dung Viet.
   *
   * Danh sach loai su kien nam trong ma MAY CHU (`AUDIT_EVENTS`), khong phai trong goi i18n — nen
   * them mot loai moi ma quen nhan se lam man hinh hien chuoi tho ma khong test nao o tren bat duoc.
   * Test nay doc THANG tu ma may chu.
   */
  it('MOI loai su kien trong ma may chu deu co nhan o ca hai ngon ngu (Q-24)', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(import.meta.dirname, '../../../apps/api/src/services/audit.ts'), 'utf8');
    const block = src.slice(src.indexOf('AUDIT_EVENTS = {'), src.indexOf('} as const;', src.indexOf('AUDIT_EVENTS = {')));
    const types = [...block.matchAll(/: '([a-z_]+)'/g)].map((m) => m[1] as string);
    expect(types.length, 'khong doc duoc loai su kien nao tu ma may chu').toBeGreaterThan(10);
    const missing = types.filter(
      (t) => MESSAGES.vi[`audit_event.${t}`] === undefined || MESSAGES.en[`audit_event.${t}`] === undefined,
    );
    expect(missing, 'loai su kien khong co nhan - man hinh se hien chuoi tho').toEqual([]);
  });

  it('thieu key thi lo ra chinh key, khong tra chuoi rong', () => {
    expect(t('vi', 'khong.ton.tai')).toBe('khong.ton.tai');
  });
});
