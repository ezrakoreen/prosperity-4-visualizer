import Highcharts from 'highcharts';
import { ReactNode } from 'react';
import { useStore } from '../../store.ts';
import { getProfitLossSeries } from '../../utils/performance.ts';
import { Chart } from './Chart.tsx';

export interface ProfitLossChartProps {
  symbols: string[];
}

export function ProfitLossChart({ symbols }: ProfitLossChartProps): ReactNode {
  const algorithm = useStore(state => state.algorithm)!;
  const totalProfitLossSeries = getProfitLossSeries(algorithm.activityLogs);

  const series: Highcharts.SeriesOptionsType[] = [
    {
      type: 'line',
      name: 'Total',
      data: totalProfitLossSeries,
    },
  ];

  symbols.forEach(symbol => {
    const data = [];

    for (const row of algorithm.activityLogs) {
      if (row.product === symbol) {
        data.push([row.timestamp, row.profitLoss]);
      }
    }

    series.push({
      type: 'line',
      name: symbol,
      data,
      dashStyle: 'Dash',
    });
  });

  return <Chart title="Profit / Loss" series={series} />;
}
