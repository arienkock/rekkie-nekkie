/** "Waarom sla je deze over?": one tap answers and skips. Used by single
 *  items and by test pages. */
import type { SkipReason } from '../analytics/types'

const SKIP_CHOICES: Array<{ reason: SkipReason; label: string }> = [
  { reason: 'too-easy', label: '😎 Te makkelijk' },
  { reason: 'too-hard', label: '😵 Te moeilijk' },
  { reason: 'unclear', label: '🤔 Ik snap de vraag niet' },
  { reason: 'no-reason', label: 'Gewoon overslaan' },
]

export function SkipAsk({ onSkip, onCancel }: { onSkip: (reason: SkipReason) => void; onCancel: () => void }) {
  return (
    <div className="skip-ask" role="group" aria-labelledby="skip-ask-title">
      <p id="skip-ask-title" className="skip-ask-title">Waarom sla je deze over?</p>
      <div className="skip-ask-choices">
        {SKIP_CHOICES.map((c) => (
          <button key={c.reason} type="button" className="btn ghost" onClick={() => onSkip(c.reason)}>
            {c.label}
          </button>
        ))}
      </div>
      <button type="button" className="btn ghost small" onClick={onCancel}>
        Toch niet, ik ga verder
      </button>
    </div>
  )
}
