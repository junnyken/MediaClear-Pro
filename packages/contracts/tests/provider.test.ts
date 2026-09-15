import { describe, expect, it } from 'vitest';
import { ProviderRegistry, resolveProviderCredential } from '../src/provider.js';
import { NoopContractProvider } from '../src/providers/noop-provider.js';

describe('MCP-04 provider abstraction', () => {
  it('noop provider duoc danh dau KHONG phai production', () => {
    expect(new NoopContractProvider().isProductionProvider).toBe(false);
  });

  it('registry khong bao gio tra mock cho traffic production', () => {
    const reg = new ProviderRegistry();
    reg.register(new NoopContractProvider());
    expect(reg.get('noop-contract')).not.toBeNull();
    expect(reg.listProduction()).toEqual([]);
    expect(reg.findCapable('visible_logo_cleanup', 'image')).toEqual([]);
  });

  it('thieu evidence => cost null + evidence unknown, khong bia so', () => {
    const est = new NoopContractProvider().estimate();
    expect(est.costUsd).toBeNull();
    expect(est.costEvidence).toBe('unknown');
    expect(est.etaSeconds).toBeNull();
  });

  it('capability chua benchmark => support khac verified', () => {
    for (const cap of new NoopContractProvider().capabilities()) {
      expect(cap.support).not.toBe('verified');
    }
  });

  it('credential doc tu env, thieu thi tra null (khong hard-code key)', () => {
    expect(resolveProviderCredential({}, 'acme-vision')).toBeNull();
    expect(resolveProviderCredential({ MEDIACLEAR_PROVIDER_ACME_VISION_API_KEY: '' }, 'acme-vision')).toBeNull();
    expect(
      resolveProviderCredential({ MEDIACLEAR_PROVIDER_ACME_VISION_API_KEY: 'secret' }, 'acme-vision'),
    ).toBe('secret');
  });

  it('getResult that bai tra outputUrl null + errorCode, khong bao thanh cong rong', async () => {
    const p = new NoopContractProvider();
    const result = await p.getResult();
    expect(result.outputUrl).toBeNull();
    expect(result.errorCode).toBe('MCP_PROVIDER_NOT_PRODUCTION');
  });
});
