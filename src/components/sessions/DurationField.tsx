import { SelectField } from '@/components/ui/TextField'
import { addToClock, formatDuration } from '@/lib/format'

const CHOICES = [30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 360, 420, 480, 600, 720]

/**
 * How long a session runs (pilot feedback, Nov 2026). A duration instead of an end time, so a class can run past
 * midnight; the helper shows the clock times, e.g. "22:00–00:30, next day".
 */
export function DurationField({ value, onChange, start, error }: { value: number; onChange: (minutes: number) => void; start: string; error?: string | null }) {
  const choices = CHOICES.includes(value) ? CHOICES : [...CHOICES, value].sort((a, b) => a - b)
  const end = /^\d{2}:\d{2}$/.test(start) ? addToClock(start, value) : null
  return (
    <SelectField
      label="Duration"
      value={String(value)}
      onChange={(e) => onChange(Number(e.target.value))}
      error={error}
      helper={end ? `${start}–${end.time}${end.nextDay ? ', next day' : ''}` : undefined}
    >
      {choices.map((m) => (
        <option key={m} value={m}>
          {formatDuration(m)}
        </option>
      ))}
    </SelectField>
  )
}
