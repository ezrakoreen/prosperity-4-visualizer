import { Select } from '@mantine/core';
import Highcharts from 'highcharts';
import { memo, ReactNode, useMemo, useState } from 'react';
import { useStore } from '../../store.ts';
import { getProfitLossSeries, getTraderProfitLossSeries } from '../../utils/performance.ts';
import { Chart } from './Chart.tsx';

export interface ProfitLossChartProps {
  symbols: string[];
}

const OFFICIAL_TOTAL_VALUE = '__OFFICIAL_TOTAL__';

export const ProfitLossChart = memo(function ProfitLossChart({ symbols }: ProfitLossChartProps): ReactNode {
  const algorithm = useStore(state => state.algorithm)!;
  const [selectedTrader, setSelectedTrader] = useState(OFFICIAL_TOTAL_VALUE);
  const totalProfitLossSeries = useMemo(() => getProfitLossSeries(algorithm.activityLogs), [algorithm.activityLogs]);
  const traderOptions = useMemo(
    () => [
      { label: 'Submission (official)', value: OFFICIAL_TOTAL_VALUE },
      ...[...new Set(algorithm.tradeHistory.flatMap(trade => [trade.buyer, trade.seller]))]
        .sort((a, b) => a.localeCompare(b))
        .map(trader => ({ label: `${trader} (approx.)`, value: trader })),
    ],
    [algorithm.tradeHistory],
  );
  const resolvedSelectedTrader = traderOptions.some(option => option.value === selectedTrader)
    ? selectedTrader
    : OFFICIAL_TOTAL_VALUE;

  const isOfficialView = resolvedSelectedTrader === OFFICIAL_TOTAL_VALUE;
  const selectedTraderLabel =
    traderOptions.find(option => option.value === resolvedSelectedTrader)?.label ?? resolvedSelectedTrader;
  const series: Highcharts.SeriesOptionsType[] = isOfficialView
    ? [
        {
          type: 'line',
          name: 'Total',
          data: totalProfitLossSeries,
        },
      ]
    : [
        {
          type: 'line',
          name: `${resolvedSelectedTrader} (approx.)`,
          data: getTraderProfitLossSeries(algorithm.activityLogs, algorithm.tradeHistory, resolvedSelectedTrader),
        },
      ];

  symbols.forEach(symbol => {
    const data = isOfficialView
      ? algorithm.activityLogs
          .filter(row => row.product === symbol)
          .map(row => [row.timestamp, row.profitLoss] as [number, number])
      : getTraderProfitLossSeries(algorithm.activityLogs, algorithm.tradeHistory, resolvedSelectedTrader, symbol);

    if (data.length > 0) {
      series.push({
        type: 'line',
        name: symbol,
        data,
        dashStyle: 'Dash',
      });
    }
  });

  return (
    <Chart
      title={isOfficialView ? 'Profit / Loss' : `Profit / Loss - ${selectedTraderLabel}`}
      series={series}
      controls={
        <Select
          label="Trader"
          value={resolvedSelectedTrader}
          onChange={value => setSelectedTrader(value ?? OFFICIAL_TOTAL_VALUE)}
          data={traderOptions}
          comboboxProps={{ withinPortal: false }}
          size="xs"
          w={220}
          searchable
        />
      }
    />
  );
});
