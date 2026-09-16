'use client';

import { useState } from 'react';
import { DEFAULT_LOCALE, formatDateTime } from '@mediaclear/i18n';
import { apiFetch, readSession, translate } from '../_lib/api';
import { useResource } from '../_lib/use-resource';
import { Button, Card, Empty, ErrorNotice, Loading, PageTitle } from '../_components/Ui';

interface AuditRow {
  id: string;
  eventType: string;
  subjectType: string;
  subjectId: string;
  occurredAt: string;
}

/** P2-MCP-32: route nay nay tra ve trang co con tro, khong con la mang. */
interface AuditPage {
  items: AuditRow[];
  nextCursor: string | null;
}

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
        ? apiFetch<AuditPage>(`/v1/workspaces/${workspaceId}/audit-events`)
        : Promise.resolve({ ok: false as const, error: { code: 'MCP_RESOURCE_NOT_FOUND', messageKey: 'errors.mcp_resource_not_found' } }),
    [workspaceId],
  );

  const nextCursor = cursor ?? resource.data?.nextCursor ?? null;
  const rows = [...(resource.data?.items ?? []), ...older];

  async function loadMore() {
    if (!workspaceId || !nextCursor) return;
    setLoadingMore(true);
    const result = await apiFetch<AuditPage>(
      `/v1/workspaces/${workspaceId}/audit-events?cursor=${encodeURIComponent(nextCursor)}`,
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
                    * `eventType` con hien nguyen chuoi tieng Anh snake_case (vd
                    * `output_download_url_issued`). Can ~20 nhan cau chu do owner/BA duyet - DEV
                    * khong tu che. Da ghi vao phan gioi han cua P2-MCP-33.
                    */}
                  <strong>{event.eventType}</strong>
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
