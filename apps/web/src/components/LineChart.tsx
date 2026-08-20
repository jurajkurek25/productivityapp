export interface LineChartPoint {
  label: string;
  value: number | null;
}

interface LineChartProps {
  points: LineChartPoint[];
  min?: number;
  max?: number;
  color?: string;
  height?: number;
}

const WIDTH = 600;

export function LineChart({ points, min = 0, max = 100, height = 140, color = "#4f46e5" }: LineChartProps) {
  const usable = points.filter((p) => p.value !== null) as { label: string; value: number }[];
  if (usable.length === 0) {
    return <div className="flex h-[140px] items-center justify-center text-sm text-slate-300">—</div>;
  }

  const padY = 8;
  const range = Math.max(1, max - min);
  const stepX = points.length > 1 ? WIDTH / (points.length - 1) : 0;

  function toXY(index: number, value: number): [number, number] {
    const x = stepX * index;
    const y = padY + (1 - (value - min) / range) * (height - padY * 2);
    return [x, y];
  }

  const linePoints = points
    .map((p, i) => (p.value !== null ? toXY(i, p.value) : null))
    .filter((xy): xy is [number, number] => xy !== null);

  const pathD = linePoints.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  const last = usable[usable.length - 1];
  const first = usable[0];

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} preserveAspectRatio="none" className="h-[140px] w-full" role="img" aria-label={`${first.label} to ${last.label}: ${first.value} to ${last.value}`}>
        <line x1={0} y1={height / 2} x2={WIDTH} y2={height / 2} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4 4" />
        <path d={pathD} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {linePoints.length > 0 && (
          <circle cx={linePoints[linePoints.length - 1][0]} cy={linePoints[linePoints.length - 1][1]} r={3.5} fill={color} />
        )}
      </svg>
      <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
        <span>{first.label}</span>
        <span className="font-medium text-slate-600">{last.value}</span>
        <span>{last.label}</span>
      </div>
    </div>
  );
}
