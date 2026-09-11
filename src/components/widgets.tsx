/**
 * Visual manipulatives (docs/webapp-architecture-spec.md §4, adaptive design
 * §4.3). Pure SVG/HTML renderers of the generator's WidgetSpec payloads.
 * All widgets are static-read in v1: interaction happens through the answer
 * inputs, keeping a single evidence path.
 */
import type { WidgetSpec } from '../domain/types'

// ---- Dispatcher ----

export function ExerciseWidget({ widget }: { widget: WidgetSpec | null }) {
  if (!widget) return null
  const p = widget.props
  switch (widget.type) {
    case 'dhte-grid':
      return <DhteGrid columns={(p.columns as string[]) ?? ['D', 'H', 'T', 'E']} />
    case 'number-line':
      return (
        <div className="widget-scroll">
          <NumberLineWidget range={p.range as [number, number]} jumps={(p.jumps as Jump[]) ?? []} />
        </div>
      )
    case 'column-grid':
      return <ColumnGrid operation={(p.operation as string) ?? '+'} operands={(p.operands as number[]) ?? []} />
    case 'ruler':
      return (
        <div className="widget-scroll">
          <RulerWidget startMm={(p.startMm as number) ?? 0} endMm={(p.endMm as number) ?? 0} />
        </div>
      )
    case 'clock':
      return <ClockWidget hours={(p.hours as number) ?? 0} minutes={(p.minutes as number) ?? 0} />
    case 'division-groups':
      return (
        <DivisionGroups
          total={(p.total as number) ?? 0}
          groupSize={(p.groupSize as number) ?? 1}
          mode={(p.mode as 'grouped' | 'ungrouped') ?? 'grouped'}
        />
      )
    case 'money-tray':
      return <MoneyTray price={(p.price as number) ?? 0} paid={(p.paid as number) ?? 0} />
    default:
      return null
  }
}

// ---- 1. DHTE place-value grid ----

const DHTE_LABELS: Record<string, { letter: string; name: string }> = {
  D: { letter: 'D', name: 'Duizendtallen' },
  H: { letter: 'H', name: 'Honderdtallen' },
  T: { letter: 'T', name: 'Tientallen' },
  E: { letter: 'E', name: 'Eenheden' },
}

function DhteGrid({ columns }: { columns: string[] }) {
  return (
    <table className="dhte-grid">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c}>{DHTE_LABELS[c]?.name ?? c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {columns.map((c) => (
            <td key={c} aria-label={DHTE_LABELS[c]?.letter ?? c}>
              ?
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  )
}

// ---- 2. Open number line with jump arcs ----

interface Jump {
  from: number
  to: number
  label: string
}

function NumberLineWidget({ range, jumps }: { range: [number, number]; jumps: Jump[] }) {
  const W = 640
  const H = 130
  const PAD = 36
  const [min, max] = range
  const x = (v: number) => PAD + ((v - min) / (max - min)) * (W - 2 * PAD)

  // Ticks at a readable interval (100s, or 50s for a narrow range).
  const span = max - min
  const step = span > 600 ? 200 : span > 200 ? 100 : 50
  const ticks: number[] = []
  for (let v = min; v <= max; v += step) ticks.push(v)
  if (ticks[ticks.length - 1] !== max) ticks.push(max)

  return (
    <svg className="widget-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Getallenlijn van ${min} tot ${max}`}>
      <line x1={PAD - 12} y1={H - 40} x2={W - PAD + 16} y2={H - 40} stroke="currentColor" strokeWidth={2} />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} y1={H - 46} x2={x(t)} y2={H - 34} stroke="currentColor" strokeWidth={1.5} />
          <text x={x(t)} y={H - 14} textAnchor="middle" className="svg-label">
            {t}
          </text>
        </g>
      ))}
      {jumps.map((j, i) => {
        const x1 = x(j.from)
        const x2 = x(j.to)
        const lift = 44 + (i % 3) * 26
        const mid = (x1 + x2) / 2
        return (
          <g key={`${j.from}-${j.to}-${i}`} className="jump-arc">
            <path
              d={`M ${x1} ${H - 42} Q ${mid} ${H - 42 - lift * 2} ${x2} ${H - 42}`}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2.5}
              markerEnd="url(#arrow)"
            />
            <text x={mid} y={H - 48 - lift} textAnchor="middle" className="svg-label jump-label">
              {j.label}
            </text>
            <circle cx={x2} cy={H - 42} r={4.5} fill="var(--accent)" />
          </g>
        )
      })}
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
        </marker>
      </defs>
    </svg>
  )
}

// ---- 3. Columnar cijferen grid ----

function ColumnGrid({ operation, operands }: { operation: string; operands: number[] }) {
  const width = Math.max(...operands.map((n) => String(n).length)) + 2
  const fmt = (n: number) => String(n).padStart(width, ' ')
  return (
    <div className="column-grid" aria-label={`Onder elkaar: ${operands.join(` ${operation} `)}`}>
      <pre>
        {operands.map((n, i) => (
          <div key={i}>
            <span className="col-op">{i === operands.length - 1 ? operation : ''}</span>
            {fmt(n)}
          </div>
        ))}
        <div className="col-rule">{'—'.repeat(width + 2)}</div>
        <div>
          <span className="col-op" />
          {'?'.repeat(1).padEnd(width, ' ')}
        </div>
      </pre>
    </div>
  )
}

// ---- 4. Measurement ruler with offset pencil ----

function RulerWidget({ startMm, endMm }: { startMm: number; endMm: number }) {
  const PX_PER_MM = 4
  const RULER_MM = 150
  const W = RULER_MM * PX_PER_MM + 40
  const H = 90
  const ORIGIN = 20
  const x = (mm: number) => ORIGIN + mm * PX_PER_MM

  const ticks: Array<{ mm: number; h: number; label?: string }> = []
  for (let mm = 0; mm <= RULER_MM; mm++) {
    const h = mm % 10 === 0 ? 16 : mm % 5 === 0 ? 10 : 5
    ticks.push({ mm, h, label: mm % 10 === 0 ? String(mm / 10) : undefined })
  }

  const pencilY = 46
  return (
    <svg className="widget-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Liniaal. Het potlood begint bij ${startMm} millimeter.`}>
      <rect x={ORIGIN} y={40} width={RULER_MM * PX_PER_MM} height={24} rx={4} fill="var(--widget-fill)" stroke="var(--border-strong)" />
      {ticks.map((t) => (
        <g key={t.mm}>
          <line
            x1={x(t.mm)}
            y1={40}
            x2={x(t.mm)}
            y2={40 + t.h}
            stroke="currentColor"
            strokeWidth={t.mm % 10 === 0 ? 1.6 : 0.8}
          />
          {t.label && (
            <text x={x(t.mm)} y={78} textAnchor="middle" className="svg-label">
              {t.label}
            </text>
          )}
        </g>
      ))}
      {/* Pencil: fixed-length bracket from startMm to endMm */}
      <g className="pencil">
        <rect x={x(startMm)} y={pencilY - 16} width={Math.max(4, (endMm - startMm) * PX_PER_MM - 8)} height={14} rx={4} fill="var(--pencil-body)" stroke="var(--border-strong)" />
        <polygon
          points={`${x(endMm) - 8},${pencilY - 16} ${x(endMm)},${pencilY - 9} ${x(endMm) - 8},${pencilY - 2}`}
          fill="var(--pencil-tip)"
        />
      </g>
    </svg>
  )
}

// ---- 5. Analog clock ----

function ClockWidget({ hours, minutes }: { hours: number; minutes: number }) {
  const SIZE = 200
  const C = SIZE / 2
  const R = 82
  // Spec §4.3: hour angle 30h + 0.5m; minute angle 6m.
  const hourAngle = (30 * (hours % 12) + 0.5 * minutes) * (Math.PI / 180)
  const minuteAngle = 6 * minutes * (Math.PI / 180)
  const hand = (angle: number, length: number) => ({
    x2: C + length * Math.sin(angle),
    y2: C - length * Math.cos(angle),
  })
  const hourEnd = hand(hourAngle, R * 0.5)
  const minuteEnd = hand(minuteAngle, R * 0.78)

  return (
    <svg className="widget-svg" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`Klok: ${hours} uur en ${minutes} minuten`}>
      <circle cx={C} cy={C} r={R + 8} fill="var(--widget-fill)" stroke="var(--border-strong)" strokeWidth={2} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180
        const x1 = C + (R - 2) * Math.sin(a)
        const y1 = C - (R - 2) * Math.cos(a)
        const x2 = C + (R - 10) * Math.sin(a)
        const y2 = C - (R - 10) * Math.cos(a)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={i % 3 === 0 ? 2.5 : 1.2} />
      })}
      {[12, 3, 6, 9].map((n, i) => {
        const a = (i * 90 * Math.PI) / 180
        return (
          <text key={n} x={C + (R - 22) * Math.sin(a)} y={C - (R - 22) * Math.cos(a) + 5} textAnchor="middle" className="svg-number">
            {n}
          </text>
        )
      })}
      <line x1={C} y1={C} x2={hourEnd.x2} y2={hourEnd.y2} className="clock-hand hour-hand" />
      <line x1={C} y1={C} x2={minuteEnd.x2} y2={minuteEnd.y2} className="clock-hand minute-hand" />
      <circle cx={C} cy={C} r={4} fill="currentColor" />
    </svg>
  )
}

// ---- 6. Division groups (quotient + remainder model) ----

function DivisionGroups({
  total,
  groupSize,
  mode,
}: {
  total: number
  groupSize: number
  /** Grouped circles (with a labeled remainder) scaffold S0/S1 work but
   *  would hand out the answer at independent tiers — those get a neutral,
   *  ungrouped dot grid instead. */
  mode: 'grouped' | 'ungrouped'
}) {
  if (mode === 'ungrouped') {
    return (
      <div className="division-groups ungrouped" role="img" aria-label={`${total} dingen`}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className="dg-dot" />
        ))}
        <span className="dg-caption">totaal {total}</span>
      </div>
    )
  }
  const quotient = Math.floor(total / groupSize)
  const remainder = total % groupSize
  const groups = Array.from({ length: quotient }, () => groupSize)
  return (
    <div className="division-groups" role="img" aria-label={`${total} dingen in groepjes van ${groupSize}`}>
      {groups.map((size, gi) => (
        <div key={gi} className="dg-group">
          {Array.from({ length: size }, (_, i) => (
            <span key={i} className="dg-dot" />
          ))}
          <span className="dg-caption">groepje van {size}</span>
        </div>
      ))}
      {remainder > 0 && (
        <div className="dg-group dg-rest">
          {Array.from({ length: remainder }, (_, i) => (
            <span key={i} className="dg-dot" />
          ))}
          <span className="dg-caption">rest: {remainder}</span>
        </div>
      )}
    </div>
  )
}

// ---- 7. Euro money tray ----

function euro(cents: number): string {
  return `€${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`
}

/** Greedy euro denominations for the "paid" tray display. */
function euroBreakdown(cents: number): Array<{ value: number; count: number }> {
  const denoms = [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5]
  const out: Array<{ value: number; count: number }> = []
  let left = cents
  for (const d of denoms) {
    if (left >= d) {
      out.push({ value: d, count: Math.floor(left / d) })
      left %= d
    }
  }
  return out
}

function MoneyTray({ price, paid }: { price: number; paid: number }) {
  const tray = euroBreakdown(paid)
  return (
    <div className="money-tray">
      <div className="mt-card mt-price">
        <span className="mt-label">Prijs</span>
        <span className="mt-amount">{euro(price)}</span>
      </div>
      <div className="mt-arrow">betaald met →</div>
      <div className="mt-card mt-paid">
        <span className="mt-label">Betaald</span>
        <span className="mt-amount">{euro(paid)}</span>
        <div className="mt-coins">
          {tray.map(({ value, count }) => (
            <span key={value} className="mt-coin">
              {euro(value)}
              {count > 1 ? ` ×${count}` : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
