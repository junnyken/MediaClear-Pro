import type { ReactNode } from 'react';
import Link from 'next/link';
import { DEFAULT_LOCALE, t } from '@mediaclear/i18n';

/**
 * Mot san pham duy nhat: dieu huong theo WORKFLOW cua nguoi dung,
 * KHONG phoi bay 5 module noi bo nhu 5 san pham rieng (prompt muc 1 + UX principle).
 */
const NAV = [
  { href: '/', key: 'nav.dashboard' },
  { href: '/new-cleanup', key: 'nav.new_cleanup' },
  { href: '/usage', key: 'nav.usage' },
  { href: '/activity', key: 'nav.activity' },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexWrap: 'wrap' }}>
      <nav
        aria-label={t(DEFAULT_LOCALE, 'nav.dashboard')}
        style={{
          background: 'var(--mcp-surface)',
          padding: 'var(--mcp-space-5)',
          minWidth: 220,
          flex: '0 0 auto',
        }}
      >
        <strong style={{ display: 'block', marginBottom: 'var(--mcp-space-5)' }}>
          {t(DEFAULT_LOCALE, 'app.name')}
        </strong>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {NAV.map((item) => (
            <li key={item.href} style={{ marginBottom: 'var(--mcp-space-3)' }}>
              <Link href={item.href} style={{ color: 'var(--mcp-text-primary)' }}>
                {t(DEFAULT_LOCALE, item.key)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main style={{ flex: '1 1 320px', padding: 'var(--mcp-space-6)' }}>{children}</main>
    </div>
  );
}
