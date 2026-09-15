/**
 * Chien luoc khoa object (MCP-15).
 *
 * Dang khoa:  workspaces/<ws>/projects/<prj>/assets/<ast>/source/<sourceFileId><ext>
 *
 * - KHONG dung ten file nguoi dung lam path (ten goc chi luu lam display name).
 * - Tien to workspace cho phep chan cheo tenant ngay tu khoa.
 * - `storageClassOf()` cua contract doc segment 'source' ngay truoc ten file.
 */
import { ERROR_CODES, apiError, type ApiError } from '@mediaclear/contracts';

/** Chi cho phep ky tu an toan; khong dau cach, khong ky tu dieu khien, khong '..'. */
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function assertSafeObjectKey(key: string): ApiError | null {
  if (key.length === 0 || key.length > 512) {
    return apiError(ERROR_CODES.MCP_STORAGE_UPLOAD_FAILED, { reason: 'key_length' });
  }
  if (key.startsWith('/') || key.endsWith('/') || key.includes('//') || key.includes('\\')) {
    return apiError(ERROR_CODES.MCP_STORAGE_UPLOAD_FAILED, { reason: 'key_shape' });
  }
  for (const segment of key.split('/')) {
    if (segment === '.' || segment === '..' || !SAFE_SEGMENT.test(segment)) {
      return apiError(ERROR_CODES.MCP_STORAGE_UPLOAD_FAILED, { reason: 'key_segment' });
    }
  }
  return null;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
};

/** Duoi file suy tu MIME da duoc ho tro, KHONG lay tu ten file nguoi dung. */
export function extensionForMime(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType] ?? '.bin';
}

export function objectKeyForSource(input: {
  workspaceId: string;
  projectId: string;
  assetId: string;
  sourceFileId: string;
  mimeType: string;
}): string {
  return [
    'workspaces',
    input.workspaceId,
    'projects',
    input.projectId,
    'assets',
    input.assetId,
    'source',
    `${input.sourceFileId}${extensionForMime(input.mimeType)}`,
  ].join('/');
}

/** Chan truy cap cheo workspace ngay o tang ung dung (khong dua vao "doan khong ra khoa"). */
export function keyBelongsToWorkspace(key: string, workspaceId: string): boolean {
  return key.startsWith(`workspaces/${workspaceId}/`) || key.startsWith(`${workspaceId}/`);
}

export interface ParsedSourceKey {
  workspaceId: string;
  projectId: string;
  assetId: string;
  sourceFileId: string;
}

/**
 * Doc nguoc khoa source ve cac id. Tra null neu khoa khong dung dang
 * => route upload khong bao gio "doan" xem byte nay thuoc ve asset nao.
 */
export function parseSourceKey(key: string): ParsedSourceKey | null {
  const parts = key.split('/');
  if (parts.length !== 8) return null;
  const [root, workspaceId, projectsLabel, projectId, assetsLabel, assetId, classLabel, filename] = parts;
  if (root !== 'workspaces' || projectsLabel !== 'projects' || assetsLabel !== 'assets' || classLabel !== 'source') {
    return null;
  }
  if (!workspaceId || !projectId || !assetId || !filename) return null;
  const dot = filename.lastIndexOf('.');
  const sourceFileId = dot > 0 ? filename.slice(0, dot) : filename;
  return { workspaceId, projectId, assetId, sourceFileId };
}
