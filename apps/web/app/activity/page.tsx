'use client';

import { AUDIT_PAGE_SCHEMA, type schema } from '@mediaclear/contracts';
import { useState } from 'react';
import { DEFAULT_LOCALE, formatDateTime } from '@mediaclear/i18n';
import { apiFetchChecked, readSession, translate } from '../_lib/api';
import { useResource } from '../_lib/use-resource';
import { Button, Card, Empty, ErrorNotice, Loading, PageTitle } from '../_components/Ui';

/*
 * Kieu SUY RA tu lich kiem, khong tu khai lai.
 *
 * Ban tu khai truoc day ghi `subjectId: string` trong khi may chu tra ve duoc `null` — mot lech
 * that ma khong ai phat hien, vi khong co gi doi chieu hai ben. Chuyen sang kieu suy ra la phep
 * kiem tu bat duoc no.
 */
type AuditPageData = schema.Infer<typeof AUDIT_PAGE_SCHEMA>;
type AuditRow = AuditPageData['items'][number];



export default function ActivityPage() {
  const workspaceId = readSession().workspaceId;
  /*
   * Gom cac trang DA doc lai, thay vi thay the: nguoi dung bam "xem them" la de thay THEM, khong
   * phai de mat phan dang doc.
   */
  const [older, setOlder] = useState<AuditRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const resource = useResource(
    () =>
      workspaceId
        ? apiFetchChecked(`/v1/workspaces/${workspaceId}/audit-events`, AUDIT_PAGE_SCHEMA)
        : Promise.resolve({ ok: false as const, error: { code: 'MCP_RESOURCE_NOT_FOUND', messageKey: 'errors.mcp_resource_not_found' } }),
    [workspaceId],
  );

  const nextCursor = cursor ?? resource.data?.nextCursor ?? null;
  const rows = [...(resource.data?.items ?? []), ...older];

  async function loadMore() {
    if (!workspaceId || !nextCursor) return;
    setLoadingMore(true);
    const result = await apiFetchChecked(
      `/v1/workspaces/${workspaceId}/audit-events?cursor=${encodeURIComponent(nextCursor)}`, AUDIT_PAGE_SCHEMA,
    );
    setLoadingMore(false);
    if (!result.ok) return;
    setOlder((current) => [...current, ...result.data.items]);
    setCursor(result.data.nextCursor);
  }

  return (
    <>
      <PageTitle>{translate('screen.activity.title')}</PageTitle>
      {resource.status === 'loading' ? <Loading /> : null}
      {resource.status === 'error' && resource.error ? <ErrorNotice error={resource.error} onRetry={resource.reload} /> : null}
      {resource.status === 'ready' && resource.data ? (
        <Card>
          {rows.length === 0 ? (
            <Empty message={translate('screen.activity.empty')} />
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {rows.map((event) => (
                <li key={event.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {/*
                    * Q-24 (D-060): nhan cho tung loai su kien. Truoc day cho nay hien nguyen chuoi
                    * tieng Anh `snake_case` cho nguoi dung Viet. Co phep chan doc THANG danh sach
                    * loai su kien tu ma may chu, nen them loai moi ma quen nhan la test do.
                    */}
                  <strong>{translate(`audit_event.${event.eventType}`)}</strong>
                  <span style={{ color: 'var(--mcp-text-secondary)', marginLeft: 'var(--mcp-space-3)' }}>
                    {event.subjectType} · {formatDateTime(DEFAULT_LOCALE, event.occurredAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {nextCursor ? (
            <Button onClick={loadMore} disabled={loadingMore}>
              {translate('screen.activity.load_more')}
            </Button>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}
