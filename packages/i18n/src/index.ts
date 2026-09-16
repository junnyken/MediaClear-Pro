/**
 * MediaClear Pro - i18n foundation (MCP-06 / muc I).
 * - Tieng Viet la locale MAC DINH.
 * - 'en' luon co du key (test parity chan lech key).
 * - Component KHONG duoc hard-code text; chi dung translation key.
 */
import vi from './locales/vi.json' with { type: 'json' };
import en from './locales/en.json' with { type: 'json' };

export const DEFAULT_LOCALE = 'vi' as const;
export const SUPPORTED_LOCALES = ['vi', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const MESSAGES: Record<Locale, Record<string, string>> = { vi, en };

/** Tra ve text theo locale; thieu key thi tra chinh key (de lo ra khi test/QA). */
export function t(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const table = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
  const raw = table[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
  if (!params) return raw;
  return Object.entries(params).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), raw);
}

/** Dinh dang locale-aware cho thoi luong, dung luong, ngay gio va so credit. */
export function formatDuration(locale: Locale, seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return t(locale, 'evidence.unknown');
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Doi don vi theo kich thuoc THAT.
 *
 * Ban dau ham nay luon chia cho 1 MB, nen MOI tep duoi ~50 KB deu hien "0 MB". Bam tay tren the
 * "Tep ket qua" moi thay: mot tep 5421 byte hien la "0 MB", va nguoi dung co moi ly do de hieu
 * rang tep cua ho rong. Khong test nao bat duoc vi test duy nhat cua ham nay kiem ca `null`.
 */
export function formatBytes(locale: Locale, bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return t(locale, 'evidence.unknown');
  const intl = locale === 'vi' ? 'vi-VN' : 'en-US';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  let value = Math.max(bytes, 0);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  // Byte khong co phan thap phan; tu KB tro len giu mot chu so cho de doc.
  const digits = unit === 0 ? 0 : 1;
  return `${new Intl.NumberFormat(intl, { maximumFractionDigits: digits }).format(value)} ${units[unit]}`;
}

export function formatDateTime(locale: Locale, iso: string): string {
  const intl = locale === 'vi' ? 'vi-VN' : 'en-US';
  return new Intl.DateTimeFormat(intl, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

export function formatUsage(locale: Locale, quantity: number, unitKey: string): string {
  const intl = locale === 'vi' ? 'vi-VN' : 'en-US';
  return `${new Intl.NumberFormat(intl).format(quantity)} ${t(locale, unitKey)}`;
}
