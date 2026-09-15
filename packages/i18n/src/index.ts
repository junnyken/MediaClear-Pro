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

export function formatBytes(locale: Locale, bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return t(locale, 'evidence.unknown');
  const mb = bytes / (1024 * 1024);
  const intl = locale === 'vi' ? 'vi-VN' : 'en-US';
  return `${new Intl.NumberFormat(intl, { maximumFractionDigits: 1 }).format(mb)} MB`;
}

export function formatDateTime(locale: Locale, iso: string): string {
  const intl = locale === 'vi' ? 'vi-VN' : 'en-US';
  return new Intl.DateTimeFormat(intl, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

export function formatUsage(locale: Locale, quantity: number, unitKey: string): string {
  const intl = locale === 'vi' ? 'vi-VN' : 'en-US';
  return `${new Intl.NumberFormat(intl).format(quantity)} ${t(locale, unitKey)}`;
}
