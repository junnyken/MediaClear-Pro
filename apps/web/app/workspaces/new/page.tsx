'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, readSession, translate, writeSession, type ApiErrorShape } from '../../_lib/api';
import { Button, Card, ErrorNotice, Field, PageTitle } from '../../_components/Ui';

export default function CreateWorkspacePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiErrorShape | null>(null);

  async function submit() {
    if (name.trim().length === 0) {
      setError({ code: 'UI_REQUIRED', messageKey: 'common.required_field' });
      return;
    }
    setBusy(true);
    const result = await apiFetch<{ id: string }>('/v1/workspaces', { method: 'POST', body: { name: name.trim() } });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    writeSession(readSession().token, result.data.id);
    router.push('/');
  }

  return (
    <>
      <PageTitle>{translate('screen.workspace_create.title')}</PageTitle>
      <Card>
        <Field name="name" label={translate('screen.workspace_create.name_label')} value={name} onChange={setName} />
        <Button onClick={submit} disabled={busy}>
          {translate('common.create')}
        </Button>
        {error ? <ErrorNotice error={error} /> : null}
      </Card>
    </>
  );
}
