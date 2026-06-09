import { useEffect, useRef, useCallback } from "react";
import type { Kline } from "../../../shared/types/market.ts";

interface Dims {
  w: number;
  h: number;
  padding: { top: number; bottom: number; left: number; right: number };
  chartW: number;
  chartH: number;
}

interface PriceRange {
  maxPrice: number;
  minPrice: number;
  priceRange: number;
}

function normalizeRange(data: Kline[]): PriceRange {
  const maxPrice = Math.max(...data.map((d) => d.high));
  const minPrice = Math.min(...data.map((d) => d.low));
  return { maxPrice, minPrice, priceRange: maxPrice - minPrice || 1 };
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  dims: Dims,
  range: PriceRange
): void {
  const { w, padding, chartW, chartH } = dims;
  const { maxPrice, priceRange } = range;

  const gridColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--border")
    .trim() || "#1a1a2e";
  const textColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--text-faint")
    .trim() || "#555";

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  ctx.fillStyle = textColor;
  ctx.font = "10px monospace";

  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();

    const price = maxPrice - (priceRange / 4) * i;
    ctx.fillText(`$${price.toFixed(2)}`, padding.left + 2, y - 3);
  }

  // Suppress unused variable warning — chartW used by callers but not grid
  void chartW;
}

function drawCandles(
  ctx: CanvasRenderingContext2D,
  data: Kline[],
  range: PriceRange,
  dims: Dims
): void {
  const { padding, chartW, chartH } = dims;
  const { minPrice, priceRange } = range;

  const greenColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--green")
    .trim() || "#00c853";
  const redColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--red")
    .trim() || "#ff1744";

  const candleW = chartW / data.length;
  const bodyW = Math.max(candleW * 0.6, 2);

  const toY = (price: number) =>
    padding.top + chartH - ((price - minPrice) / priceRange) * chartH;

  data.forEach((d, i) => {
    const x = padding.left + i * candleW + candleW / 2;
    const isGreen = d.close >= d.open;
    const color = isGreen ? greenColor : redColor;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, toY(d.high));
    ctx.lineTo(x, toY(d.low));
    ctx.stroke();

    const openY = toY(d.open);
    const closeY = toY(d.close);
    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.max(Math.abs(openY - closeY), 1);

    ctx.fillStyle = color;
    ctx.fillRect(x - bodyW / 2, bodyTop, bodyW, bodyHeight);
  });
}

interface Props {
  data: Kline[];
  symbol: string;
  title: string;
}

export function CandleChart({ data, symbol, title }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    if (!data || data.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const bgColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--bg-surface")
      .trim() || "#111118";
    const mutedColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--text-muted")
      .trim() || "#888";

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    const padding = { top: 20, bottom: 20, left: 10, right: 10 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    const dims: Dims = { w, h, padding, chartW, chartH };
    const range = normalizeRange(data);

    drawGrid(ctx, dims, range);
    drawCandles(ctx, data, range, dims);

    ctx.fillStyle = mutedColor;
    ctx.font = "11px sans-serif";
    ctx.fillText(`${symbol} — ${title}`, padding.left + 4, 14);
  }, [data, symbol, title]);

  useEffect(() => {
    draw();

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      draw();
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [draw]);

  return (
    <div ref={containerRef} className="candle-chart">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Gráfico de velas de ${symbol}, últimos 7 días, intervalo 4 horas`}
        style={{
          width: "100%",
          height: "200px",
          borderRadius: "var(--radius-md)",
          marginTop: "8px",
          display: "block",
        }}
      />
    </div>
  );
}
