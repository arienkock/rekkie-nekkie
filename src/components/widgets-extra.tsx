/**
 * Widgets for the blok 1–2 skills: charts, a kassabon, a maatbeker and a
 * weegschaal, a calendar month, a timetable, coins and notes, a bar model,
 * a number pyramid ("trappen") and the split table of 3 × 235.
 * Static renderers, like the rest: interaction goes through the answer inputs.
 */

function euro(cents: number): string {
  return `€ ${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`
}

// ---- Bar and line charts ----

interface ChartProps {
  title: string
  labels: string[]
  values: number[]
  max: number
  gridStep: number
}

function ChartFrame({ title, labels, max, gridStep, children }: Omit<ChartProps, 'values'> & { children: (x: (i: number) => number, y: (v: number) => number, slot: number) => React.ReactNode }) {
  const W = 560
  const H = 260
  const L = 56
  const B = 36
  const T = 14
  const slot = (W - L - 12) / labels.length
  const x = (i: number) => L + slot * i + slot / 2
  const y = (v: number) => T + (H - T - B) * (1 - v / max)
  const lines: number[] = []
  for (let v = 0; v <= max; v += gridStep) lines.push(v)
  const labelEvery = lines.length > 12 ? Math.ceil(lines.length / 10) : 1
  return (
    <svg className="widget-svg chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Grafiek: ${title}`}>
      {lines.map((v, i) => (
        <g key={v}>
          <line x1={L} x2={W - 8} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
          {i % labelEvery === 0 && <text x={L - 6} y={y(v) + 5} textAnchor="end" className="svg-label small">{v}</text>}
        </g>
      ))}
      <line x1={L} x2={L} y1={T} y2={H - B} stroke="currentColor" strokeWidth={1.5} />
      <line x1={L} x2={W - 8} y1={H - B} y2={H - B} stroke="currentColor" strokeWidth={1.5} />
      {labels.map((l, i) => (
        <text key={l} x={x(i)} y={H - B + 20} textAnchor="middle" className="svg-label small">{l}</text>
      ))}
      <text x={12} y={H / 2} transform={`rotate(-90 12 ${H / 2})`} textAnchor="middle" className="svg-label small">{title}</text>
      {children(x, y, slot)}
    </svg>
  )
}

export function BarChart(p: ChartProps) {
  return (
    <div className="widget-scroll">
      <ChartFrame {...p}>
        {(x, y, slot) => p.values.map((v, i) => (
          <rect key={i} x={x(i) - slot * 0.32} width={slot * 0.64} y={y(v)} height={y(0) - y(v)} fill="var(--accent)" opacity={0.75} />
        ))}
      </ChartFrame>
    </div>
  )
}

export function LineChart(p: ChartProps) {
  return (
    <div className="widget-scroll">
      <ChartFrame {...p}>
        {(x, y) => (
          <g>
            <polyline points={p.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth={2.5} />
            {p.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={4.5} fill="var(--accent)" />)}
          </g>
        )}
      </ChartFrame>
    </div>
  )
}

// ---- Kassabon ----

export function Receipt({ items, showTotal }: { items: Array<{ name: string; cents: number }>; showTotal?: boolean }) {
  const total = items.reduce((s, i) => s + i.cents, 0)
  return (
    <div className="receipt" role="img" aria-label={`Kassabon: ${items.map((i) => `${i.name} ${euro(i.cents)}`).join(', ')}`}>
      <div className="receipt-title">KASSABON</div>
      {items.map((i) => (
        <div key={i.name} className="receipt-row"><span>{i.name.toUpperCase()}</span><span>{euro(i.cents)}</span></div>
      ))}
      <div className="receipt-row receipt-total"><span>TOTAAL</span><span>{showTotal ? euro(total) : '…'}</span></div>
    </div>
  )
}

// ---- Maatbeker and weegschaal ----

export function Beaker({ max, tickStep, labelEvery, labels, level, unit }: { max: number; tickStep: number; labelEvery?: number; labels?: number[]; level: number | null; unit: string }) {
  const H = 240
  const top = 20
  const bottom = H - 16
  const y = (v: number) => bottom - (bottom - top) * (v / max)
  const ticks: number[] = []
  for (let v = 0; v <= max + 1e-9; v += tickStep) ticks.push(Math.round(v))
  const labelled = (v: number) => (labels ? labels.includes(v) : labelEvery ? v % labelEvery === 0 : v === 0 || v === max)
  return (
    <svg className="widget-svg beaker" viewBox={`0 0 200 ${H}`} role="img" aria-label={`Maatbeker tot ${max} ${unit}${level !== null ? '' : ', leeg'}`}>
      {level !== null && <rect x={52} y={y(level)} width={96} height={bottom - y(level)} fill="#9cc9ee" opacity={0.85} />}
      <path d={`M 50 ${top - 8} L 50 ${bottom} L 150 ${bottom} L 150 ${top - 8}`} fill="none" stroke="var(--border-strong)" strokeWidth={3} />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={150} x2={labelled(v) ? 130 : 138} y1={y(v)} y2={y(v)} stroke="currentColor" strokeWidth={labelled(v) ? 1.8 : 1} />
          {labelled(v) && <text x={156} y={y(v) + 5} className="svg-label small">{v}</text>}
        </g>
      ))}
      <text x={156} y={top - 10} className="svg-label small">{unit}</text>
    </svg>
  )
}

export function ScaleDial({ max, tickStep, labelEvery, value, unit }: { max: number; tickStep: number; labelEvery: number; value: number; unit: string }) {
  const C = 110
  const R = 88
  // The dial runs from −135° to +135°.
  const angle = (v: number) => (-135 + 270 * (v / max)) * (Math.PI / 180)
  const ticks: number[] = []
  for (let v = 0; v <= max + 1e-9; v += tickStep) ticks.push(Math.round(v))
  const at = (v: number, r: number) => ({ x: C + r * Math.sin(angle(v)), y: C - r * Math.cos(angle(v)) })
  const needle = at(value, R - 14)
  return (
    <svg className="widget-svg dial" viewBox="0 0 220 220" role="img" aria-label={`Weegschaal tot ${max} ${unit}`}>
      <circle cx={C} cy={C} r={R + 10} fill="var(--widget-fill)" stroke="var(--border-strong)" strokeWidth={2} />
      {ticks.map((v) => {
        const big = v % labelEvery === 0
        const a = at(v, R)
        const b = at(v, R - (big ? 14 : 8))
        const t = at(v, R - 28)
        return (
          <g key={v}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor" strokeWidth={big ? 2 : 1} />
            {big && <text x={t.x} y={t.y + 4} textAnchor="middle" className="svg-label small">{v}</text>}
          </g>
        )
      })}
      <line x1={C} y1={C} x2={needle.x} y2={needle.y} stroke="#c0392b" strokeWidth={3} strokeLinecap="round" />
      <circle cx={C} cy={C} r={5} fill="#c0392b" />
      <text x={C} y={C + 44} textAnchor="middle" className="svg-label small">{unit}</text>
    </svg>
  )
}

// ---- Calendar and timetable ----

const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']

export function CalendarMonth({ year, month, highlight }: { year: number; month: number; highlight: number | null }) {
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  // Monday-first, as on Dutch calendars.
  const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7
  const cells: Array<number | null> = [...Array.from({ length: offset }, () => null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)
  return (
    <table className="calendar" aria-label={`Kalender ${MONTHS[month]} ${year}`}>
      <caption>{MONTHS[month]} {year}</caption>
      <thead><tr>{['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'].map((d) => <th key={d}>{d}</th>)}</tr></thead>
      <tbody>
        {Array.from({ length: cells.length / 7 }, (_, r) => (
          <tr key={r}>{cells.slice(r * 7, r * 7 + 7).map((d, i) => <td key={i} className={d !== null && d === highlight ? 'highlight' : ''}>{d ?? ''}</td>)}</tr>
        ))}
      </tbody>
    </table>
  )
}

export function Timetable({ columns, rows }: { columns: string[]; rows: Array<{ stop: string; times: string[] }> }) {
  return (
    <div className="widget-scroll">
      <table className="timetable">
        <thead><tr><th>Halte</th>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={r.stop}><th scope="row">{r.stop}</th>{r.times.map((t, i) => <td key={i}>{t}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

// ---- Coins and notes ----

export function Coins({ items }: { items: Array<{ value: number; count: number }> }) {
  return (
    <div className="coins" role="img" aria-label={items.map((i) => `${i.count} keer ${euro(i.value)}`).join(', ')}>
      {items.flatMap((i) => Array.from({ length: i.count }, (_, k) => (
        <span key={`${i.value}-${k}`} className={i.value >= 500 ? 'note' : 'coin'}>
          {i.value >= 100 ? `€${i.value / 100}` : `${i.value}c`}
        </span>
      )))}
    </div>
  )
}

// ---- Bar model, pyramid, split table ----

export function BarModel({ total, parts, unknown, labels, unknownLabel }: { total?: number; parts?: number[]; unknown?: number | null; labels?: string[]; unknownLabel?: string }) {
  if (labels) {
    return (
      <div className="bar-model" aria-label="Wat weet je, wat zoek je?">
        {labels.map((l) => <span key={l} className="bm-part">{l}</span>)}
        <span className="bm-part bm-unknown">{unknownLabel ?? '?'}</span>
      </div>
    )
  }
  const sum = total ?? (parts ?? []).reduce((s, p) => s + p, 0)
  return (
    <div className="bar-model" aria-label={`Strook van ${sum}`}>
      <div className="bm-total">{sum}</div>
      <div className="bm-parts">
        {(parts ?? []).map((p, i) => (
          <span key={i} className={`bm-part ${unknown === i ? 'bm-unknown' : ''}`} style={{ flex: Math.max(p, sum * 0.12) }}>
            {unknown === i ? '?' : p}
          </span>
        ))}
      </div>
    </div>
  )
}

export function Pyramid({ rows }: { rows: Array<Array<number | null>> }) {
  // rows[0] is the bottom; draw from the top down.
  return (
    <div className="pyramid" aria-label="Rekentrap: twee stenen naast elkaar zijn samen de steen erboven">
      {[...rows].reverse().map((row, r) => (
        <div key={r} className="pyramid-row">
          {row.map((v, i) => <span key={i} className={`brick ${v === null ? 'empty' : ''}`}>{v ?? ''}</span>)}
        </div>
      ))}
    </div>
  )
}

export function SplitTable({ factor, parts }: { factor: number; parts: number[] }) {
  return (
    <table className="split-table" aria-label={`${factor} keer ${parts.join(' + ')}`}>
      <thead><tr><th>×</th>{parts.map((p) => <th key={p}>{p}</th>)}</tr></thead>
      <tbody><tr><th>{factor}</th>{parts.map((p) => <td key={p}>…</td>)}</tr></tbody>
    </table>
  )
}
