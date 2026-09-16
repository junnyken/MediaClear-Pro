'use client';

import { WORKSPACE_LIST_SCHEMA } from '@mediaclear/contracts';
import { useRouter } from 'next/navigation';
import { apiFetchChecked, readSession, translate, writeSession } from '../_lib/api';
import { useResource } from '../_lib/use-resource';
import { Button, Card, Empty, ErrorNotice, Loading, PageTitle, LinkButton } from '../_components/Ui';


export default function WorkspacesPage() {
  const router = useRouter();
  const resource = useResource(() => apiFetchChecked('/v1/workspaces', WORKSPACE_LIST_SCHEMA), []);

  function choose(id: string) {
    writeSession(readSession().token, id);
    router.push('/');
  }

  return (
    <>
      <PageTitle
        action={
          <LinkButton href="/workspaces/new">{translate('screen.workspace_select.create_cta')}</LinkButton>
        }
      >
        {translate('screen.workspace_select.title')}
      </PageTitle>

      {resource.status === 'loading' ? <Loading /> : null}
      {resource.status === 'error' && resource.error ? <ErrorNotice error={resource.error} onRetry={resource.reload} /> : null}
      {resource.status === 'ready' && resource.data ? (
        resource.data.items.length === 0 ? (
          <Card>
            <Empty message={translate('screen.workspace_select.empty')} />
          </Card>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {resource.data.items.map((workspace) => (
              <li key={workspace.id}>
                <Card>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--mcp-space-3)', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{workspace.name}</strong>
                      <div style={{ color: 'var(--mcp-text-secondary)' }}>{translate(`role.${workspace.role}`)}</div>
                    </div>
                    <Button onClick={() => choose(workspace.id)}>{translate('common.continue')}</Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </>
  );
}
