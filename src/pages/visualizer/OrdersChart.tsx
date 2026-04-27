import { Checkbox, Group, SegmentedControl, Select, TextInput } from '@mantine/core';
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

interface OrderBookLevelPoint {
  timestamp: number;
  price: number;
  quantity: number;
}

interface TopOfBook {
  bestBid?: number;
  bestAsk?: number;
}

const ALL_TRADERS_VALUE = '__ALL_TRADERS__';
const PASSIVE_BUY_COLOR = getBidColor(1.0);
const AGGRESSIVE_BUY_COLOR = '#2563eb';
const PASSIVE_SELL_COLOR = getAskColor(1.0);
const AGGRESSIVE_SELL_COLOR = '#f97316';

export const OrdersChart = memo(function OrdersChart({ symbol }: OrdersChartProps): ReactNode {
  const algorithm = useStore(state => state.algorithm)!;
  const [priceMode, setPriceMode] = useState<'mid' | 'bidask'>('mid');
  const [referenceMode, setReferenceMode] = useState<'original' | 'vamp' | 'midprice'>('original');
  const [quantityFilterInput, setQuantityFilterInput] = useState('');
  const [traderFilter, setTraderFilter] = useState(ALL_TRADERS_VALUE);
  const [showSelectedTraderTradesAsBuysAndSells, setShowSelectedTraderTradesAsBuysAndSells] = useState(false);

  const trimmedQuantityFilterInput = quantityFilterInput.trim();
  const parsedQuantityFilter = Number(trimmedQuantityFilterInput);
  const quantityFilter =
    trimmedQuantityFilterInput === '' || !Number.isFinite(parsedQuantityFilter) ? null : parsedQuantityFilter;
  const quantityFilterError = trimmedQuantityFilterInput !== '' && !Number.isFinite(parsedQuantityFilter);

  function matchesQuantity(quantity: number): boolean {
    return quantityFilter === null || Math.abs(quantity) === quantityFilter;
  }

  function matchesTrader(buyer: string, seller: string): boolean {
    return traderFilter === ALL_TRADERS_VALUE || buyer === traderFilter || seller === traderFilter;
  }

  function isSubmissionTrader(trader: string): boolean {
    return trader.includes('SUBMISSION');
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
  const bid1Data: OrderBookLevelPoint[] = [];
  const bid2Data: OrderBookLevelPoint[] = [];
  const bid3Data: OrderBookLevelPoint[] = [];
  const ask1Data: OrderBookLevelPoint[] = [];
  const ask2Data: OrderBookLevelPoint[] = [];
  const ask3Data: OrderBookLevelPoint[] = [];
  const midPriceByTimestamp = new Map<number, number>();
  const vampByTimestamp = new Map<number, number>();
  const topOfBookByTimestamp = new Map<number, TopOfBook>();
  let previousVamp: number | undefined;

  for (const row of algorithm.activityLogs) {
    if (row.product !== symbol) continue;

    midPriceByTimestamp.set(row.timestamp, row.midPrice);
    topOfBookByTimestamp.set(row.timestamp, {
      bestBid: row.bidPrices[0],
      bestAsk: row.askPrices[0],
    });
    const vamp = getVamp(row, previousVamp);
    if (vamp !== undefined) {
      vampByTimestamp.set(row.timestamp, vamp);
      previousVamp = vamp;
    }
    midPriceData.push([row.timestamp, row.midPrice]);

    if (row.bidPrices.length >= 1) bid1Data.push({ timestamp: row.timestamp, price: row.bidPrices[0], quantity: row.bidVolumes[0] ?? 0 });
    if (row.bidPrices.length >= 2) bid2Data.push({ timestamp: row.timestamp, price: row.bidPrices[1], quantity: row.bidVolumes[1] ?? 0 });
    if (row.bidPrices.length >= 3) bid3Data.push({ timestamp: row.timestamp, price: row.bidPrices[2], quantity: row.bidVolumes[2] ?? 0 });
    if (row.askPrices.length >= 1) ask1Data.push({ timestamp: row.timestamp, price: row.askPrices[0], quantity: row.askVolumes[0] ?? 0 });
    if (row.askPrices.length >= 2) ask2Data.push({ timestamp: row.timestamp, price: row.askPrices[1], quantity: row.askVolumes[1] ?? 0 });
    if (row.askPrices.length >= 3) ask3Data.push({ timestamp: row.timestamp, price: row.askPrices[2], quantity: row.askVolumes[2] ?? 0 });
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

  function inferAggressiveness(side: 'buy' | 'sell', timestamp: number, price: number): 'passive' | 'aggressive' {
    const topOfBook = topOfBookByTimestamp.get(timestamp);

    if (side === 'buy') {
      if (topOfBook?.bestAsk !== undefined) {
        return price >= topOfBook.bestAsk ? 'aggressive' : 'passive';
      }

      if (topOfBook?.bestBid !== undefined) {
        return price > topOfBook.bestBid ? 'aggressive' : 'passive';
      }
    } else {
      if (topOfBook?.bestBid !== undefined) {
        return price <= topOfBook.bestBid ? 'aggressive' : 'passive';
      }

      if (topOfBook?.bestAsk !== undefined) {
        return price < topOfBook.bestAsk ? 'aggressive' : 'passive';
      }
    }

    return 'passive';
  }

  function getDisplayedLevelData(levelData: OrderBookLevelPoint[]): [number, number | null][] {
    return levelData.map(({ timestamp, price, quantity }) => [
      timestamp,
      matchesQuantity(quantity) ? getDisplayPrice(timestamp, price) : null,
    ]);
  }

  const displayedMidPriceData = midPriceData.map(([timestamp, price]) => [
    timestamp,
    getDisplayPrice(timestamp, price),
  ]);
  const displayedBid1Data = getDisplayedLevelData(bid1Data);
  const displayedBid2Data = getDisplayedLevelData(bid2Data);
  const displayedBid3Data = getDisplayedLevelData(bid3Data);
  const displayedAsk1Data = getDisplayedLevelData(ask1Data);
  const displayedAsk2Data = getDisplayedLevelData(ask2Data);
  const displayedAsk3Data = getDisplayedLevelData(ask3Data);

  const passiveBuyData: Highcharts.PointOptionsObject[] = [];
  const aggressiveBuyData: Highcharts.PointOptionsObject[] = [];
  const passiveSellData: Highcharts.PointOptionsObject[] = [];
  const aggressiveSellData: Highcharts.PointOptionsObject[] = [];
  const otherTradeData: Highcharts.PointOptionsObject[] = [];
  const traderNames = new Set<string>();
  const showSelectedTraderDirectionalTrades =
    showSelectedTraderTradesAsBuysAndSells && traderFilter !== ALL_TRADERS_VALUE && !isSubmissionTrader(traderFilter);

  for (const trade of algorithm.tradeHistory) {
    if (trade.symbol !== symbol) continue;
    traderNames.add(trade.buyer);
    traderNames.add(trade.seller);
    if (!matchesQuantity(trade.quantity)) continue;
    if (!matchesTrader(trade.buyer, trade.seller)) continue;

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

    if (isSubmissionTrader(trade.buyer) || (showSelectedTraderDirectionalTrades && trade.buyer === traderFilter)) {
      if (inferAggressiveness('buy', trade.timestamp, trade.price) === 'aggressive') {
        aggressiveBuyData.push(point);
      } else {
        passiveBuyData.push(point);
      }
    } else if (isSubmissionTrader(trade.seller) || (showSelectedTraderDirectionalTrades && trade.seller === traderFilter)) {
      if (inferAggressiveness('sell', trade.timestamp, trade.price) === 'aggressive') {
        aggressiveSellData.push(point);
      } else {
        passiveSellData.push(point);
      }
    } else {
      otherTradeData.push(point);
    }
  }

  const unfilledBuyData: Highcharts.PointOptionsObject[] = [];
  const unfilledSellData: Highcharts.PointOptionsObject[] = [];
  const showUnfilledOrders =
    traderFilter === ALL_TRADERS_VALUE || traderFilter.includes('SUBMISSION');

  if (showUnfilledOrders) {
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
  }

  const traderOptions = [
    { label: 'All traders', value: ALL_TRADERS_VALUE },
    ...[...traderNames]
      .sort((a, b) => a.localeCompare(b))
      .map(traderName => ({ label: traderName, value: traderName })),
  ];

  const passiveBuyTooltip: Highcharts.SeriesTooltipOptionsObject = {
    pointFormatter(this: Highcharts.Point) {
      const { quantity, buyer, seller } = (this as any).custom ?? {};
      return `<span style="color:${this.color}">▲</span> Buy (placed first): <b>${formatTooltipPrice(this)}</b> (qty: ${quantity}, buyer: ${buyer}, seller: ${seller})<br/>`;
    },
  };

  const aggressiveBuyTooltip: Highcharts.SeriesTooltipOptionsObject = {
    pointFormatter(this: Highcharts.Point) {
      const { quantity, buyer, seller } = (this as any).custom ?? {};
      return `<span style="color:${this.color}">▲</span> Buy (filled existing): <b>${formatTooltipPrice(this)}</b> (qty: ${quantity}, buyer: ${buyer}, seller: ${seller})<br/>`;
    },
  };

  const passiveSellTooltip: Highcharts.SeriesTooltipOptionsObject = {
    pointFormatter(this: Highcharts.Point) {
      const { quantity, buyer, seller } = (this as any).custom ?? {};
      return `<span style="color:${this.color}">▼</span> Sell (placed first): <b>${formatTooltipPrice(this)}</b> (qty: ${quantity}, buyer: ${buyer}, seller: ${seller})<br/>`;
    },
  };

  const aggressiveSellTooltip: Highcharts.SeriesTooltipOptionsObject = {
    pointFormatter(this: Highcharts.Point) {
      const { quantity, buyer, seller } = (this as any).custom ?? {};
      return `<span style="color:${this.color}">▼</span> Sell (filled existing): <b>${formatTooltipPrice(this)}</b> (qty: ${quantity}, buyer: ${buyer}, seller: ${seller})<br/>`;
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
            id: `${symbol}-mid-price`,
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
            id: `${symbol}-mid-price`,
            type: 'line',
            name: 'Mid price',
            color: 'gray',
            dashStyle: 'Dash',
            data: displayedMidPriceData,
            marker: { enabled: false },
            enableMouseTracking: false,
          },
          {
            id: `${symbol}-bid-3`,
            type: 'line',
            name: 'Bid 3',
            color: getBidColor(0.5),
            data: displayedBid3Data,
            marker: { enabled: false },
            enableMouseTracking: false,
          },
          {
            id: `${symbol}-bid-2`,
            type: 'line',
            name: 'Bid 2',
            color: getBidColor(0.75),
            data: displayedBid2Data,
            marker: { enabled: false },
            enableMouseTracking: false,
          },
          {
            id: `${symbol}-bid-1`,
            type: 'line',
            name: 'Bid 1',
            color: getBidColor(1.0),
            data: displayedBid1Data,
            marker: { enabled: false },
            enableMouseTracking: false,
          },
          {
            id: `${symbol}-ask-1`,
            type: 'line',
            name: 'Ask 1',
            color: getAskColor(1.0),
            data: displayedAsk1Data,
            marker: { enabled: false },
            enableMouseTracking: false,
          },
          {
            id: `${symbol}-ask-2`,
            type: 'line',
            name: 'Ask 2',
            color: getAskColor(0.75),
            data: displayedAsk2Data,
            marker: { enabled: false },
            enableMouseTracking: false,
          },
          {
            id: `${symbol}-ask-3`,
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
      id: `${symbol}-passive-buy`,
      type: 'scatter',
      name: 'Buy (placed first)',
      color: PASSIVE_BUY_COLOR,
      data: passiveBuyData,
      marker: { symbol: 'triangle', radius: 6 },
      tooltip: passiveBuyTooltip,
      dataGrouping: { enabled: false },
    },
    {
      id: `${symbol}-aggressive-buy`,
      type: 'scatter',
      name: 'Buy (filled existing)',
      color: AGGRESSIVE_BUY_COLOR,
      data: aggressiveBuyData,
      marker: { symbol: 'triangle', radius: 6 },
      tooltip: aggressiveBuyTooltip,
      dataGrouping: { enabled: false },
    },
    {
      id: `${symbol}-unfilled-buy`,
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
      id: `${symbol}-passive-sell`,
      type: 'scatter',
      name: 'Sell (placed first)',
      color: PASSIVE_SELL_COLOR,
      data: passiveSellData,
      marker: { symbol: 'triangle-down', radius: 6 },
      tooltip: passiveSellTooltip,
      dataGrouping: { enabled: false },
    },
    {
      id: `${symbol}-aggressive-sell`,
      type: 'scatter',
      name: 'Sell (filled existing)',
      color: AGGRESSIVE_SELL_COLOR,
      data: aggressiveSellData,
      marker: { symbol: 'triangle-down', radius: 6 },
      tooltip: aggressiveSellTooltip,
      dataGrouping: { enabled: false },
    },
    {
      id: `${symbol}-unfilled-sell`,
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
      id: `${symbol}-other-trades`,
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
      <Select
        label="Trader"
        value={traderFilter}
        onChange={value => setTraderFilter(value ?? ALL_TRADERS_VALUE)}
        data={traderOptions}
        comboboxProps={{ withinPortal: false }}
        size="xs"
        w={180}
        searchable
      />
      <Checkbox
        label="Show bot buys/sells"
        checked={showSelectedTraderDirectionalTrades}
        onChange={event => setShowSelectedTraderTradesAsBuysAndSells(event.currentTarget.checked)}
        disabled={traderFilter === ALL_TRADERS_VALUE || isSubmissionTrader(traderFilter)}
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
