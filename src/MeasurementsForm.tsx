import { useState, type FormEvent } from 'react'
import {
  DEFAULT_MEASUREMENTS,
  MEASUREMENT_FIELDS,
  type Measurements,
} from './measurements'

type Props = {
  // Called ONLY when the user presses Generate — this is what updates the avatar.
  onGenerate: (measurements: Measurements) => void
}

export function MeasurementsForm({ onGenerate }: Props) {
  // Draft values are kept as strings so the inputs can be edited freely
  // (including being temporarily empty) without fighting the user. We turn them
  // into clamped numbers only when Generate is pressed.
  // Build the initial draft from the field list, so adding a measurement only
  // means editing measurements.ts (not touching this component).
  const [draft, setDraft] = useState<Record<keyof Measurements, string>>(
    () =>
      Object.fromEntries(
        MEASUREMENT_FIELDS.map((f) => [f.key, String(DEFAULT_MEASUREMENTS[f.key])]),
      ) as Record<keyof Measurements, string>,
  )

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // Parse each draft string, fall back to the default if blank/invalid, then
    // clamp into the field's allowed range so the avatar never gets nonsense.
    const result = {} as Measurements
    for (const field of MEASUREMENT_FIELDS) {
      const parsed = Number(draft[field.key])
      const value = Number.isFinite(parsed) ? parsed : DEFAULT_MEASUREMENTS[field.key]
      result[field.key] = Math.min(field.max, Math.max(field.min, value))
    }
    onGenerate(result)
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h1>Your measurements</h1>
      <p className="hint">Enter your body measurements, then press Generate.</p>

      {MEASUREMENT_FIELDS.map((field) => (
        <div className="field" key={field.key}>
          <label htmlFor={field.key}>{field.label} (cm)</label>
          <input
            id={field.key}
            type="number"
            min={field.min}
            max={field.max}
            value={draft[field.key]}
            onChange={(e) =>
              setDraft((d) => ({ ...d, [field.key]: e.target.value }))
            }
          />
        </div>
      ))}

      <button className="generate-btn" type="submit">
        Generate
      </button>
    </form>
  )
}
