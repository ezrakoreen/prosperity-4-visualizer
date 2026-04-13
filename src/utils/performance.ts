import { ActivityLogRow } from '../models.ts';

export type ProfitLossPoint = [timestamp: number, profitLoss: number];

export interface PerformanceMetrics {
  finalProfitLoss: number;
  maxDrawdown: number;
  sharpeRatio: number | null;
}

export function getProfitLossSeries(activityLogs: ActivityLogRow[]): ProfitLossPoint[] {
  const profitLossByTimestamp = new Map<number, number>();

  for (const row of activityLogs) {
    profitLossByTimestamp.set(row.timestamp, (profitLossByTimestamp.get(row.timestamp) ?? 0) + row.profitLoss);
  }

  return [...profitLossByTimestamp.entries()].sort((a, b) => a[0] - b[0]);
}

export function getPerformanceMetrics(activityLogs: ActivityLogRow[]): PerformanceMetrics {
  const profitLossSeries = getProfitLossSeries(activityLogs);
  const finalProfitLoss = profitLossSeries.length > 0 ? profitLossSeries[profitLossSeries.length - 1][1] : 0;

  let runningPeak = Number.NEGATIVE_INFINITY;
  let maxDrawdown = 0;

  for (const [, profitLoss] of profitLossSeries) {
    runningPeak = Math.max(runningPeak, profitLoss);
    maxDrawdown = Math.max(maxDrawdown, runningPeak - profitLoss);
  }

  const stepReturns: number[] = [];
  for (let i = 1; i < profitLossSeries.length; i++) {
    stepReturns.push(profitLossSeries[i][1] - profitLossSeries[i - 1][1]);
  }

  if (stepReturns.length === 0) {
    return {
      finalProfitLoss,
      maxDrawdown,
      sharpeRatio: null,
    };
  }

  const meanReturn = stepReturns.reduce((sum, value) => sum + value, 0) / stepReturns.length;
  const variance = stepReturns.reduce((sum, value) => sum + (value - meanReturn) ** 2, 0) / stepReturns.length;
  const standardDeviation = Math.sqrt(variance);

  return {
    finalProfitLoss,
    maxDrawdown,
    sharpeRatio: standardDeviation === 0 ? null : meanReturn / standardDeviation,
  };
}
