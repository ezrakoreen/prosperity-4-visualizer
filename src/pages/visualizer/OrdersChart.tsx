import { Group, SegmentedControl, TextInput } from '@mantine/core';
import Highcharts from 'highcharts';
import { memo, ReactNode, useState } from 'react';
import { ProsperitySymbol } from '../../models.ts';
import { useStore } from '../../store.ts';
import { getAskColor, getBidColor } from '../../utils/colors.ts';
import { formatNumber } from '../../utils/format.ts';
import { Chart } from './Chart.tsx';

export interface OrdersChartProps {
  symbol: ProsperitySymbol;
}

export const OrdersChart = memo(function OrdersChart({ symbol }: OrdersChartProps): ReactNode {
  const algorithm = useStore(state => state.algorithm)!;
  const [priceMode, setPriceMode] = useState<'mid' | 'bidask'>('mid');
  const [referenceMode, setReferenceMode] = useState<'original' | 'vamp' | 'midprice'>('original');
  const [quantityFilterInput, setQuantityFilterInput] = useState('');

  const trimmedQuantityFilterInput = quantityFilterInput.trim();
  const parsedQuantityFilter = Number(trimmedQuantityFilterInput);
  const quantityFilter =
    trimmedQuantityFilterInput === '' || !Number.isFinite(parsedQuantityFilter) ? null : parsedQuantityFilter;
  const quantityFilterError = trimmedQuantityFilterInput !== '' && !Number.isFinite(parsedQuantityFilter);

  function matchesQuantity(quantity: number): boolean {
    return quantityFilter === null || Math.abs(quantity) === quantityFilter;
  }

  function formatPrice(value: number): string {
    return formatNumber(value, Number.isInteger(value) ? 0 : 2);
  }

  function getVamp(row: (typeof algorithm.activityLogs)[number], previousVamp?: number): number | undefined {
    const bestBid = row.bidPrices[0];
    const bestAsk = row.askPrices[0];
    const bidVolume = Math.abs(row.bidVolumes[0] ?? 0);
    const askVolume = Math.abs(row.askVolumes[0] ?? 0);

    if (bidVolume > 0 && askVolume > 0 && bestBid !== undefined && bestAsk !== undefined) {
      return (bestBid * askVolume + bestAsk * bidVolume) / (bidVolume + askVolume);
    }

    if (askVolume === 0 && bidVolume > 0 && bestBid !== undefined) {
      return bestBid;
    }

    if (bidVolume === 0 && askVolume > 0 && bestAsk !== undefined) {
      return bestAsk;
    }

    return previousVamp;
  }

  const midPriceData: [number, number][] = [];
  const bid1Data: [number, number][] = [];
  const bid2Data: [number, number][] = [];
  const bid3Data: [number, number][] = [];
  const ask1Data: [number, number][] = [];
  const ask2Data: [number, number][] = [];
  const ask3Data: [number, number][] = [];
  const midPriceByTimestamp = new Map<number, number>();
  const vampByTimestamp = new Map<number, number>();
  let previousVamp: number | undefined;

  for (const row of algorithm.activityLogs) {
    if (row.product !== symbol) continue;

    midPriceByTimestamp.set(row.timestamp, row.midPrice);
    const vamp = getVamp(row, previousVamp);
    if (vamp !== undefined) {
      vampByTimestamp.set(row.timestamp, vamp);
      previousVamp = vamp;
    }
    midPriceData.push([row.timestamp, row.midPrice]);

    if (row.bidPrices.length >= 1) bid1Data.push([row.timestamp, row.bidPrices[0]]);
    if (row.bidPrices.length >= 2) bid2Data.push([row.timestamp, row.bidPrices[1]]);
    if (row.bidPrices.length >= 3) bid3Data.push([row.timestamp, row.bidPrices[2]]);
    if (row.askPrices.length >= 1) ask1Data.push([row.timestamp, row.askPrices[0]]);
    if (row.askPrices.length >= 2) ask2Data.push([row.timestamp, row.askPrices[1]]);
    if (row.askPrices.length >= 3) ask3Data.push([row.timestamp, row.askPrices[2]]);
  }

  function getDisplayPrice(timestamp: number, price: number): number {
    if (referenceMode === 'vamp') {
      const vamp = vampByTimestamp.get(timestamp);
      return vamp === undefined ? price : price - vamp;
    }

    if (referenceMode === 'midprice') {
      const midPrice = midPriceByTimestamp.get(timestamp);
      return midPrice === undefined ? price : price - midPrice;
    }

    return price;
  }

  function formatTooltipPrice(point: Highcharts.Point): string {
    const custom = (point as any).custom ?? {};
    const rawPrice = custom.rawPrice ?? point.y ?? 0;
    const vamp = custom.vamp;
    const midPrice = custom.midPrice;

    if (referenceMode === 'vamp' && vamp !== undefined) {
      return `${formatPrice(point.y ?? 0)} (raw: ${formatPrice(rawPrice)}, vamp: ${formatPrice(vamp)})`;
    }

    if (referenceMode === 'midprice' && midPrice !== undefined) {
      return `${formatPrice(point.y ?? 0)} (raw: ${formatPrice(rawPrice)}, mid: ${formatPrice(midPrice)})`;
    }

    return formatPrice(rawPrice);
  }

  const displayedMidPriceData = midPriceData.map(([timestamp, price]) => [
    timestamp,
    getDisplayPrice(timestamp, price),
  ]);
  const displayedBid1Data = bid1Data.map(([timestamp, price]) => [timestamp, getDisplayPrice(timestamp, price)]);
  const displayedBid2Data = bid2Data.map(([timestamp, price]) => [timestamp, getDisplayPrice(timestamp, price)]);
  const displayedBid3Data = bid3Data.map(([timestamp, price]) => [timestamp, getDisplayPrice(timestamp, price)]);
  const displayedAsk1Data = ask1Data.map(([timestamp, price]) => [timestamp, getDisplayPrice(timestamp, price)]);
  const displayedAsk2Data = ask2Data.map(([timestamp, price]) => [timestamp, getDisplayPrice(timestamp, price)]);
  const displayedAsk3Data = ask3Data.map(([timestamp, price]) => [timestamp, getDisplayPrice(timestamp, price)]);

  const filledBuyData: Highcharts.PointOptionsObject[] = [];
  const filledSellData: Highcharts.PointOptionsObject[] = [];
  const otherTradeData: Highcharts.PointOptionsObject[] = [];

  for (const trade of algorithm.tradeHistory) {
    if (trade.symbol !== symbol) continue;
    if (!matchesQuantity(trade.quantity)) continue;

    const vamp = vampByTimestamp.get(trade.timestamp);
    const midPrice = midPriceByTimestamp.get(trade.timestamp);
    const point: Highcharts.PointOptionsObject = {
      x: trade.timestamp,
      y: getDisplayPrice(trade.timestamp, trade.price),
      custom: {
        quantity: trade.quantity,
        buyer: trade.buyer,
        seller: trade.seller,
        rawPrice: trade.price,
        vamp,
        midPrice,
      },
    };

    if (trade.buyer.includes('SUBMISSION')) {
      filledBuyData.push(point);
    } else if (trade.seller.includes('SUBMISSION')) {
      filledSellData.push(point);
    } else {
      otherTradeData.push(point);
    }
  }

  const unfilledBuyData: Highcharts.PointOptionsObject[] = [];
  const unfilledSellData: Highcharts.PointOptionsObject[] = [];

  for (const row of algorithm.data) {
    const orders = row.orders[symbol];
    if (!orders) continue;

    for (const order of orders) {
      if (!matchesQuantity(order.quantity)) continue;

      const vamp = vampByTimestamp.get(row.state.timestamp);
      const midPrice = midPriceByTimestamp.get(row.state.timestamp);
      const point: Highcharts.PointOptionsObject = {
        x: row.state.timestamp,
        y: getDisplayPrice(row.state.timestamp, order.price),
        custom: { quantity: Math.abs(order.quantity), rawPrice: order.price, vamp, midPrice },
      };

      if (order.quantity > 0) {
        unfilledBuyData.push(point);
      } else if (order.quantity < 0) {
        unfilledSellData.push(point);
      }
    }
  }

  const filledBuyTooltip: Highcharts.SeriesTooltipOptionsObject = {
    pointFormatter(this: Highcharts.Point) {
      const { quantity, buyer, seller } = (this as any).custom ?? {};
      return `<span style="color:${this.color}">▲</span> Buy (filled): <b>${formatTooltipPrice(this)}</b> (qty: ${quantity}, buyer: ${buyer}, seller: ${seller})<br/>`;
    },
  };

  const filledSellTooltip: Highcharts.SeriesTooltipOptionsObject = {
    pointFormatter(this: Highcharts.Point) {
      const { quantity, buyer, seller } = (this as any).custom ?? {};
      return `<span style="color:${this.color}">▼</span> Sell (filled): <b>${formatTooltipPrice(this)}</b> (qty: ${quantity}, buyer: ${buyer}, seller: ${seller})<br/>`;
    },
  };

  const unfilledBuyTooltip: Highcharts.SeriesTooltipOptionsObject = {
    pointFormatter(this: Highcharts.Point) {
      const qty = (this as any).custom?.quantity;
      return `<span style="color:${this.color}">▲</span> Buy (order): <b>${formatTooltipPrice(this)}</b> (qty: ${qty})<br/>`;
    },
  };

  const unfilledSellTooltip: Highcharts.SeriesTooltipOptionsObject = {
    pointFormatter(this: Highcharts.Point) {
      const qty = (this as any).custom?.quantity;
      return `<span style="color:${this.color}">▼</span> Sell (order): <b>${formatTooltipPrice(this)}</b> (qty: ${qty})<br/>`;
    },
  };

  const otherTradeTooltip: Highcharts.SeriesTooltipOptionsObject = {
    pointFormatter(this: Highcharts.Point) {
      const { quantity, buyer, seller } = (this as any).custom ?? {};
      return `<span style="color:${this.color}">◆</span> Trade: <b>${formatTooltipPrice(this)}</b> (qty: ${quantity}, buyer: ${buyer}, seller: ${seller})<br/>`;
    },
  };

  const priceSeries: Highcharts.SeriesOptionsType[] =
    priceMode === 'mid'
      ? [
          {
            type: 'line',
            name: 'Mid price',
            color: 'gray',
            dashStyle: 'Dash',
            data: displayedMidPriceData,
            marker: { enabled: false },
            enableMouseTracking: false,
          },
        ]
      : [
          {
            type: 'line',
            name: 'Bid 3',
            color: getBidColor(0.5),
            data: displayedBid3Data,
            marker: { enabled: false },
            enableMouseTracking: false,
          },
          {
            type: 'line',
            name: 'Bid 2',
            color: getBidColor(0.75),
            data: displayedBid2Data,
            marker: { enabled: false },
            enableMouseTracking: false,
          },
          {
            type: 'line',
            name: 'Bid 1',
            color: getBidColor(1.0),
            data: displayedBid1Data,
            marker: { enabled: false },
            enableMouseTracking: false,
          },
          {
            type: 'line',
            name: 'Ask 1',
            color: getAskColor(1.0),
            data: displayedAsk1Data,
            marker: { enabled: false },
            enableMouseTracking: false,
          },
          {
            type: 'line',
            name: 'Ask 2',
            color: getAskColor(0.75),
            data: displayedAsk2Data,
            marker: { enabled: false },
            enableMouseTracking: false,
          },
          {
            type: 'line',
            name: 'Ask 3',
            color: getAskColor(0.5),
            data: displayedAsk3Data,
            marker: { enabled: false },
            enableMouseTracking: false,
          },
        ];

  const series: Highcharts.SeriesOptionsType[] = [
    ...priceSeries,
    {
      type: 'scatter',
      name: 'Buy (filled)',
      color: getBidColor(1.0),
      data: filledBuyData,
      marker: { symbol: 'triangle', radius: 6 },
      tooltip: filledBuyTooltip,
      dataGrouping: { enabled: false },
    },
    {
      type: 'scatter',
      name: 'Buy (order)',
      color: getBidColor(0.3),
      data: unfilledBuyData,
      marker: { symbol: 'triangle', radius: 4 },
      tooltip: unfilledBuyTooltip,
      dataGrouping: { enabled: false },
      visible: false,
    },
    {
      type: 'scatter',
      name: 'Sell (filled)',
      color: getAskColor(1.0),
      data: filledSellData,
      marker: { symbol: 'triangle-down', radius: 6 },
      tooltip: filledSellTooltip,
      dataGrouping: { enabled: false },
    },
    {
      type: 'scatter',
      name: 'Sell (order)',
      color: getAskColor(0.3),
      data: unfilledSellData,
      marker: { symbol: 'triangle-down', radius: 4 },
      tooltip: unfilledSellTooltip,
      dataGrouping: { enabled: false },
      visible: false,
    },
    {
      type: 'scatter',
      name: 'Other trades',
      color: '#a855f7',
      data: otherTradeData,
      marker: { symbol: 'diamond', radius: 6 },
      tooltip: otherTradeTooltip,
      dataGrouping: { enabled: false },
    },
  ];

  const controls = (
    <Group align="flex-end" gap="xs">
      <SegmentedControl
        size="xs"
        value={priceMode}
        onChange={value => setPriceMode(value as 'mid' | 'bidask')}
        data={[
          { label: 'Mid Price', value: 'mid' },
          { label: 'Bid/Ask', value: 'bidask' },
        ]}
      />
      <SegmentedControl
        size="xs"
        value={referenceMode}
        onChange={value => setReferenceMode(value as 'original' | 'vamp' | 'midprice')}
        data={[
          { label: 'Original', value: 'original' },
          { label: 'Relative to VAMP', value: 'vamp' },
          { label: 'Relative to Midprice', value: 'midprice' },
        ]}
      />
      <TextInput
        label="Quantity"
        value={quantityFilterInput}
        onChange={event => setQuantityFilterInput(event.currentTarget.value)}
        placeholder="e.g. 10"
        inputMode="decimal"
        error={quantityFilterError ? 'Enter a valid number' : undefined}
        size="xs"
        w={110}
      />
    </Group>
  );

  return (
    <Chart
      title={`${symbol} - Order Book`}
      series={series}
      controls={controls}
      options={{
        yAxis: {
          title: {
            text:
              referenceMode === 'vamp' ? 'Price - VAMP' : referenceMode === 'midprice' ? 'Price - Midprice' : 'Price',
          },
          allowDecimals: referenceMode !== 'original',
          plotLines:
            referenceMode !== 'original'
              ? [
                  {
                    color: 'gray',
                    dashStyle: 'Dash',
                    value: 0,
                    width: 1,
                  },
                ]
              : [],
        },
      }}
    />
  );
});
