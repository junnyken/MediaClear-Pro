'use client';

import { PROJECT_LIST_SCHEMA } from '@mediaclear/contracts';
import Link from 'next/link';
import { apiFetchChecked, readSession, translate } from '../_lib/api';
import { useResource } from '../_lib/use-resource';
import { Card, Empty, ErrorNotice, Loading, PageTitle, LinkButton } from '../_components/Ui';


export default function ProjectListPage() {
  const workspaceId = readSession().workspaceId;
  const resource = useResource(
    () =>
      workspaceId
        ? apiFetchChecked(`/v1/workspaces/${workspaceId}/projects`, PROJECT_LIST_SCHEMA)
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
