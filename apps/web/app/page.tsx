'use client';

import { ME_RESPONSE_SCHEMA, PROJECT_LIST_SCHEMA, USAGE_SUMMARY_SCHEMA } from '@mediaclear/contracts';
import Link from 'next/link';
import { apiFetchChecked, readSession, translate } from './_lib/api';
import { useResource } from './_lib/use-resource';
import { Card, DefinitionRow, EmptyState, ErrorNotice, LinkButton, Loading, PageTitle } from './_components/Ui';

export default function DashboardPage() {
  const me = useResource(() => apiFetchChecked('/v1/me', ME_RESPONSE_SCHEMA), []);
  const workspaceId = readSession().workspaceId;
  const projects = useResource(
    () =>
      workspaceId
        ? apiFetchChecked(`/v1/workspaces/${workspaceId}/projects`, PROJECT_LIST_SCHEMA)
        : Promise.resolve({ ok: true as const, data: { items: [], nextCursor: null } }),
    [workspaceId],
  );
  const usage = useResource(
    () =>
      workspaceId
        ? apiFetchChecked('/v1/usage', USAGE_SUMMARY_SCHEMA)
        : Promise.resolve({
            ok: true as const,
            data: { imageUnitsReserved: 0, videoMinuteUnitsReserved: 0, imageUnitsCommitted: 0, videoMinuteUnitsCommitted: 0 },
          }),
    [workspaceId],
  );

  if (me.status === 'loading') return <Loading />;
  if (me.status === 'error' && me.error) {
    /*
     * CHUA DANG NHAP khong phai mot LOI.
     *
     * Truoc day man hinh dau tien ma khach nhin thay la mot the do "Khong tai duoc du lieu" — noi
     * dung mot su that ky thuat nhung sai hoan toan ve y: nguoi ta vua mo trang, chua lam gi sai ca.
     * Chi giu the loi do cho loi THAT SU.
     */
    const chuaDangNhap = me.error.code === 'MCP_AUTHZ_SESSION_REQUIRED';
    return (
      <>
        <PageTitle>{translate('screen.dashboard.title')}</PageTitle>
        {chuaDangNhap ? (
          <Card title={translate('screen.dashboard.welcome_title')}>
            <p style={{ color: 'var(--mcp-text-secondary)', marginTop: 0 }}>
              {translate('screen.dashboard.welcome_body')}
            </p>
            <LinkButton href="/sign-in">{translate('screen.sign_in.submit')}</LinkButton>
          </Card>
        ) : (
          <>
            <ErrorNotice error={me.error} onRetry={me.reload} />
            <Card>
              <LinkButton href="/sign-in">{translate('screen.sign_in.submit')}</LinkButton>
            </Card>
          </>
        )}
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
            <EmptyState
              message={translate('screen.project_list.empty')}
              actionHref="/projects/new"
              actionLabel={translate('screen.project_list.create_cta')}
            />
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
