import { Center, Checkbox, Container, Grid, Group, Stack, Text, Title } from '@mantine/core';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store.ts';
import { formatNumber } from '../../utils/format.ts';
import { getPerformanceMetrics } from '../../utils/performance.ts';
import { AlgorithmSummaryCard } from './AlgorithmSummaryCard.tsx';
import { CandlestickChart } from './CandlestickChart.tsx';
import { ConversionPriceChart } from './ConversionPriceChart.tsx';
import { EnvironmentChart } from './EnvironmentChart.tsx';
import { LoadedLogsCard } from './LoadedLogsCard.tsx';
import { OrdersChart } from './OrdersChart.tsx';
import { PlainValueObservationChart } from './PlainValueObservationChart.tsx';
import { PositionChart } from './PositionChart.tsx';
import { ProfitLossChart } from './ProfitLossChart.tsx';
import { TimestampsCard } from './TimestampsCard.tsx';
import { TransportChart } from './TransportChart.tsx';
import { VisualizerCard } from './VisualizerCard.tsx';

export function VisualizerPage(): ReactNode {
  const algorithm = useStore(state => state.algorithm);
  const [singleColumnLayout, setSingleColumnLayout] = useState(false);
  const [showProfitLoss, setShowProfitLoss] = useState(true);
  const [showPositions, setShowPositions] = useState(true);
  const [visibleSymbols, setVisibleSymbols] = useState<Record<string, boolean>>({});

  const { search } = useLocation();

  const { sortedSymbols, sortedPlainValueObservationSymbols, productSymbols } = useMemo(() => {
    const symbols = new Set<string>();
    const plainValueObservationSymbols = new Set<string>();

    if (algorithm !== null) {
      for (let i = 0; i < algorithm.data.length; i += 1000) {
        const row = algorithm.data[i];

        for (const key of Object.keys(row.state.listings)) {
          symbols.add(key);
        }

        for (const key of Object.keys(row.state.observations.plainValueObservations)) {
          plainValueObservationSymbols.add(key);
        }
      }
    }

    const sortedSymbols = [...symbols].sort((a, b) => a.localeCompare(b));
    const sortedPlainValueObservationSymbols = [...plainValueObservationSymbols].sort((a, b) => a.localeCompare(b));
    const productSymbols = [...new Set([...sortedSymbols, ...sortedPlainValueObservationSymbols])].sort((a, b) =>
      a.localeCompare(b),
    );

    return { sortedSymbols, sortedPlainValueObservationSymbols, productSymbols };
  }, [algorithm]);

  useEffect(() => {
    setVisibleSymbols(current => {
      let changed = false;
      const next: Record<string, boolean> = {};

      for (const symbol of productSymbols) {
        if (symbol in current) {
          next[symbol] = current[symbol];
        } else {
          next[symbol] = true;
          changed = true;
        }
      }

      if (!changed && Object.keys(current).length === Object.keys(next).length) {
        return current;
      }

      return next;
    });
  }, [productSymbols]);

  const conversionProducts = useMemo(() => {
    const conversionProducts = new Set<string>();

    if (algorithm === null) {
      return conversionProducts;
    }

    for (const row of algorithm.data) {
      for (const product of Object.keys(row.state.observations.conversionObservations)) {
        conversionProducts.add(product);
      }
    }
    return conversionProducts;
  }, [algorithm]);

  const performanceMetrics = useMemo(
    () => (algorithm === null ? null : getPerformanceMetrics(algorithm.activityLogs)),
    [algorithm],
  );

  if (algorithm === null || performanceMetrics === null) {
    return <Navigate to={`/${search}`} />;
  }

  const displaySpan = { xs: 12, sm: singleColumnLayout ? 12 : 6 } as const;

  const symbolColumns: ReactNode[] = [];
  sortedSymbols.forEach(symbol => {
    if (visibleSymbols[symbol] === false) {
      return;
    }

    symbolColumns.push(
      <Grid.Col key={`${symbol} - candlestick`} span={displaySpan}>
        <CandlestickChart symbol={symbol} />
      </Grid.Col>,
    );

    symbolColumns.push(
      <Grid.Col key={`${symbol} - orders`} span={displaySpan}>
        <OrdersChart symbol={symbol} />
      </Grid.Col>,
    );

    if (!conversionProducts.has(symbol)) {
      return;
    }

    symbolColumns.push(
      <Grid.Col key={`${symbol} - conversion price`} span={displaySpan}>
        <ConversionPriceChart symbol={symbol} />
      </Grid.Col>,
    );

    symbolColumns.push(
      <Grid.Col key={`${symbol} - transport`} span={displaySpan}>
        <TransportChart symbol={symbol} />
      </Grid.Col>,
    );

    symbolColumns.push(
      <Grid.Col key={`${symbol} - environment`} span={displaySpan}>
        <EnvironmentChart symbol={symbol} />
      </Grid.Col>,
    );

    if (!singleColumnLayout) {
      symbolColumns.push(<Grid.Col key={`${symbol} - environment spacer`} span={displaySpan} />);
    }
  });

  sortedPlainValueObservationSymbols.forEach(symbol => {
    if (visibleSymbols[symbol] === false) {
      return;
    }

    symbolColumns.push(
      <Grid.Col key={`${symbol} - plain value observation`} span={displaySpan}>
        <PlainValueObservationChart symbol={symbol} />
      </Grid.Col>,
    );
  });

  return (
    <Container fluid>
      <Grid>
        <Grid.Col span={12}>
          <VisualizerCard>
            <Stack gap="sm">
              <Text fw={700}>Display Controls</Text>
              <Group gap="md">
                <Checkbox
                  label="Show one display per row"
                  checked={singleColumnLayout}
                  onChange={event => setSingleColumnLayout(event.currentTarget.checked)}
                />
                <Checkbox
                  label="Profit / Loss"
                  checked={showProfitLoss}
                  onChange={event => setShowProfitLoss(event.currentTarget.checked)}
                />
                <Checkbox
                  label="Positions"
                  checked={showPositions}
                  onChange={event => setShowPositions(event.currentTarget.checked)}
                />
              </Group>
              <Group gap="md">
                {productSymbols.map(symbol => (
                  <Checkbox
                    key={symbol}
                    label={symbol}
                    checked={visibleSymbols[symbol] !== false}
                    onChange={event => {
                      const checked = event.currentTarget.checked;
                      setVisibleSymbols(current => ({
                        ...current,
                        [symbol]: checked,
                      }));
                    }}
                  />
                ))}
              </Group>
            </Stack>
          </VisualizerCard>
        </Grid.Col>
        <Grid.Col span={12}>
          <LoadedLogsCard />
        </Grid.Col>
        <Grid.Col span={12}>
          <VisualizerCard>
            <Grid>
              <Grid.Col span={{ xs: 12, sm: 4 }}>
                <Center>
                  <Stack gap={4} align="center">
                    <Text c="dimmed" size="sm" tt="uppercase" fw={700}>
                      Final Profit / Loss
                    </Text>
                    <Title order={2}>{formatNumber(performanceMetrics.finalProfitLoss)}</Title>
                  </Stack>
                </Center>
              </Grid.Col>
              <Grid.Col span={{ xs: 12, sm: 4 }}>
                <Center>
                  <Stack gap={4} align="center">
                    <Text c="dimmed" size="sm" tt="uppercase" fw={700}>
                      Sharpe Ratio
                    </Text>
                    <Title order={2}>
                      {performanceMetrics.sharpeRatio === null
                        ? 'N/A'
                        : formatNumber(performanceMetrics.sharpeRatio, 4)}
                    </Title>
                  </Stack>
                </Center>
              </Grid.Col>
              <Grid.Col span={{ xs: 12, sm: 4 }}>
                <Center>
                  <Stack gap={4} align="center">
                    <Text c="dimmed" size="sm" tt="uppercase" fw={700}>
                      Max Drawdown
                    </Text>
                    <Title order={2}>{formatNumber(performanceMetrics.maxDrawdown)}</Title>
                  </Stack>
                </Center>
              </Grid.Col>
            </Grid>
          </VisualizerCard>
        </Grid.Col>
        {showProfitLoss && (
          <Grid.Col span={displaySpan}>
            <ProfitLossChart symbols={sortedSymbols} />
          </Grid.Col>
        )}
        {showPositions && (
          <Grid.Col span={displaySpan}>
            <PositionChart symbols={sortedSymbols} />
          </Grid.Col>
        )}
        {symbolColumns}
        <Grid.Col span={12}>
          <TimestampsCard visibleSymbols={visibleSymbols} />
        </Grid.Col>
        {algorithm.summary && (
          <Grid.Col span={12}>
            <AlgorithmSummaryCard />
          </Grid.Col>
        )}
      </Grid>
    </Container>
  );
}
