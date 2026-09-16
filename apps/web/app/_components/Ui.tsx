'use client';

/**
 * Manh UI dung chung. Moi man hinh Phase 1 deu phai co du:
 * loading / empty / error / khong du quyen - dung mot bo thanh phan nay.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { JOB_STATE_COLORS, EVIDENCE_STATUS_COLORS, PRIMITIVE_COLORS } from '@mediaclear/design-tokens';
import { errorText, translate, type ApiErrorShape } from '../_lib/api';

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--mcp-space-3)', alignItems: 'center', justifyContent: 'space-between' }}>
      <h1 style={{ fontSize: 'var(--mcp-font-size-xl)', margin: 0 }}>{children}</h1>
      {action}
    </div>
  );
}

export function Card({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <section
      style={{
        background: 'var(--mcp-surface)',
        borderRadius: 'var(--mcp-radius-md)',
        padding: 'var(--mcp-space-5)',
        marginTop: 'var(--mcp-space-4)',
      }}
    >
      {title ? <h2 style={{ fontSize: 'var(--mcp-font-size-lg)', marginTop: 0 }}>{title}</h2> : null}
      {children}
    </section>
  );
}

export function Loading() {
  return (
    <p role="status" aria-live="polite" style={{ color: 'var(--mcp-text-secondary)' }}>
      {translate('common.loading')}
    </p>
  );
}

export function Empty({ message }: { message?: string }) {
  return (
    <p style={{ color: 'var(--mcp-text-secondary)' }}>{message ?? translate('common.empty')}</p>
  );
}

/**
 * Hien thi loi: neu la loi quyen/dang nhap thi noi dung nguoi dung hieu duoc,
 * con lai dung dung cau chu theo ma loi. Khong in stack, khong in ma tho.
 */
export function ErrorNotice({ error, onRetry }: { error: ApiErrorShape; onRetry?: () => void }) {
  const friendly =
    error.code === 'MCP_AUTHZ_SESSION_REQUIRED'
      ? translate('common.sign_in_required')
      : error.code === 'MCP_AUTHZ_INSUFFICIENT_ROLE'
        ? translate('common.permission_denied')
        : errorText(error);
  return (
    <div
      role="alert"
      style={{
        background: 'var(--mcp-surface)',
        borderLeft: `4px solid ${PRIMITIVE_COLORS.danger}`,
        borderRadius: 'var(--mcp-radius-sm)',
        padding: 'var(--mcp-space-4)',
        marginTop: 'var(--mcp-space-4)',
      }}
    >
      <strong style={{ display: 'block', marginBottom: 'var(--mcp-space-2)' }}>{translate('common.error_title')}</strong>
      <span>{friendly}</span>
      {onRetry ? (
        <div style={{ marginTop: 'var(--mcp-space-3)' }}>
          <Button onClick={onRetry} variant="secondary">
            {translate('common.retry')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const background =
    variant === 'primary' ? PRIMITIVE_COLORS.primary : variant === 'danger' ? PRIMITIVE_COLORS.danger : 'transparent';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        background,
        color: variant === 'secondary' ? 'var(--mcp-text-primary)' : '#08101f',
        border: variant === 'secondary' ? `1px solid ${PRIMITIVE_COLORS.textSecondary}` : 'none',
        borderRadius: 'var(--mcp-radius-sm)',
        padding: '10px 16px',
        minHeight: 44,
        fontSize: 'var(--mcp-font-size-md)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

/**
 * Link duoc tao dang nhu nut.
 *
 * KHONG long <button> trong <Link>: long hai phan tu tuong tac la HTML khong hop le,
 * va trong thuc te co cho bam vao khong dieu huong (phat hien khi bam tay tren trinh duyet).
 */
export function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: PRIMITIVE_COLORS.primary,
        color: '#08101f',
        borderRadius: 'var(--mcp-radius-sm)',
        padding: '10px 16px',
        minHeight: 44,
        fontSize: 'var(--mcp-font-size-md)',
        textDecoration: 'none',
      }}
    >
      {children}
    </Link>
  );
}

export function Field({
  label,
  value,
  onChange,
  type = 'text',
  name,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  name: string;
}) {
  return (
    <label style={{ display: 'block', marginBottom: 'var(--mcp-space-4)' }}>
      <span style={{ display: 'block', marginBottom: 'var(--mcp-space-2)', color: 'var(--mcp-text-secondary)' }}>{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: '100%',
          /*
           * `border-box` la BAT BUOC o day: `width: 100%` CONG padding 24px va vien 2px lam o
           * nhap doi ra dung 26px so voi khung cha. Tren man hinh 390px do la chu bi cat.
           * Bam tay o khung 390x844 moi thay — `scrollWidth 304 > clientWidth 278`.
           * Loi nay o component DUNG CHUNG nen anh huong moi form cua ung dung.
           */
          boxSizing: 'border-box',
          maxWidth: 420,
          minHeight: 44,
          padding: '8px 12px',
          borderRadius: 'var(--mcp-radius-sm)',
          border: `1px solid ${PRIMITIVE_COLORS.textSecondary}`,
          background: 'var(--mcp-bg)',
          color: 'var(--mcp-text-primary)',
          fontSize: 'var(--mcp-font-size-md)',
        }}
      />
    </label>
  );
}

export function StateBadge({ state }: { state: string }) {
  const color = (JOB_STATE_COLORS as Record<string, string>)[state] ?? PRIMITIVE_COLORS.textSecondary;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 999,
        border: `1px solid ${color}`,
        color,
        fontSize: 'var(--mcp-font-size-sm)',
      }}
    >
      {translate(`job_state.${state}`)}
    </span>
  );
}

export function EvidenceBadge({ status }: { status: string }) {
  const color = (EVIDENCE_STATUS_COLORS as Record<string, string>)[status] ?? PRIMITIVE_COLORS.textSecondary;
  return (
    <span style={{ color, fontSize: 'var(--mcp-font-size-sm)' }}>{translate(`evidence.${status}`)}</span>
  );
}

/** Gia tri chua do duoc thi hien "Chua xac dinh", KHONG hien 0. */
export function ValueOrUnknown({ value, suffix }: { value: number | string | null | undefined; suffix?: string }) {
  if (value === null || value === undefined || value === '') {
    return <span style={{ color: 'var(--mcp-text-secondary)' }}>{translate('common.unknown_value')}</span>;
  }
  return (
    <span>
      {value}
      {suffix ? ` ${suffix}` : ''}
    </span>
  );
}

export function DefinitionRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--mcp-space-3)', padding: '6px 0' }}>
      <span style={{ color: 'var(--mcp-text-secondary)', minWidth: 200 }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}
