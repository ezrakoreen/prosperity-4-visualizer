import { ActivityLogRow, ResultLogTradeHistoryItem } from '../models.ts';

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

export function getTraderProfitLossSeries(
  activityLogs: ActivityLogRow[],
  tradeHistory: ResultLogTradeHistoryItem[],
  trader: string,
  symbolFilter?: string,
): ProfitLossPoint[] {
  const tradesByTimestamp = new Map<number, ResultLogTradeHistoryItem[]>();
  const rowsByTimestamp = new Map<number, ActivityLogRow[]>();
  const timestamps = new Set<number>();

  for (const row of activityLogs) {
    if (symbolFilter !== undefined && row.product !== symbolFilter) continue;

    const rows = rowsByTimestamp.get(row.timestamp);
    if (rows === undefined) {
      rowsByTimestamp.set(row.timestamp, [row]);
    } else {
      rows.push(row);
    }
    timestamps.add(row.timestamp);
  }

  for (const trade of tradeHistory) {
    if (symbolFilter !== undefined && trade.symbol !== symbolFilter) continue;
    if (trade.buyer !== trader && trade.seller !== trader) continue;

    const trades = tradesByTimestamp.get(trade.timestamp);
    if (trades === undefined) {
      tradesByTimestamp.set(trade.timestamp, [trade]);
    } else {
      trades.push(trade);
    }
    timestamps.add(trade.timestamp);
  }

  const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
  const lastMidPriceBySymbol = new Map<string, number>();
  const positionBySymbol = new Map<string, number>();
  let cash = 0;

  return sortedTimestamps.map(timestamp => {
    for (const row of rowsByTimestamp.get(timestamp) ?? []) {
      lastMidPriceBySymbol.set(row.product, row.midPrice);
    }

    for (const trade of tradesByTimestamp.get(timestamp) ?? []) {
      if (trade.buyer === trader) {
        positionBySymbol.set(trade.symbol, (positionBySymbol.get(trade.symbol) ?? 0) + trade.quantity);
        cash -= trade.price * trade.quantity;
      }

      if (trade.seller === trader) {
        positionBySymbol.set(trade.symbol, (positionBySymbol.get(trade.symbol) ?? 0) - trade.quantity);
        cash += trade.price * trade.quantity;
      }
    }

    let profitLoss = cash;
    for (const [symbol, position] of positionBySymbol.entries()) {
      const midPrice = lastMidPriceBySymbol.get(symbol);
      if (midPrice !== undefined) {
        profitLoss += position * midPrice;
      }
    }

    return [timestamp, profitLoss];
  });
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
