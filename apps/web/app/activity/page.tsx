'use client';

import { apiFetch, readSession, translate } from '../_lib/api';
import { useResource } from '../_lib/use-resource';
import { Card, Empty, ErrorNotice, Loading, PageTitle } from '../_components/Ui';

interface AuditRow {
  id: string;
  eventType: string;
  subjectType: string;
  subjectId: string;
  occurredAt: string;
}

export default function ActivityPage() {
  const workspaceId = readSession().workspaceId;
  const resource = useResource(
    () =>
      workspaceId
        ? apiFetch<AuditRow[]>(`/v1/workspaces/${workspaceId}/audit-events`)
        : Promise.resolve({ ok: false as const, error: { code: 'MCP_RESOURCE_NOT_FOUND', messageKey: 'errors.mcp_resource_not_found' } }),
    [workspaceId],
  );

  return (
    <>
      <PageTitle>{translate('screen.activity.title')}</PageTitle>
      {resource.status === 'loading' ? <Loading /> : null}
      {resource.status === 'error' && resource.error ? <ErrorNotice error={resource.error} onRetry={resource.reload} /> : null}
      {resource.status === 'ready' && resource.data ? (
        <Card>
          {resource.data.length === 0 ? (
            <Empty message={translate('screen.activity.empty')} />
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {resource.data.map((event) => (
                <li key={event.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <strong>{event.eventType}</strong>
                  <span style={{ color: 'var(--mcp-text-secondary)', marginLeft: 'var(--mcp-space-3)' }}>
                    {event.subjectType} · {event.occurredAt}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </>
  );
}
