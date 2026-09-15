/**
 * MediaClear Pro - Benchmark harness contract (MCP-04, owner decision Q-06).
 *
 * Owner decision 2026-09-15:
 *   "Do not lock a final production AI provider in Phase 0.
 *    Prepare a benchmark harness before selecting a production provider."
 *
 * File nay la HARNESS CONTRACT, khong phai ket qua benchmark. Moi o so lieu khoi
 * tao la null + evidence 'unknown'. Co ham chan so lieu bia: mot o co gia tri so
 * ma evidence van 'unknown' bi coi la fabricated.
 *
 * Text trong file nay la mo ta NOI BO cho ky thuat, khong hien thi cho nguoi dung.
 */
import { ERROR_CODES, apiError, type ApiError } from './errors.js';
import type { EvidenceStatus, MediaType } from './vocabulary.js';

export interface BenchmarkScenario {
  id: string;
  mediaType: MediaType;
  /** Mo ta noi bo (khong phai chuoi hien thi). */
  summary: string;
  /** null = khong rang buoc thoi luong cu the. */
  targetDurationSeconds: number | null;
}

/** 10 kich ban toi thieu theo owner decision Q-06. */
export const BENCHMARK_SCENARIOS: readonly BenchmarkScenario[] = [
  { id: 'S1', mediaType: 'image', summary: 'logo o goc, nen don gian', targetDurationSeconds: null },
  { id: 'S2', mediaType: 'image', summary: 'logo tren nen phuc tap', targetDurationSeconds: null },
  { id: 'S3', mediaType: 'image', summary: 'co nguoi hoac san pham gan vung xu ly', targetDurationSeconds: null },
  { id: 'S4', mediaType: 'video', summary: 'logo co dinh', targetDurationSeconds: null },
  { id: 'S5', mediaType: 'video', summary: 'logo tren nen chuyen dong', targetDurationSeconds: null },
  { id: 'S6', mediaType: 'video', summary: 'camera lia hoac zoom', targetDurationSeconds: null },
  { id: 'S7', mediaType: 'video', summary: 'video co audio', targetDurationSeconds: null },
  { id: 'S8', mediaType: 'video', summary: 'video 10 giay', targetDurationSeconds: 10 },
  { id: 'S9', mediaType: 'video', summary: 'video 60 giay', targetDurationSeconds: 60 },
  { id: 'S10', mediaType: 'video', summary: 'video gan gioi han 09:59', targetDurationSeconds: 599 },
];

/** 10 metric bat buoc theo owner decision Q-06. */
export const BENCHMARK_METRICS = [
  'cost_per_image',
  'cost_per_video_minute',
  'processing_time_ms',
  'failure_rate',
  'retry_rate',
  'edge_quality',
  'temporal_flicker_risk',
  'audio_preservation',
  'metadata_preservation',
  'manual_correction_rate',
] as const;
export type BenchmarkMetric = (typeof BENCHMARK_METRICS)[number];

export interface BenchmarkCell {
  metric: BenchmarkMetric;
  /** null = chua do. Khong duoc dien so uoc doan. */
  value: number | null;
  evidence: EvidenceStatus;
  /** id cua ProviderRun that su sinh ra so nay; null khi chua co. */
  providerRunId: string | null;
}

export interface BenchmarkRow {
  scenarioId: string;
  cells: BenchmarkCell[];
}

export interface BenchmarkPlan {
  providerId: string | null;
  rows: BenchmarkRow[];
  /** true chi khi MOI o deu co evidence khac 'unknown'. */
  readyToSelectProvider: boolean;
}

/** Tao ma tran rong: tat ca 'unknown', khong co so nao. */
export function createBenchmarkPlan(providerId: string | null = null): BenchmarkPlan {
  const rows = BENCHMARK_SCENARIOS.map((scenario) => ({
    scenarioId: scenario.id,
    cells: BENCHMARK_METRICS.map<BenchmarkCell>((metric) => ({
      metric,
      value: null,
      evidence: 'unknown',
      providerRunId: null,
    })),
  }));
  return { providerId, rows, readyToSelectProvider: false };
}

/** Mot o bi coi la bia neu co so nhung khong co bang chung tu ProviderRun that. */
export function isFabricatedCell(cell: BenchmarkCell): boolean {
  if (cell.value === null) return false;
  return cell.evidence === 'unknown' || cell.providerRunId === null;
}

export function assertNoFabricatedNumbers(plan: BenchmarkPlan): ApiError | null {
  for (const row of plan.rows) {
    for (const cell of row.cells) {
      if (isFabricatedCell(cell)) {
        return apiError(ERROR_CODES.MCP_PROVIDER_CAPABILITY_UNKNOWN, {
          scenarioId: row.scenarioId,
          metric: cell.metric,
        });
      }
    }
  }
  return null;
}

/** Chi duoc chon provider production khi khong con o nao 'unknown'. */
export function evaluateReadiness(plan: BenchmarkPlan): BenchmarkPlan {
  const complete = plan.rows.every((row) => row.cells.every((cell) => cell.evidence !== 'unknown'));
  return { ...plan, readyToSelectProvider: complete && assertNoFabricatedNumbers(plan) === null };
}
