'use client';

import { apiFetch, translate } from '../_lib/api';
import { useResource } from '../_lib/use-resource';
import { Card, DefinitionRow, Empty, ErrorNotice, Loading, PageTitle } from '../_components/Ui';

interface UsageEntry {
  id: string;
  jobId: string;
  unitType: string;
  quantity: number;
  entryType: string;
  reasonCode: string | null;
  recordedAt: string;
}

interface UsageResponse {
  imageUnitsCommitted: number;
  videoMinuteUnitsCommitted: number;
  imageUnitsReserved: number;
  videoMinuteUnitsReserved: number;
  entries: UsageEntry[];
}

export default function UsagePage() {
  const resource = useResource(() => apiFetch<UsageResponse>('/v1/usage'), []);

  return (
    <>
      <PageTitle>{translate('screen.usage.title')}</PageTitle>
      {resource.status === 'loading' ? <Loading /> : null}
      {resource.status === 'error' && resource.error ? <ErrorNotice error={resource.error} onRetry={resource.reload} /> : null}
      {resource.status === 'ready' && resource.data ? (
        <>
          <Card>
            <DefinitionRow label={translate('screen.usage.reserved_label')}>
              {resource.data.imageUnitsReserved} {translate('usage.image_unit')} · {resource.data.videoMinuteUnitsReserved}{' '}
              {translate('usage.video_minute_unit')}
            </DefinitionRow>
            <DefinitionRow label={translate('screen.usage.committed_label')}>
              {resource.data.imageUnitsCommitted} {translate('usage.image_unit')} · {resource.data.videoMinuteUnitsCommitted}{' '}
              {translate('usage.video_minute_unit')}
            </DefinitionRow>
            <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('usage.preview_free')}</p>
            <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.job_review.usage_note')}</p>
          </Card>

          <Card title={translate('screen.usage.entries_title')}>
            {resource.data.entries.length === 0 ? (
              <Empty message={translate('screen.usage.empty')} />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--mcp-text-secondary)' }}>
                      <th scope="col">{translate('screen.job_status.usage_state')}</th>
                      <th scope="col">{translate('usage.image_unit')}</th>
                      <th scope="col">{translate('screen.usage.entries_title')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resource.data.entries.map((entry) => (
                      <tr key={entry.id} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <td>{translate(`usage.state.${entry.entryType === 'reserve' ? 'reserved' : entry.entryType === 'commit' ? 'committed' : 'released'}`)}</td>
                        <td>
                          {entry.quantity} {translate(`usage.${entry.unitType}`)}
                        </td>
                        <td style={{ color: 'var(--mcp-text-secondary)' }}>{entry.recordedAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </>
  );
}
