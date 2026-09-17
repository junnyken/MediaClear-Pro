'use client';

import { ME_RESPONSE_SCHEMA } from '@mediaclear/contracts';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PRIMITIVE_COLORS } from '@mediaclear/design-tokens';
import { apiFetchChecked, readSession, translate, writeSession } from '../_lib/api';

/**
 * Man hinh hep hay khong.
 *
 * Du an dung INLINE STYLE nen khong viet duoc media query. Doc bang `matchMedia` la cach dung dan
 * duy nhat con lai — va phai doc trong `useEffect`, khong doc luc render, vi may chu khong co
 * `window`: doc som se lech giua HTML may chu sinh ra va lan render dau o trinh duyet.
 */
function useNarrowScreen(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 720px)');
    const apply = () => setNarrow(mql.matches);
    apply();
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, []);
  return narrow;
}

/**
 * Dieu huong theo WORKFLOW cua nguoi dung, khong phoi bay module noi bo.
 * Hien ro dang o workspace nao va ai dang dang nhap.
 */
const NAV = [
  { href: '/', key: 'nav.dashboard' },
  { href: '/new-cleanup', key: 'nav.new_cleanup' },
  { href: '/projects', key: 'nav.projects' },
  { href: '/usage', key: 'nav.usage' },
  { href: '/activity', key: 'nav.activity' },
] as const;

interface MeResponse {
  user: { displayName: string };
  workspaces: Array<{ id: string; name: string; role: string }>;
}

export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // Doc lai sau MOI lan chuyen trang: vua dang nhap/vua doi workspace thi thanh ben
  // phai doi theo ngay, khong de hien "Dang nhap" trong khi da dang nhap roi.
  const pathname = usePathname();
  useEffect(() => {
    setWorkspaceId(readSession().workspaceId);
    void apiFetchChecked('/v1/me', ME_RESPONSE_SCHEMA).then((result) => {
      setMe(result.ok ? result.data : null);
    });
  }, [pathname]);

  const current = me?.workspaces.find((workspace) => workspace.id === workspaceId) ?? null;

  function signOut() {
    writeSession(null, null);
    setMe(null);
    router.push('/sign-in');
  }

  /*
   * Tren dien thoai, thanh dieu huong CU chiem tron ~350px dau MOI trang: mo bat ky man nao cung
   * phai cuon qua het danh muc moi thay noi dung. Nay no thu gon lai thanh mot hang tieu de, bam
   * moi mo. May tinh de ban giu nguyen cot ben trai — khong cho gi de thu gon.
   */
  const narrow = useNarrowScreen();
  const [menuOpen, setMenuOpen] = useState(false);
  // Chuyen trang thi dong danh muc, neu khong no che mat trang vua mo.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);
  const navVisible = !narrow || menuOpen;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexWrap: 'wrap', alignContent: 'flex-start' }}>
      <nav
        aria-label={translate('nav.dashboard')}
        style={{
          background: 'var(--mcp-surface)',
          padding: 'var(--mcp-space-5)',
          boxSizing: 'border-box',
          minWidth: narrow ? 0 : 220,
          flex: '0 0 auto',
          width: '100%',
          maxWidth: narrow ? '100%' : 260,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--mcp-space-3)' }}>
          <strong style={{ display: 'block', marginBottom: navVisible ? 'var(--mcp-space-4)' : 0 }}>
            {translate('app.name')}
          </strong>
          {narrow ? (
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mcp-nav-items"
              style={{
                background: 'transparent',
                border: `1px solid ${PRIMITIVE_COLORS.textSecondary}`,
                borderRadius: 'var(--mcp-radius-sm)',
                color: 'var(--mcp-text-primary)',
                cursor: 'pointer',
                minHeight: 44,
                minWidth: 44,
                padding: '0 var(--mcp-space-3)',
                marginBottom: navVisible ? 'var(--mcp-space-4)' : 0,
              }}
            >
              {menuOpen ? translate('nav.close_menu') : translate('nav.open_menu')}
            </button>
          ) : null}
        </div>

        <div id="mcp-nav-items" hidden={!navVisible}>

        <div style={{ marginBottom: 'var(--mcp-space-5)', color: 'var(--mcp-text-secondary)', fontSize: 'var(--mcp-font-size-sm)' }}>
          {current ? (
            <>
              <div>{current.name}</div>
              <div>{translate(`role.${current.role}`)}</div>
            </>
          ) : (
            <Link href="/workspaces" style={{ color: 'var(--mcp-primary)' }}>
              {translate('screen.workspace_select.title')}
            </Link>
          )}
        </div>

        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {NAV.map((item) => (
            <li key={item.href} style={{ marginBottom: 'var(--mcp-space-3)' }}>
              <Link href={item.href} style={{ color: 'var(--mcp-text-primary)' }}>
                {translate(item.key)}
              </Link>
            </li>
          ))}
        </ul>

        <div style={{ marginTop: 'var(--mcp-space-5)' }}>
          {me ? (
            <button
              type="button"
              onClick={signOut}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--mcp-text-secondary)',
                cursor: 'pointer',
                minHeight: 44,
                padding: 0,
              }}
            >
              {translate('nav.sign_out')}
            </button>
          ) : (
            <Link href="/sign-in" style={{ color: 'var(--mcp-primary)' }}>
              {translate('screen.sign_in.title')}
            </Link>
          )}
        </div>
        </div>
      </nav>
      <main style={{ flex: '1 1 320px', padding: 'var(--mcp-space-6)', minWidth: 0 }}>{children}</main>
    </div>
  );
}
