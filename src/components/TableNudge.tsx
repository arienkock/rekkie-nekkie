/** "De tafel van 1 ken je al!": once every chosen table is known (Level 2),
 *  suggest the next one instead of more pages of tables she already knows.
 *  On Vandaag it adds the table to her choice; after a session it starts one. */
import { suggestNextTable } from '../generators/multiplication-facts'

export function TableNudge({ selected, levelOf, action, onChoose }: {
  selected: number[]
  levelOf: (table: number) => number | undefined
  action: 'add' | 'start'
  onChoose: (table: number) => void
}) {
  const { known, next } = suggestNextTable(selected, levelOf)
  if (next === null) return null
  const names = known.length === 1 ? `De tafel van ${known[0]}` : `De tafels van ${known.slice(0, -1).join(', ')} en ${known[known.length - 1]}`
  return (
    <div className="table-nudge" role="status">
      <p>⭐ {names} ken je al! Klaar voor iets nieuws? Probeer de <strong>tafel van {next}</strong>.</p>
      <button type="button" className="btn primary" onClick={() => onChoose(next)}>
        {action === 'add' ? `＋ Tafel van ${next} erbij` : `▶ Oefen de tafel van ${next}`}
      </button>
    </div>
  )
}
