'use client';

import Link from 'next/link';
import { apiFetch, readSession, translate } from './_lib/api';
import { useResource } from './_lib/use-resource';
import { Card, DefinitionRow, ErrorNotice, LinkButton, Loading, PageTitle } from './_components/Ui';

interface MeResponse {
  user: { displayName: string; email: string };
  workspaces: Array<{ id: string; name: string; role: string }>;
}
interface UsageResponse {
  imageUnitsReserved: number;
  videoMinuteUnitsReserved: number;
  imageUnitsCommitted: number;
  videoMinuteUnitsCommitted: number;
}
interface ProjectPage {
  items: Array<{ id: string; name: string }>;
}

export default function DashboardPage() {
  const me = useResource(() => apiFetch<MeResponse>('/v1/me'), []);
  const workspaceId = readSession().workspaceId;
  const projects = useResource(
    () =>
      workspaceId
        ? apiFetch<ProjectPage>(`/v1/workspaces/${workspaceId}/projects`)
        : Promise.resolve({ ok: true as const, data: { items: [] } }),
    [workspaceId],
  );
  const usage = useResource(
    () =>
      workspaceId
        ? apiFetch<UsageResponse>('/v1/usage')
        : Promise.resolve({
            ok: true as const,
            data: { imageUnitsReserved: 0, videoMinuteUnitsReserved: 0, imageUnitsCommitted: 0, videoMinuteUnitsCommitted: 0 },
          }),
    [workspaceId],
  );

  if (me.status === 'loading') return <Loading />;
  if (me.status === 'error' && me.error) {
    return (
      <>
        <PageTitle>{translate('screen.dashboard.title')}</PageTitle>
        <ErrorNotice error={me.error} onRetry={me.reload} />
        <Card>
          <LinkButton href="/sign-in">{translate('screen.sign_in.submit')}</LinkButton>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageTitle
        action={
          <LinkButton href="/projects">{translate('screen.dashboard.start_cta')}</LinkButton>
        }
      >
        {translate('screen.dashboard.title')}
      </PageTitle>

      <Card title={translate('screen.dashboard.projects_card')}>
        {projects.status === 'loading' ? <Loading /> : null}
        {projects.status === 'error' && projects.error ? <ErrorNotice error={projects.error} onRetry={projects.reload} /> : null}
        {projects.status === 'ready' && projects.data ? (
          projects.data.items.length === 0 ? (
            <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.project_list.empty')}</p>
          ) : (
            <ul>
              {projects.data.items.slice(0, 5).map((project) => (
                <li key={project.id} style={{ marginBottom: 'var(--mcp-space-2)' }}>
                  <Link href={`/projects/${project.id}`} style={{ color: 'var(--mcp-primary)' }}>
                    {project.name}
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </Card>

      <Card title={translate('screen.dashboard.usage_card')}>
        {usage.status === 'ready' && usage.data ? (
          <>
            <DefinitionRow label={translate('screen.usage.reserved_label')}>
              {usage.data.imageUnitsReserved} {translate('usage.image_unit')} · {usage.data.videoMinuteUnitsReserved}{' '}
              {translate('usage.video_minute_unit')}
            </DefinitionRow>
            <DefinitionRow label={translate('screen.usage.committed_label')}>
              {usage.data.imageUnitsCommitted} {translate('usage.image_unit')} · {usage.data.videoMinuteUnitsCommitted}{' '}
              {translate('usage.video_minute_unit')}
            </DefinitionRow>
          </>
        ) : (
          <Loading />
        )}
        <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.job_review.usage_note')}</p>
      </Card>

      <Card>
        <p>{translate('common.original_file_safe')}</p>
        <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.job_status.no_production_engine')}</p>
      </Card>
    </>
  );
}
