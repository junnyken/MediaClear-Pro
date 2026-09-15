/** Tien ich dung chung cho test Phase 1: dung server that, upload byte that. */
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppContext, type AppContext } from '../src/app-context.js';
import { buildServer } from '../src/server.js';

export const FIXTURES = join(import.meta.dirname, 'fixtures/media');

export type TestApp = ReturnType<typeof buildServer>;

export async function makeApp(overrides: { now?: () => Date } = {}): Promise<{ app: TestApp; ctx: AppContext }> {
  const dataDir = await mkdtemp(join(tmpdir(), 'mediaclear-test-'));
  const ctx = createAppContext({
    config: {
      dataDir,
      uploadSecret: 'test-signing-secret-not-a-real-credential',
      uploadSecretProvided: true,
      devAuthEnabled: true,
      publicBaseUrl: 'http://api.test',
    },
    ...(overrides.now ? { now: overrides.now } : {}),
  });
  return { app: buildServer({ context: ctx }), ctx };
}

export async function signIn(app: TestApp, email: string): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/v1/auth/dev-session', payload: { email } });
  const body = res.json();
  if (!body.ok) throw new Error(`dev-session that bai: ${JSON.stringify(body)}`);
  return body.data.token as string;
}

export function auth(token: string, workspaceId?: string): Record<string, string> {
  return workspaceId
    ? { authorization: `Bearer ${token}`, 'x-workspace-id': workspaceId }
    : { authorization: `Bearer ${token}` };
}

export async function createWorkspace(app: TestApp, token: string, name: string): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/v1/workspaces', headers: auth(token), payload: { name } });
  const body = res.json();
  if (!body.ok) throw new Error(`tao workspace that bai: ${JSON.stringify(body)}`);
  return body.data.id as string;
}

export async function createProject(app: TestApp, token: string, workspaceId: string, name: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: `/v1/workspaces/${workspaceId}/projects`,
    headers: auth(token, workspaceId),
    payload: { name },
  });
  const body = res.json();
  if (!body.ok) throw new Error(`tao project that bai: ${JSON.stringify(body)}`);
  return body.data.id as string;
}

export interface UploadedAsset {
  assetId: string;
  sourceFileId: string;
  uploadStatus: number;
  uploadBody: Record<string, unknown>;
}

/** Upload mot fixture THAT: xin intent -> PUT byte that -> tra ket qua. */
export async function uploadFixture(
  app: TestApp,
  token: string,
  workspaceId: string,
  projectId: string,
  fixture: string,
  declared: { mimeType: string; mediaType: 'image' | 'video'; filename?: string },
): Promise<UploadedAsset> {
  const bytes = await readFile(join(FIXTURES, fixture));
  const intentRes = await app.inject({
    method: 'POST',
    url: `/v1/projects/${projectId}/assets/upload-intent`,
    headers: auth(token, workspaceId),
    payload: {
      originalFilename: declared.filename ?? fixture,
      mimeType: declared.mimeType,
      mediaType: declared.mediaType,
      byteSize: bytes.byteLength,
    },
  });
  const intent = intentRes.json();
  if (!intent.ok) throw new Error(`upload-intent that bai: ${JSON.stringify(intent)}`);

  const uploadPath = new URL(intent.data.uploadUrl as string).pathname;
  const uploadRes = await app.inject({
    method: 'PUT',
    url: uploadPath,
    headers: { 'content-type': declared.mimeType },
    payload: bytes,
  });
  return {
    assetId: intent.data.assetId as string,
    sourceFileId: intent.data.sourceFileId as string,
    uploadStatus: uploadRes.statusCode,
    uploadBody: uploadRes.json(),
  };
}

export async function validateAsset(app: TestApp, token: string, workspaceId: string, assetId: string) {
  const res = await app.inject({
    method: 'POST',
    url: `/v1/assets/${assetId}/validate`,
    headers: auth(token, workspaceId),
  });
  return { status: res.statusCode, body: res.json() };
}

export async function attest(app: TestApp, token: string, workspaceId: string, assetId: string) {
  const res = await app.inject({
    method: 'POST',
    url: `/v1/assets/${assetId}/rights-attestation`,
    headers: auth(token, workspaceId),
    payload: { statementId: 'rights_attestation', statementVersion: 1, localeShown: 'vi', accepted: true },
  });
  return { status: res.statusCode, body: res.json() };
}

export async function createJob(
  app: TestApp,
  token: string,
  workspaceId: string,
  assetId: string,
  options: { operations?: string[]; idempotencyKey?: string } = {},
) {
  const res = await app.inject({
    method: 'POST',
    url: `/v1/assets/${assetId}/jobs`,
    headers: auth(token, workspaceId),
    payload: {
      operations: options.operations ?? ['visible_logo_cleanup'],
      regions: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.2, startSeconds: null, endSeconds: null }],
      presetId: null,
      idempotencyKey: options.idempotencyKey ?? `idem-${Math.random().toString(36).slice(2)}`,
    },
  });
  return { status: res.statusCode, body: res.json() };
}
