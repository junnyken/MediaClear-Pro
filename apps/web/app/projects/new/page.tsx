'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, readSession, translate, type ApiErrorShape } from '../../_lib/api';
import { Button, Card, ErrorNotice, Field, PageTitle } from '../../_components/Ui';

export default function CreateProjectPage() {
  const router = useRouter();
  const workspaceId = readSession().workspaceId;
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiErrorShape | null>(null);

  async function submit() {
    if (!workspaceId) {
      setError({ code: 'MCP_RESOURCE_NOT_FOUND', messageKey: 'errors.mcp_resource_not_found' });
      return;
    }
    if (name.trim().length === 0) {
      setError({ code: 'UI_REQUIRED', messageKey: 'common.required_field' });
      return;
    }
    setBusy(true);
    const result = await apiFetch<{ id: string }>(`/v1/workspaces/${workspaceId}/projects`, {
      method: 'POST',
      body: { name: name.trim() },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/projects/${result.data.id}`);
  }

  return (
    <>
      <PageTitle>{translate('screen.project_create.title')}</PageTitle>
      <Card>
        <Field name="name" label={translate('screen.project_create.name_label')} value={name} onChange={setName} />
        <Button onClick={submit} disabled={busy}>
          {translate('common.create')}
        </Button>
        {error ? <ErrorNotice error={error} /> : null}
      </Card>
    </>
  );
}
