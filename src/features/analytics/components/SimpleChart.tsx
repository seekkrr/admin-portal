import { useEffect, useRef, useState } from "react";

/**
 * Compute clean integer y-axis ticks with no duplicates.
 * Returns { ticks: number[], topVal: number } where topVal is the chart ceiling.
 */
function computeYTicks(dataMax: number, maxTicks = 5): { ticks: number[]; topVal: number } {
    if (dataMax <= 0) return { ticks: [0, 1], topVal: 1 };
    const rawStep = dataMax / maxTicks;
    const step = rawStep < 1 ? 1 : Math.ceil(rawStep);
    const topVal = Math.ceil(dataMax / step) * step;
    const ticks: number[] = [];
    for (let v = 0; v <= topVal; v += step) ticks.push(v);
    return { ticks, topVal };
}

export function SimpleLineChart({ data, color = "#4f46e5", height = 250, className = "" }: { data: {label: string, value: number}[]; color?: string; height?: number; className?: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const width = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, width, h);

        if (data.length === 0 || width === 0) return;

        const values = data.map(d => d.value);
        const dataMax = Math.max(...values, 0);
        const { ticks, topVal } = computeYTicks(dataMax);
        const max = topVal;
        const min = 0;
        const range = max;

        // Increase scale for high DPI
        const scale = 2;
        ctx.scale(scale, scale);
        const drawW = width / scale;
        const drawH = h / scale;

        const paddingBottom = 40;
        const paddingTop = 20;
        const paddingSides = 40;
        const chartWidth = drawW - paddingSides * 2;
        const chartHeight = drawH - paddingBottom - paddingTop;

        const stepX = chartWidth / Math.max(values.length - 1, 1);

        // Draw grid + y-axis labels using clean integer ticks
        ctx.strokeStyle = "#f5f5f5";
        ctx.lineWidth = 1;
        ticks.forEach(tickVal => {
            const y = paddingTop + ((max - tickVal) / max) * chartHeight;
            ctx.beginPath();
            ctx.moveTo(paddingSides, y);
            ctx.lineTo(drawW - paddingSides, y);
            ctx.stroke();

            ctx.fillStyle = "#a3a3a3";
            ctx.font = "10px sans-serif";
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.fillText(tickVal.toString(), paddingSides - 10, y);
        });

        // Draw Line
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        values.forEach((val, i) => {
            const x = paddingSides + i * stepX;
            const y = drawH - paddingBottom - ((val - min) / range) * chartHeight;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);

            // X-axis label (only draw a few to avoid clutter)
            if (data.length <= 10 || (i % Math.ceil(data.length / 5) === 0 && i < data.length - 3) || i === data.length - 1) {
                ctx.fillStyle = "#a3a3a3";
                ctx.font = "10px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                let lbl = data[i]?.label || "";
                const match = lbl.match(/^(\d{4}-\d{2}(?:-\d{2})?)(.*)$/);
                if (match) {
                    const dateStr = match[1]!;
                    const rest = match[2]!;
                    if (dateStr.length === 10) {
                        const d = new Date(dateStr);
                        lbl = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + rest;
                    } else if (dateStr.length === 7) {
                        const [y, m] = dateStr.split('-') as [string, string];
                        const d = new Date(parseInt(y), parseInt(m) - 1, 1);
                        lbl = d.toLocaleDateString(undefined, { month: 'short' }) + rest;
                    }
                }
                if (lbl.length > 15) {
                    lbl = lbl.substring(0, 13) + '..';
                }
                ctx.fillText(lbl, x, drawH - paddingBottom + 10);
            }
        });
        ctx.stroke();

        // Fill area
        ctx.lineTo(drawW - paddingSides, drawH - paddingBottom);
        ctx.lineTo(paddingSides, drawH - paddingBottom);
        ctx.closePath();
        const gradient = ctx.createLinearGradient(0, paddingTop, 0, drawH - paddingBottom);
        gradient.addColorStop(0, `${color}40`);
        gradient.addColorStop(1, `${color}00`);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw data points
        values.forEach((val, i) => {
            const x = paddingSides + i * stepX;
            const y = drawH - paddingBottom - ((val - min) / range) * chartHeight;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = "#fff";
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = color;
            ctx.stroke();
        });
        
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform

    }, [data, color, size]);

    return (
        <div ref={containerRef} className={`w-full relative ${className}`} style={{ height }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} width={size.width * 2} height={size.height * 2} />
            {data.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm bg-white/80">
                    No data available
                </div>
            )}
        </div>
    );
}

export function SimpleBarChart({ data, height = 250, className = "" }: { data: {label: string, value: number, color?: string}[]; height?: number; className?: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const width = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, width, h);

        if (data.length === 0 || width === 0) return;

        const values = data.map(d => d.value);
        const dataMax = Math.max(...values, 0);
        const { ticks, topVal } = computeYTicks(dataMax);
        const max = topVal;

        const scale = 2;
        ctx.scale(scale, scale);
        const drawW = width / scale;
        const drawH = h / scale;

        const paddingBottom = 40;
        const paddingTop = 20;
        const paddingSides = 40;
        const chartWidth = drawW - paddingSides * 2;
        const chartHeight = drawH - paddingBottom - paddingTop;

        const barWidth = Math.min((chartWidth / data.length) * 0.6, 60);
        const stepX = chartWidth / data.length;

        // Draw grid + y-axis labels using clean integer ticks
        ctx.strokeStyle = "#f5f5f5";
        ctx.lineWidth = 1;
        ticks.forEach(tickVal => {
            const y = paddingTop + ((max - tickVal) / max) * chartHeight;
            ctx.beginPath();
            ctx.moveTo(paddingSides, y);
            ctx.lineTo(drawW - paddingSides, y);
            ctx.stroke();

            ctx.fillStyle = "#a3a3a3";
            ctx.font = "10px sans-serif";
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.fillText(tickVal.toString(), paddingSides - 10, y);
        });

        data.forEach((d, i) => {
            const x = paddingSides + i * stepX + (stepX - barWidth) / 2;
            const barHeight = (d.value / max) * chartHeight;
            const y = drawH - paddingBottom - barHeight;

            ctx.fillStyle = d.color || "#4f46e5";
            // Draw bar with rounded top
            const r = Math.min(barWidth / 2, barHeight / 2, 4);
            ctx.beginPath();
            ctx.moveTo(x, drawH - paddingBottom);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.lineTo(x + barWidth - r, y);
            ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + r);
            ctx.lineTo(x + barWidth, drawH - paddingBottom);
            ctx.fill();

            // X-axis Label
            ctx.fillStyle = "#737373";
            ctx.font = "10px sans-serif";
            ctx.textAlign = "center";
            if (data.length <= 15 || i % Math.ceil(data.length / 10) === 0) {
                let lbl = d.label;
                const match = lbl.match(/^(\d{4}-\d{2}(?:-\d{2})?)(.*)$/);
                if (match) {
                    const dateStr = match[1]!;
                    const rest = match[2]!;
                    if (dateStr.length === 10) {
                        const dt = new Date(dateStr);
                        lbl = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + rest;
                    } else if (dateStr.length === 7) {
                        const [y, m] = dateStr.split('-') as [string, string];
                        const dt = new Date(parseInt(y), parseInt(m) - 1, 1);
                        lbl = dt.toLocaleDateString(undefined, { month: 'short' }) + rest;
                    }
                }
                if (lbl.length > 15) {
                    lbl = lbl.substring(0, 13) + '..';
                }
                ctx.fillText(lbl, x + barWidth / 2, drawH - paddingBottom + 16);
            }
        });
        
        ctx.setTransform(1, 0, 0, 1, 0, 0);

    }, [data, size]);

    return (
        <div ref={containerRef} className={`w-full relative ${className}`} style={{ height }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} width={size.width * 2} height={size.height * 2} />
            {data.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm bg-white/80">
                    No data available
                </div>
            )}
        </div>
    );
}

export function SimpleDoughnutChart({ data, height = 200, className = "" }: { data: {label: string, value: number, color: string}[]; height?: number; className?: string }) {
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [dim, setDim] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!canvasContainerRef.current) return;
        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                setDim({ width: entry.contentRect.width, height: entry.contentRect.height });
            }
        });
        observer.observe(canvasContainerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const width = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, width, h);

        if (data.length === 0 || width === 0) return;

        const scale = 2;
        ctx.scale(scale, scale);
        const drawW = width / scale;
        const drawH = h / scale;

        const total = data.reduce((sum, d) => sum + d.value, 0);
        if (total === 0) return;

        const cx = drawW / 2;
        const cy = drawH / 2;
        const radius = Math.min(cx, cy) * 0.75;
        const innerRadius = radius * 0.6;

        let startAngle = -Math.PI / 2;

        data.forEach(d => {
            const sliceAngle = (d.value / total) * 2 * Math.PI;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
            ctx.arc(cx, cy, innerRadius, startAngle + sliceAngle, startAngle, true);
            ctx.fillStyle = d.color;
            ctx.fill();
            startAngle += sliceAngle;
        });

        ctx.setTransform(1, 0, 0, 1, 0, 0);

    }, [data, dim]);

    return (
        <div className={`flex flex-col items-center ${className}`}>
            <div ref={canvasContainerRef} className="w-full relative" style={{ height }}>
                <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} width={dim.width * 2} height={dim.height * 2} />
                {data.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm bg-white/80 rounded-lg">
                        No data available
                    </div>
                )}
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                {data.map((d, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-sm">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-neutral-500">{d.label}</span>
                        <span className="font-semibold text-neutral-800">{d.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
