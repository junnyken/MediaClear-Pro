import { describe, expect, it } from 'vitest';
import { PREVIEW_MODE, PREVIEW_PROXY_MAX_HEIGHT_PX, planPreview } from '../src/preview.js';

describe('Preview contract (owner decision Q-03 + Q-10)', () => {
  it('preview luon chay tren ban proxy va khong bao gio ghi vao file goc', () => {
    const plan = planPreview({ jobId: 'j1', sourceFileId: 'sf1', operations: ['inpaint'] });
    expect(plan.mode).toBe('proxy');
    expect(PREVIEW_MODE).toBe('proxy');
    expect(plan.writesToSourceFile).toBe(false);
    expect(PREVIEW_PROXY_MAX_HEIGHT_PX).toBeLessThanOrEqual(720);
  });

  it('preview khong tinh phi (I-12)', () => {
    expect(planPreview({ jobId: 'j1', sourceFileId: 'sf1', operations: ['crop'] }).billable).toBe(false);
    expect(planPreview({ jobId: 'j1', sourceFileId: 'sf1', operations: ['inpaint'] }).billable).toBe(false);
  });

  it('thao tac deterministic khong tao provider job nao', () => {
    expect(
      planPreview({ jobId: 'j1', sourceFileId: 'sf1', operations: ['crop', 'blur'] }).providerJobBudget,
    ).toBe(0);
  });

  it('nhieu thao tac can AI van chi duoc toi da 1 provider job', () => {
    expect(
      planPreview({
        jobId: 'j1',
        sourceFileId: 'sf1',
        operations: ['inpaint', 'tracked_inpaint', 'object_cleanup', 'crop'],
      }).providerJobBudget,
    ).toBe(1);
  });
});
