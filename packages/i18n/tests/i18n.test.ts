import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, MESSAGES, formatBytes, formatDuration, t } from '../src/index.js';
import { ALL_ERROR_CODES, errorI18nKey } from '../../contracts/src/errors.js';
import { EVIDENCE_STATUSES, JOB_STATES } from '../../contracts/src/vocabulary.js';

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

  it('thieu key thi lo ra chinh key, khong tra chuoi rong', () => {
    expect(t('vi', 'khong.ton.tai')).toBe('khong.ton.tai');
  });
});
