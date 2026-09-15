'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, translate, writeSession, type ApiErrorShape } from '../_lib/api';
import { Button, Card, ErrorNotice, Field, PageTitle } from '../_components/Ui';

interface SessionResponse {
  token: string;
  userId: string;
  expiresAt: string;
  productionAuthProvider: boolean;
}

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiErrorShape | null>(null);

  async function submit() {
    if (email.trim().length === 0) {
      setError({ code: 'UI_REQUIRED', messageKey: 'common.required_field' });
      return;
    }
    setBusy(true);
    const result = await apiFetch<SessionResponse>('/v1/auth/dev-session', {
      method: 'POST',
      body: { email: email.trim() },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    writeSession(result.data.token, null);
    router.push('/workspaces');
  }

  return (
    <>
      <PageTitle>{translate('screen.sign_in.title')}</PageTitle>
      <Card>
        {/* Noi thang day la ban dung thu noi bo, khong gia vo la he thong tai khoan that. */}
        <p role="note" style={{ color: 'var(--mcp-warning)' }}>{translate('screen.sign_in.dev_notice')}</p>
        <Field name="email" label={translate('screen.sign_in.email_label')} value={email} onChange={setEmail} type="email" />
        <Button onClick={submit} disabled={busy}>
          {busy ? translate('common.loading') : translate('screen.sign_in.submit')}
        </Button>
        {error ? <ErrorNotice error={error} /> : null}
      </Card>
    </>
  );
}
