import { DEFAULT_LOCALE, t } from '@mediaclear/i18n';

/**
 * Khung man hinh Phase 0. Hien thi RO RANG rang day chua phai tinh nang that
 * (UX principle: hien trang thai that, khong bao "thanh cong" som).
 * MOI text deu di qua translation key - khong hard-code chuoi hien thi.
 */
export function ScreenPlaceholder({
  titleKey,
  contractKeys,
}: {
  titleKey: string;
  contractKeys: string[];
}) {
  return (
    <section>
      <h1 style={{ fontSize: 'var(--mcp-font-size-xl)', margin: 0 }}>{t(DEFAULT_LOCALE, titleKey)}</h1>
      <p
        role="status"
        style={{
          color: 'var(--mcp-warning)',
          background: 'var(--mcp-surface)',
          padding: 'var(--mcp-space-3)',
          borderRadius: 'var(--mcp-radius-md)',
          marginTop: 'var(--mcp-space-4)',
        }}
      >
        {t(DEFAULT_LOCALE, 'screen.placeholder_notice')}
      </p>
      <ul style={{ color: 'var(--mcp-text-secondary)', lineHeight: 1.8 }}>
        {contractKeys.map((key) => (
          <li key={key}>{t(DEFAULT_LOCALE, key)}</li>
        ))}
      </ul>
    </section>
  );
}
