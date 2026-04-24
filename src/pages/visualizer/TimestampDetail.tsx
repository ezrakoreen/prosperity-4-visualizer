import { Grid, Text, Title } from '@mantine/core';
import { ReactNode } from 'react';
import { ScrollableCodeHighlight } from '../../components/ScrollableCodeHighlight.tsx';
import { AlgorithmDataRow } from '../../models.ts';
import { useStore } from '../../store.ts';
import { formatNumber } from '../../utils/format.ts';
import { ConversionObservationsTable } from './ConversionObservationsTable.tsx';
import { ListingsTable } from './ListingsTable.tsx';
import { OrderDepthTable } from './OrderDepthTable.tsx';
import { OrdersTable } from './OrdersTable.tsx';
import { PlainValueObservationsTable } from './PlainValueObservationsTable.tsx';
import { PositionTable } from './PositionTable.tsx';
import { ProfitLossTable } from './ProfitLossTable.tsx';
import { TradesTable } from './TradesTable.tsx';

function formatTraderData(value: any): string {
  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
}

export interface TimestampDetailProps {
  row: AlgorithmDataRow;
  visibleSymbols: Record<string, boolean>;
}

function isVisible(symbol: string, visibleSymbols: Record<string, boolean>): boolean {
  return visibleSymbols[symbol] !== false;
}

function filterRecord<T>(record: Record<string, T>, visibleSymbols: Record<string, boolean>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([symbol]) => isVisible(symbol, visibleSymbols)));
}

export function TimestampDetail({
  row: { state, orders, conversions, traderData, algorithmLogs, sandboxLogs },
  visibleSymbols,
}: TimestampDetailProps): ReactNode {
  const algorithm = useStore(state => state.algorithm)!;
  const orderedOrderDepthSymbols = Object.keys(state.listings)
    .filter(symbol => isVisible(symbol, visibleSymbols))
    .filter(symbol => state.orderDepths[symbol] !== undefined)
    .sort((a, b) => a.localeCompare(b));

  const profitLoss = algorithm.activityLogs
    .filter(row => row.timestamp === state.timestamp)
    .reduce((acc, val) => acc + val.profitLoss, 0);
  const visibleListings = filterRecord(state.listings, visibleSymbols);
  const visiblePositions = filterRecord(state.position, visibleSymbols);
  const visibleOwnTrades = filterRecord(state.ownTrades, visibleSymbols);
  const visibleMarketTrades = filterRecord(state.marketTrades, visibleSymbols);
  const visibleOrders = filterRecord(orders, visibleSymbols);
  const visiblePlainValueObservations = filterRecord(state.observations.plainValueObservations, visibleSymbols);
  const visibleConversionObservations = filterRecord(state.observations.conversionObservations, visibleSymbols);

  return (
    <Grid columns={12}>
      <Grid.Col span={12}>
        {/* prettier-ignore */}
        <Title order={5}>
          Timestamp {formatNumber(state.timestamp)} • Profit / Loss: {formatNumber(profitLoss)} •
          Conversions: {formatNumber(conversions)}
        </Title>
      </Grid.Col>
      <Grid.Col span={{ xs: 12, sm: 4 }}>
        <Title order={5}>Listings</Title>
        <ListingsTable listings={visibleListings} />
      </Grid.Col>
      <Grid.Col span={{ xs: 12, sm: 4 }}>
        <Title order={5}>Positions</Title>
        <PositionTable position={visiblePositions} />
      </Grid.Col>
      <Grid.Col span={{ xs: 12, sm: 4 }}>
        <Title order={5}>Profit / Loss</Title>
        <ProfitLossTable timestamp={state.timestamp} visibleSymbols={visibleSymbols} />
      </Grid.Col>
      {orderedOrderDepthSymbols.map(symbol => (
        <Grid.Col key={symbol} span={{ xs: 12, sm: 4 }}>
          <Title order={5}>{symbol} order depth</Title>
          <OrderDepthTable orderDepth={state.orderDepths[symbol]} />
        </Grid.Col>
      ))}
      {orderedOrderDepthSymbols.length % 3 <= 2 && <Grid.Col span={{ xs: 12, sm: 4 }} />}
      {orderedOrderDepthSymbols.length % 3 <= 1 && <Grid.Col span={{ xs: 12, sm: 4 }} />}
      <Grid.Col span={{ xs: 12, sm: 4 }}>
        <Title order={5}>Most Recent Own trades</Title>
        {<TradesTable trades={visibleOwnTrades} />}
      </Grid.Col>
      <Grid.Col span={{ xs: 12, sm: 4 }}>
        <Title order={5}>Most Recent Market trades</Title>
        {<TradesTable trades={visibleMarketTrades} />}
      </Grid.Col>
      <Grid.Col span={{ xs: 12, sm: 4 }}>
        <Title order={5}>Orders</Title>
        {<OrdersTable orders={visibleOrders} />}
      </Grid.Col>
      <Grid.Col span={{ xs: 12, sm: 4 }}>
        <Title order={5}>Plain value observations</Title>
        <PlainValueObservationsTable plainValueObservations={visiblePlainValueObservations} />
      </Grid.Col>
      <Grid.Col span={{ xs: 12, sm: 8 }}>
        <Title order={5}>Conversion observations</Title>
        <ConversionObservationsTable conversionObservations={visibleConversionObservations} />
      </Grid.Col>
      <Grid.Col span={{ xs: 12, sm: 6 }}>
        <Title order={5}>Sandbox logs</Title>
        {sandboxLogs ? (
          <ScrollableCodeHighlight code={sandboxLogs} language="markdown" />
        ) : (
          <Text>Timestamp has no sandbox logs</Text>
        )}
      </Grid.Col>
      <Grid.Col span={{ xs: 12, sm: 6 }}>
        <Title order={5}>Algorithm logs</Title>
        {algorithmLogs ? (
          <ScrollableCodeHighlight code={algorithmLogs} language="markdown" />
        ) : (
          <Text>Timestamp has no algorithm logs</Text>
        )}
      </Grid.Col>
      <Grid.Col span={{ xs: 12, sm: 6 }}>
        <Title order={5}>Previous trader data</Title>
        {state.traderData ? (
          <ScrollableCodeHighlight code={formatTraderData(state.traderData)} language="json" />
        ) : (
          <Text>Timestamp has no previous trader data</Text>
        )}
      </Grid.Col>
      <Grid.Col span={{ xs: 12, sm: 6 }}>
        <Title order={5}>Next trader data</Title>
        {traderData ? (
          <ScrollableCodeHighlight code={formatTraderData(traderData)} language="json" />
        ) : (
          <Text>Timestamp has no next trader data</Text>
        )}
      </Grid.Col>
    </Grid>
  );
}
