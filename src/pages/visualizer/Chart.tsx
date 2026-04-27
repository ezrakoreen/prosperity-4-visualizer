import { Box, Button, Group } from '@mantine/core';
import Highcharts from 'highcharts/highstock';
import HighchartsAccessibility from 'highcharts/modules/accessibility';
import HighchartsExporting from 'highcharts/modules/exporting';
import HighchartsOfflineExporting from 'highcharts/modules/offline-exporting';
import HighchartsHighContrastDarkTheme from 'highcharts/themes/high-contrast-dark';
import HighchartsReact, { HighchartsReactRefObject } from 'highcharts-react-official';
import merge from 'lodash/merge';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useActualColorScheme } from '../../hooks/use-actual-color-scheme.ts';
import { formatNumber } from '../../utils/format.ts';
import { VisualizerCard } from './VisualizerCard.tsx';

HighchartsAccessibility(Highcharts);
HighchartsExporting(Highcharts);
HighchartsOfflineExporting(Highcharts);

// Highcharts themes are distributed as Highcharts extensions
// The normal way to use them is to apply these extensions to the global Highcharts object
// However, themes work by overriding the default options, with no way to rollback
// To make theme switching work, we merge theme options into the local chart options instead
// This way we don't override the global defaults and can change themes without refreshing
// This function is a little workaround to be able to get the options a theme overrides
function getThemeOptions(theme: (highcharts: typeof Highcharts) => void): Highcharts.Options {
  const highchartsMock = {
    _modules: {
      'Core/Globals.js': {
        theme: null,
      },
      'Core/Defaults.js': {
        setOptions: () => {
          // Do nothing
        },
      },
    },
    win: {
      dispatchEvent: () => {},
    },
  };

  theme(highchartsMock as any);

  return highchartsMock._modules['Core/Globals.js'].theme! as Highcharts.Options;
}

interface ChartProps {
  title: string;
  options?: Highcharts.Options;
  series: Highcharts.SeriesOptionsType[];
  min?: number;
  max?: number;
  controls?: ReactNode;
}

export function Chart({ title, options, series, min, max, controls }: ChartProps): ReactNode {
  const colorScheme = useActualColorScheme();
  const cardRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HighchartsReactRefObject>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function syncFullscreenState(): void {
      const nextIsFullscreen = document.fullscreenElement === cardRef.current;
      setIsFullscreen(nextIsFullscreen);
      requestAnimationFrame(() => {
        chartRef.current?.chart.reflow();
      });
    }

    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
    };
  }, []);

  async function toggleFullscreen(): Promise<void> {
    if (document.fullscreenElement === cardRef.current) {
      await document.exitFullscreen();
      return;
    }

    await cardRef.current?.requestFullscreen();
  }

  const fullOptions = useMemo((): Highcharts.Options => {
    const themeOptions = colorScheme === 'light' ? {} : getThemeOptions(HighchartsHighContrastDarkTheme);

    const baseOptions: Highcharts.Options = {
      chart: {
        animation: false,
        height: isFullscreen ? '57%' : 400,
        zoomType: 'x',
        pinchType: 'x',
        zooming: {
          type: 'x',
        },
        panning: {
          enabled: true,
          type: 'x',
        },
        panKey: 'shift',
        numberFormatter: formatNumber,
        events: {
          load() {
            Highcharts.addEvent(this.tooltip, 'headerFormatter', (e: any) => {
              if (e.isFooter) {
                return true;
              }

              const point = e.labelConfig?.point;
              if (!point) {
                return true;
              }

              let timestamp = point.x;

              if (point.dataGroup) {
                const xData = e.labelConfig.series.xData;
                const lastTimestamp = xData[xData.length - 1];
                if (timestamp + 100 * point.dataGroup.length >= lastTimestamp) {
                  timestamp = lastTimestamp;
                }
              }

              e.text = `Timestamp ${formatNumber(timestamp)}<br/>`;
              return false;
            });
          },
        },
      } as Highcharts.ChartOptions & { zoomType: 'x'; pinchType: 'x' },
      title: {
        text: title,
      },
      credits: {
        href: 'javascript:window.open("https://www.highcharts.com/?credits", "_blank")',
      },
      plotOptions: {
        series: {
          dataGrouping: {
            approximation(this: any, values: number[]): number {
              const endIndex = this.dataGroupInfo.start + this.dataGroupInfo.length;
              if (endIndex < this.xData.length) {
                return values[0];
              } else {
                return values[values.length - 1];
              }
            },
            anchor: 'start',
            firstAnchor: 'firstPoint',
            lastAnchor: 'lastPoint',
            units: [['second', [1, 2, 5, 10]]],
          },
        },
      },
      xAxis: {
        type: 'datetime',
        ordinal: false,
        title: {
          text: 'Timestamp',
        },
        crosshair: {
          width: 1,
        },
        labels: {
          formatter: params => formatNumber(params.value as number),
        },
      },
      yAxis: {
        opposite: false,
        allowDecimals: false,
        min,
        max,
      },
      tooltip: {
        split: false,
        shared: true,
        outside: !isFullscreen,
      },
      legend: {
        enabled: true,
      },
      exporting: {
        buttons: {
          contextButton: {
            menuItems: ['printChart', 'separator', 'downloadPNG', 'downloadJPEG', 'downloadSVG'],
          },
        },
      },
      rangeSelector: {
        enabled: false,
      },
      navigator: {
        enabled: false,
      },
      scrollbar: {
        enabled: false,
      },
      series,
    };

    return merge({}, themeOptions, baseOptions, options);
  }, [colorScheme, title, options, series, min, max, isFullscreen]);

  return (
    <Box
      ref={cardRef}
      style={
        isFullscreen
          ? {
              height: '100%',
              padding: '16px',
              boxSizing: 'border-box',
            }
          : undefined
      }
    >
      <VisualizerCard
        p={0}
        style={
          isFullscreen
            ? {
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }
            : undefined
        }
      >
        <Group justify="space-between" align="flex-end" p="md" pb={0} wrap="nowrap">
          <Box style={{ flex: 1, minWidth: 0 }}>{controls}</Box>
          <Button size="xs" variant="default" onClick={() => void toggleFullscreen()}>
            {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          </Button>
        </Group>
        <Box style={isFullscreen ? { flex: 1, minHeight: 0 } : undefined}>
          <HighchartsReact
            ref={chartRef}
            highcharts={Highcharts}
            constructorType={'stockChart'}
            options={fullOptions}
          />
        </Box>
      </VisualizerCard>
    </Box>
  );
}
