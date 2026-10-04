export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function percentile(values: number[], quantile: number): number {
  if (values.length === 0) return 0;
  if (quantile < 0 || quantile > 1) {
    throw new Error("quantile must be between 0 and 1");
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(quantile * sorted.length) - 1));
  return sorted[index]!;
}
