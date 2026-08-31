export const MAX_TEST_DATES = 5
export const MAX_RUNS_PER_DATE = 3

export function parseTestLimits(searchParams: URLSearchParams): { count: number; runs: number } {
  const count = Number.parseInt(searchParams.get('count') || '3', 10)
  const runs = Number.parseInt(searchParams.get('runs') || '2', 10)
  return {
    count: Math.min(MAX_TEST_DATES, Math.max(1, Number.isFinite(count) ? count : 3)),
    runs: Math.min(MAX_RUNS_PER_DATE, Math.max(1, Number.isFinite(runs) ? runs : 2)),
  }
}
