/**
 * `apiBaseUrl()` — dia chi giao dien goi API.
 *
 * BOI CANH THAT: nguoi dung mo giao dien tu may cua ho (workspace chuyen tiep cong 3302). Trang
 * hien ra binh thuong roi bao "Khong ket noi duoc may chu", trong khi may chu dang chay va `curl`
 * tu ben trong workspace thi goi duoc.
 *
 * Nguyen nhan: giao dien nhung `__MCP_API_BASE__ = 'http://127.0.0.1:3301'` — dung o BEN TRONG
 * workspace nhung sai o TRINH DUYET cua nguoi dung, vi `127.0.0.1` khi do la may CUA HO.
 *
 * Va khi thu sua bang cach de chuoi RONG, loi thu hai lo ra: chuoi rong da mang nghia "chua dat
 * bien" nen ham roi ve `http://localhost:3001` — mot cong KHONG AI dung trong repo nay (API chay
 * o 3301). Mot gia tri mang hai y nghia la du de mot trang chet ma khong ai doc ra vi sao.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiBaseUrl } from '../app/_lib/api';

const g = globalThis as {
  __MCP_API_BASE__?: string;
  __MCP_SAME_ORIGIN__?: boolean;
  window?: unknown;
};

/*
 * `apiBaseUrl()` chi doc cac co khi DANG O TRINH DUYET (`typeof window !== 'undefined'`). Bo test
 * chay o node nen phai dung mot `window` gia — neu khong, moi phep kiem duoi day se chay nham vao
 * duong lui va deu "xanh" ma khong he cham toi logic dang duoc canh.
 */
beforeEach(() => {
  g.window = globalThis;
});

afterEach(() => {
  delete g.__MCP_API_BASE__;
  delete g.__MCP_SAME_ORIGIN__;
  delete g.window;
});

describe('apiBaseUrl', () => {
  it('co CUNG GOC bat => tra chuoi rong, tuc la goi `/v1/...` tren chinh dia chi giao dien', () => {
    g.__MCP_SAME_ORIGIN__ = true;
    g.__MCP_API_BASE__ = '';
    expect(apiBaseUrl()).toBe('');
  });

  /**
   * Phep kiem quan trong nhat: co CUNG GOC phai duoc doc TRUOC.
   *
   * Neu doc `__MCP_API_BASE__` truoc, mot cau hinh vua bat cung goc vua con sot dia chi cu se gui
   * yeu cau toi dia chi cu — dung tinh huong da lam trang bao "khong ket noi duoc".
   */
  it('co CUNG GOC duoc uu tien HON dia chi con sot lai', () => {
    g.__MCP_SAME_ORIGIN__ = true;
    g.__MCP_API_BASE__ = 'http://127.0.0.1:3301';
    expect(apiBaseUrl(), 'dia chi cu de len co cung goc').toBe('');
  });

  it('khong bat cung goc => dung dia chi da nhung', () => {
    g.__MCP_SAME_ORIGIN__ = false;
    g.__MCP_API_BASE__ = 'https://api.mediaclear.example';
    expect(apiBaseUrl()).toBe('https://api.mediaclear.example');
  });

  /**
   * Chuoi rong KHONG duoc hieu la "cung goc".
   *
   * Hai y nghia tren mot gia tri la goc cua ca chuoi loi nay. Phep kiem nay ghim su phan biet do:
   * rong = "chua dat bien" => roi ve duong lui; cung goc phai duoc noi bang mot co RIENG.
   */
  it('chuoi RONG ma KHONG co co cung goc => roi ve duong lui, khong im lang coi la cung goc', () => {
    g.__MCP_API_BASE__ = '';
    const r = apiBaseUrl();
    expect(r, 'chuoi rong bi hieu nham thanh "cung goc"').not.toBe('');
    expect(r.startsWith('http'), 'duong lui phai la mot dia chi tuyet doi').toBe(true);
  });
});
