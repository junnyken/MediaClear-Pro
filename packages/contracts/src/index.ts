/** MediaClear Pro - shared contracts. Phase 0: contract-only, khong co AI engine. */
export * from './vocabulary.js';
export * from './entities.js';
export * from './errors.js';
export * from './media-limits.js';
export * from './job-state-machine.js';
export * from './policy.js';
export * from './provider.js';
export * from './providers/noop-provider.js';
export * from './provenance.js';
export * from './usage.js';
export * from './worker.js';
export * from './api.js';
export * from './invariants.js';

/** Phase 0 marker: khong co xu ly AI production trong build nay. */
export const PHASE = 'phase-0-foundation' as const;
export const PRODUCTION_AI_PROCESSING_ENABLED = false;
