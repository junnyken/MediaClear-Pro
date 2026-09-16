'use client';

import { ME_RESPONSE_SCHEMA } from '@mediaclear/contracts';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetchChecked, readSession, translate, writeSession } from '../_lib/api';

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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexWrap: 'wrap' }}>
      <nav
        aria-label={translate('nav.dashboard')}
        style={{
          background: 'var(--mcp-surface)',
          padding: 'var(--mcp-space-5)',
          minWidth: 220,
          flex: '0 0 auto',
          width: '100%',
          maxWidth: 260,
        }}
      >
        <strong style={{ display: 'block', marginBottom: 'var(--mcp-space-4)' }}>{translate('app.name')}</strong>

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
      </nav>
      <main style={{ flex: '1 1 320px', padding: 'var(--mcp-space-6)', minWidth: 0 }}>{children}</main>
    </div>
  );
}
