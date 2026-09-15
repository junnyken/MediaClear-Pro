import { describe, expect, it } from 'vitest';
import {
  DETERMINISTIC_FALLBACK_OPERATIONS,
  ProviderRegistry,
  capabilityEvidence,
  isDeterministicFallback,
  requiresProvider,
  resolveProviderCredential,
} from '../src/provider.js';
import { NoopContractProvider } from '../src/providers/noop-provider.js';
import { CLEANUP_OPERATIONS } from '../src/vocabulary.js';

describe('MCP-04 provider abstraction (owner decision Q-06)', () => {
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

  it('chua chon provider production nao trong Phase 0', () => {
    expect(new ProviderRegistry().listProduction()).toEqual([]);
  });

  it('crop/blur/brand_overlay la deterministic fallback, khong can provider AI', () => {
    expect([...DETERMINISTIC_FALLBACK_OPERATIONS].sort()).toEqual(['blur', 'brand_overlay', 'crop']);
    for (const op of DETERMINISTIC_FALLBACK_OPERATIONS) {
      expect(isDeterministicFallback(op)).toBe(true);
      expect(requiresProvider(op)).toBe(false);
    }
    for (const op of CLEANUP_OPERATIONS) {
      if (!DETERMINISTIC_FALLBACK_OPERATIONS.includes(op)) {
        expect(requiresProvider(op)).toBe(true);
      }
    }
  });

  it('thieu evidence => cost null + evidence unknown, khong bia so', () => {
    const est = new NoopContractProvider().estimate();
    expect(est.costUsd).toBeNull();
    expect(est.costEvidence).toBe('unknown');
    expect(est.etaSeconds).toBeNull();
  });

  it('capability khong khai bao => unknown, khong mac dinh verified', () => {
    const p = new NoopContractProvider();
    expect(capabilityEvidence(p, 'tracked_inpaint', 'video')).toBe('unknown');
    expect(capabilityEvidence(p, 'visible_logo_cleanup', 'image')).toBe('unknown');
    for (const cap of p.capabilities()) {
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
    const result = await new NoopContractProvider().getResult();
    expect(result.outputUrl).toBeNull();
    expect(result.errorCode).toBe('MCP_PROVIDER_NOT_PRODUCTION');
  });
});
