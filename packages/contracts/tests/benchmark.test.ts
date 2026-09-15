import { describe, expect, it } from 'vitest';
import {
  BENCHMARK_METRICS,
  BENCHMARK_SCENARIOS,
  assertNoFabricatedNumbers,
  createBenchmarkPlan,
  evaluateReadiness,
  isFabricatedCell,
} from '../src/benchmark.js';

describe('MCP-04 benchmark harness (owner decision Q-06)', () => {
  it('co du 10 kich ban va 10 metric bat buoc', () => {
    expect(BENCHMARK_SCENARIOS).toHaveLength(10);
    expect(BENCHMARK_METRICS).toHaveLength(10);
    expect(BENCHMARK_SCENARIOS.at(-1)?.targetDurationSeconds).toBe(599);
  });

  it('ma tran khoi tao: moi o deu unknown, khong co so nao', () => {
    const plan = createBenchmarkPlan();
    expect(plan.providerId).toBeNull();
    expect(plan.rows).toHaveLength(10);
    for (const row of plan.rows) {
      expect(row.cells).toHaveLength(10);
      for (const cell of row.cells) {
        expect(cell.value).toBeNull();
        expect(cell.evidence).toBe('unknown');
        expect(cell.providerRunId).toBeNull();
      }
    }
  });

  it('chua chay benchmark => khong duoc phep chon provider production', () => {
    expect(evaluateReadiness(createBenchmarkPlan('acme')).readyToSelectProvider).toBe(false);
  });

  it('phat hien so lieu bia: co gia tri nhung thieu bang chung', () => {
    expect(
      isFabricatedCell({ metric: 'failure_rate', value: 0.01, evidence: 'unknown', providerRunId: null }),
    ).toBe(true);
    expect(
      isFabricatedCell({ metric: 'failure_rate', value: 0.01, evidence: 'verified', providerRunId: null }),
    ).toBe(true);
    expect(
      isFabricatedCell({ metric: 'failure_rate', value: 0.01, evidence: 'verified', providerRunId: 'run1' }),
    ).toBe(false);
    expect(
      isFabricatedCell({ metric: 'failure_rate', value: null, evidence: 'unknown', providerRunId: null }),
    ).toBe(false);
  });

  it('assertNoFabricatedNumbers bat duoc o bia trong plan', () => {
    const plan = createBenchmarkPlan('acme');
    const firstRow = plan.rows[0]!;
    firstRow.cells[0] = { metric: 'cost_per_image', value: 0.02, evidence: 'unknown', providerRunId: null };
    expect(assertNoFabricatedNumbers(plan)?.code).toBe('MCP_PROVIDER_CAPABILITY_UNKNOWN');
    expect(assertNoFabricatedNumbers(createBenchmarkPlan())).toBeNull();
  });
});
