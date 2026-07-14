/**
 * Inline SVG sparkline. Nulls break the line into gap segments; isolated
 * points render as dots so single samples between gaps stay visible.
 */
export function Sparkline({
  series,
  width = 84,
  height = 22,
}: {
  series: (number | null)[];
  width?: number;
  height?: number;
}) {
  const vals = series.filter((v): v is number => v != null && Number.isFinite(v));
  if (vals.length === 0) {
    return <span className="font-mono text-[11px] text-ink-faint">—</span>;
  }

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const flat = max === min;
  const n = series.length;
  const px = (i: number) => (n <= 1 ? width / 2 : 1.5 + (i / (n - 1)) * (width - 3));
  const py = (v: number) => (flat ? height / 2 : height - 2.5 - ((v - min) / (max - min)) * (height - 5));

  let d = '';
  let prevNull = true;
  const lone: { x: number; y: number }[] = [];
  let last: { x: number; y: number } | null = null;
  series.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) {
      prevNull = true;
      return;
    }
    const x = px(i);
    const y = py(v);
    const nextNull = i === n - 1 || series[i + 1] == null;
    if (prevNull && nextNull) lone.push({ x, y });
    d += `${prevNull ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    prevNull = false;
    last = { x, y };
  });
  const end: { x: number; y: number } = last ?? { x: width / 2, y: height / 2 };

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="block">
      <path
        d={d}
        fill="none"
        stroke="var(--ebay-blue)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {lone.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={1.5} fill="var(--ebay-blue)" />
      ))}
      <circle cx={end.x} cy={end.y} r={2} fill="var(--ebay-blue)" />
    </svg>
  );
}
