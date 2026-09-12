import React, { useEffect, useRef } from "react";

export default function ActivityChart({ historyEvents = [], participants = [] }) {
  const chartCanvasRef = useRef(null);

  useEffect(() => {
    const canvas = chartCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = "rgba(4, 7, 17, 0.9)";
    ctx.fillRect(0, 0, width, height);

    // Draw subtle grid lines
    ctx.strokeStyle = "rgba(56, 189, 248, 0.1)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Now plot events within last 60 seconds
    const now = Date.now();
    const windowMs = 60000;

    // Draw participant blinks
    historyEvents.forEach((ev) => {
      const timeDiff = now - (ev.timestamp || now);
      if (timeDiff <= windowMs) {
        const x = width - (timeDiff / windowMs) * width;
        const color = ev.color || "#00f2fe";

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, height - 25, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, height - 25);
        ctx.lineTo(x, height - 25 - Math.min(60, (ev.durationMs || 100) / 3));
        ctx.stroke();
      }
    });

    // Time Axis Labels
    ctx.fillStyle = "#64748b";
    ctx.font = "10px monospace";
    ctx.fillText("-60s", 10, height - 5);
    ctx.fillText("-30s", width / 2 - 10, height - 5);
    ctx.fillText("NOW", width - 35, height - 5);
  }, [historyEvents]);

  return (
    <section className="activity-chart-panel">
      <div className="panel-header">
        <div className="panel-title-lockup">
          <span className="panel-icon">📈</span>
          <h2 className="panel-title">60-SECOND OPTICAL ACTIVITY TIMELINE</h2>
        </div>
        <div className="participant-legend">
          {participants.map((p) => (
            <span key={p.key} className="legend-item" style={{ color: p.color || "#00f2fe" }}>
              ● {p.name || p.key}
            </span>
          ))}
        </div>
      </div>
      <div className="chart-wrapper">
        <canvas
          ref={chartCanvasRef}
          width="800"
          height="120"
          className="activity-canvas"
        />
      </div>
    </section>
  );
}
