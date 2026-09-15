'use client';

import Link from 'next/link';
import { apiFetch, readSession, translate } from '../_lib/api';
import { useResource } from '../_lib/use-resource';
import { Card, Empty, ErrorNotice, Loading, PageTitle, LinkButton } from '../_components/Ui';

interface ProjectRow {
  id: string;
  name: string;
  createdAt: string;
}

export default function ProjectListPage() {
  const workspaceId = readSession().workspaceId;
  const resource = useResource(
    () =>
      workspaceId
        ? apiFetch<{ items: ProjectRow[] }>(`/v1/workspaces/${workspaceId}/projects`)
        : Promise.resolve({ ok: false as const, error: { code: 'MCP_RESOURCE_NOT_FOUND', messageKey: 'errors.mcp_resource_not_found' } }),
    [workspaceId],
  );

  return (
    <>
      <PageTitle
        action={
          <LinkButton href="/projects/new">{translate('screen.project_list.create_cta')}</LinkButton>
        }
      >
        {translate('screen.project_list.title')}
      </PageTitle>

      {resource.status === 'loading' ? <Loading /> : null}
      {resource.status === 'error' && resource.error ? <ErrorNotice error={resource.error} onRetry={resource.reload} /> : null}
      {resource.status === 'ready' && resource.data ? (
        resource.data.items.length === 0 ? (
          <Card>
            <Empty message={translate('screen.project_list.empty')} />
          </Card>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {resource.data.items.map((project) => (
              <li key={project.id}>
                <Card>
                  <Link href={`/projects/${project.id}`} style={{ color: 'var(--mcp-primary)', fontSize: 'var(--mcp-font-size-lg)' }}>
                    {project.name}
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </>
  );
}
