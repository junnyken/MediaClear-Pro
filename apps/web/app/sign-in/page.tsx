'use client';

/**
 * Dang nhap / dang ky (P2-MCP-25).
 *
 * Truoc day man hinh nay chi hoi email - go bat ky email nao la vao duoc. Nay co mat khau that,
 * phien luu trong database. Duong dev (`/v1/auth/dev-session`) van con nhung TAT o production.
 */
import { SESSION_RESPONSE_SCHEMA } from '@mediaclear/contracts';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetchChecked, translate, writeSession, type ApiErrorShape } from '../_lib/api';
import { Button, Card, ErrorNotice, Field, PageTitle } from '../_components/Ui';


export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'sign_in' | 'register'>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiErrorShape | null>(null);

  async function submit() {
    if (email.trim().length === 0 || password.length === 0) {
      setError({ code: 'UI_REQUIRED', messageKey: 'common.required_field' });
      return;
    }
    setError(null);
    setBusy(true);
    const result = await apiFetchChecked(
      mode === 'register' ? '/v1/auth/register' : '/v1/auth/sign-in', SESSION_RESPONSE_SCHEMA,
      { method: 'POST', body: { email: email.trim(), password } },
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Khong giu mat khau trong bo nho lau hon can thiet.
    setPassword('');
    writeSession(result.data.token, null);
    router.push('/workspaces');
  }

  const isRegister = mode === 'register';

  return (
    <>
      <PageTitle>
        {translate(isRegister ? 'screen.sign_in.register_title' : 'screen.sign_in.title')}
      </PageTitle>
      <Card>
        <Field
          name="email"
          label={translate('screen.sign_in.email_label')}
          value={email}
          onChange={setEmail}
          type="email"
        />
        <Field
          name="password"
          label={translate('screen.sign_in.password_label')}
          value={password}
          onChange={setPassword}
          type="password"
        />
        {isRegister ? (
          <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.sign_in.password_hint')}</p>
        ) : null}

        <Button onClick={submit} disabled={busy}>
          {busy
            ? translate('common.loading')
            : translate(isRegister ? 'screen.sign_in.register_submit' : 'screen.sign_in.submit')}
        </Button>

        <p style={{ marginTop: 'var(--mcp-space-4)' }}>
          <Button
            variant="secondary"
            onClick={() => {
              setMode(isRegister ? 'sign_in' : 'register');
              setError(null);
            }}
          >
            {translate(isRegister ? 'screen.sign_in.to_sign_in' : 'screen.sign_in.to_register')}
          </Button>
        </p>

        {error ? <ErrorNotice error={error} /> : null}
      </Card>
    </>
  );
}
