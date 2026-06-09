import { useEffect, useRef } from "react";

export function CandleChart({ data, symbol, title }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!data || data.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = "#111118";
    ctx.fillRect(0, 0, w, h);

    // Compute ranges
    const highs = data.map((d) => d.high);
    const lows = data.map((d) => d.low);
    const maxPrice = Math.max(...highs);
    const minPrice = Math.min(...lows);
    const priceRange = maxPrice - minPrice || 1;

    const padding = { top: 20, bottom: 20, left: 10, right: 10 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    const candleW = chartW / data.length;
    const bodyW = Math.max(candleW * 0.6, 2);

    const toY = (price) =>
      padding.top + chartH - ((price - minPrice) / priceRange) * chartH;

    // Grid lines
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      const price = maxPrice - (priceRange / 4) * i;
      ctx.fillStyle = "#555";
      ctx.font = "10px monospace";
      ctx.fillText(`$${price.toFixed(2)}`, padding.left + 2, y - 3);
    }

    // Candles
    data.forEach((d, i) => {
      const x = padding.left + i * candleW + candleW / 2;
      const isGreen = d.close >= d.open;
      const color = isGreen ? "#00c853" : "#ff1744";

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, toY(d.high));
      ctx.lineTo(x, toY(d.low));
      ctx.stroke();

      // Body
      const openY = toY(d.open);
      const closeY = toY(d.close);
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(Math.abs(openY - closeY), 1);

      ctx.fillStyle = color;
      ctx.fillRect(x - bodyW / 2, bodyTop, bodyW, bodyHeight);
    });

    // Title
    ctx.fillStyle = "#888";
    ctx.font = "11px sans-serif";
    ctx.fillText(`${symbol} — ${title}`, padding.left + 4, 14);
  }, [data, symbol, title]);

  return (
    <div className="candle-chart">
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "200px",
          borderRadius: "8px",
          marginTop: "8px",
        }}
      />
    </div>
  );
}
