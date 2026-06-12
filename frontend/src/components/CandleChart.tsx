import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
} from "lightweight-charts";
import type { Kline } from "../../../shared/types/market.ts";

function fmtPrice(price: number): string {
  if (price >= 10000) return `$${(price / 1000).toFixed(1)}k`;
  if (price >= 1000) return `$${price.toFixed(0)}`;
  if (price >= 100) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

function css(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

interface Props {
  data: Kline[];
  symbol: string;
  title: string;
}

export function CandleChart({ data, symbol, title }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const lastClose = data[data.length - 1]?.close ?? 0;
  const firstClose = data[0]?.close ?? 0;
  const changePct = firstClose ? ((lastClose - firstClose) / firstClose) * 100 : 0;
  const isUp = changePct >= 0;

  useEffect(() => {
    if (!containerRef.current || !data.length) return;

    const green     = css("--color-green")      || "#00c853";
    const red       = css("--color-red")        || "#ff1744";
    const bgSurface = css("--color-bg-surface") || "#111118";
    const border    = css("--color-border")     || "#1e1e30";
    const textFaint = css("--color-text-faint") || "#555555";
    const textMuted = css("--color-text-muted") || "#666666";
    const accent    = css("--color-accent")     || "#3d6fa8";

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: bgSurface },
        textColor: textMuted,
        fontSize: 11,
        fontFamily: '"SF Mono", Consolas, monospace',
      },
      grid: {
        vertLines: { color: border, style: LineStyle.Dotted },
        horzLines: { color: border, style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: textFaint,
          labelBackgroundColor: accent,
          style: LineStyle.Dashed,
          width: 1,
        },
        horzLine: {
          color: textFaint,
          labelBackgroundColor: accent,
          style: LineStyle.Dashed,
          width: 1,
        },
      },
      rightPriceScale: {
        borderColor: border,
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: border,
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: true,
      handleScale: true,
      width: containerRef.current.clientWidth,
      height: 320,
    });

    chartRef.current = chart;

    // Candle series
    const candleSeries = chart.addCandlestickSeries({
      upColor:         green,
      downColor:       red,
      borderUpColor:   green,
      borderDownColor: red,
      wickUpColor:     green + "cc",
      wickDownColor:   red   + "cc",
    });

    candleSeries.setData(
      data.map((d) => ({
        time:  Math.floor(d.open_time / 1000) as unknown as import("lightweight-charts").Time,
        open:  d.open,
        high:  d.high,
        low:   d.low,
        close: d.close,
      }))
    );

    // Volume histogram
    const volSeries = chart.addHistogramSeries({
      color:       green + "44",
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });

    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    volSeries.setData(
      data.map((d) => ({
        time:  Math.floor(d.open_time / 1000) as unknown as import("lightweight-charts").Time,
        value: d.volume,
        color: (d.close >= d.open ? green : red) + "44",
      }))
    );

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data]);

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <span className="text-[10px] font-semibold text-text-secondary tracking-widest uppercase">
          {symbol.replace("USDT", "")} / USDT · {title}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-text-primary tabular-nums">
            {fmtPrice(lastClose)}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold tabular-nums ${
              isUp ? "bg-green/10 text-green" : "bg-red/10 text-red"
            }`}
          >
            {isUp ? "+" : ""}
            {changePct.toFixed(2)}%
          </span>
        </div>
      </div>
      <div
        ref={containerRef}
        style={{ width: "100%", height: "320px", borderRadius: "6px", overflow: "hidden" }}
      />
    </div>
  );
}
