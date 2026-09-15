/** MCP-15: khoa object an toan, khong lay tu ten file nguoi dung, khong traversal. */
import { describe, expect, it } from 'vitest';
import { storageClassOf, storageKeyFor } from '@mediaclear/contracts';
import { assertSafeObjectKey, extensionForMime, objectKeyForSource, parseSourceKey } from '../src/storage/object-key.js';

const KEY = objectKeyForSource({
  workspaceId: 'wsp_1',
  projectId: 'prj_2',
  assetId: 'ast_3',
  sourceFileId: 'src_4',
  mimeType: 'image/png',
});

describe('khoa object', () => {
  it('dang khoa long theo workspace/project/asset, duoi file suy tu MIME', () => {
    expect(KEY).toBe('workspaces/wsp_1/projects/prj_2/assets/ast_3/source/src_4.png');
    expect(extensionForMime('video/quicktime')).toBe('.mov');
    expect(extensionForMime('application/zip')).toBe('.bin');
  });

  it('storageClassOf doc duoc CA dang long (Phase 1) lan dang phang (Phase 0)', () => {
    expect(storageClassOf(KEY)).toBe('source');
    expect(storageClassOf(storageKeyFor('wsp_1', 'source', 'src_4', '.png'))).toBe('source');
    expect(storageClassOf(storageKeyFor('wsp_1', 'output', 'out_1', '.png'))).toBe('output');
    expect(storageClassOf('khong-phai-khoa')).toBeNull();
  });

  it('chan traversal va ky tu khong an toan', () => {
    expect(assertSafeObjectKey(KEY)).toBeNull();
    for (const bad of [
      'workspaces/../../etc/passwd',
      '/tuyet-doi/x.png',
      'a//b.png',
      'a/b/',
      'a/b\\c.png',
      'a/./b.png',
      'a/ten co dau cach.png',
      '',
    ]) {
      expect(assertSafeObjectKey(bad), `phai tu choi: ${bad}`).not.toBeNull();
    }
  });

  it('parseSourceKey chi chap nhan dung dang, khong doan bua', () => {
    expect(parseSourceKey(KEY)).toEqual({
      workspaceId: 'wsp_1',
      projectId: 'prj_2',
      assetId: 'ast_3',
      sourceFileId: 'src_4',
    });
    expect(parseSourceKey('workspaces/wsp_1/projects/prj_2/assets/ast_3/output/out.png')).toBeNull();
    expect(parseSourceKey('wsp_1/source/src_4.png')).toBeNull();
  });
});
