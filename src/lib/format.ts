/** Dates and times as the designs show them (§05): "Mon 19 Oct", 24-hour clock. */
export function formatDay(value: string | Date, timeZone?: string): string {
  const date = new Date(value)
  const parts = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('weekday')} ${get('day')} ${get('month')}`
}

export function formatTime(value: string | Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(new Date(value))
}

/** "+01:00" for a time zone at the current date. */
function utcOffset(timeZone: string): string {
  const name = new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(new Date())
    .find((p) => p.type === 'timeZoneName')?.value
  const offset = name?.replace('GMT', '') || '+00:00'
  return offset
}

/** "West Africa Time — Lagos (UTC+01:00)", as on R1.03. */
export function timeZoneLabel(timeZone: string): string {
  const genericRaw = new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'longGeneric' })
    .formatToParts(new Date())
    .find((p) => p.type === 'timeZoneName')?.value
  const city = timeZone.split('/').at(-1)!.replaceAll('_', ' ')
  // Zones without daylight saving get "Standard" names in some browsers; the designs use the generic form.
  const generic = genericRaw?.replace(' Standard Time', ' Time')
  const name = generic && !generic.startsWith('GMT') ? `${generic} — ${city}` : city
  return `${name} (UTC${utcOffset(timeZone)})`
}

/** All IANA time zones, sorted by UTC offset then name. */
export function timeZoneOptions(): { value: string; label: string }[] {
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['Africa/Lagos', 'UTC']
  const toMinutes = (offset: string) => {
    const match = offset.match(/([+-])(\d{2}):(\d{2})/)
    return match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0
  }
  return zones
    .map((zone) => ({ value: zone, label: timeZoneLabel(zone), offset: toMinutes(utcOffset(zone)) }))
    .sort((a, b) => a.offset - b.offset || a.label.localeCompare(b.label))
    .map(({ value, label }) => ({ value, label }))
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos'
  } catch {
    return 'Africa/Lagos'
  }
}

/** A calendar date "2026-10-05" as "Mon 5 Oct" (or "Mon 5 Oct 2026"). Dates have no time zone. */
export function formatDate(isoDate: string, options: { year?: boolean } = {}): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(options.year && { year: 'numeric' }),
    timeZone: 'UTC',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('weekday')} ${get('day')} ${get('month')}${options.year ? ` ${get('year')}` : ''}`
}

/** "Mon 5 Oct – Fri 18 Dec 2026" (the year once when both dates share it). */
export function formatDateRange(start: string, end: string): string {
  const sameYear = start.slice(0, 4) === end.slice(0, 4)
  return `${formatDate(start, { year: !sameYear })} – ${formatDate(end, { year: true })}`
}

/** Today in a time zone, as "2026-10-21". */
export function todayIn(timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

/** A moment as "Mon 6 Apr 2026" in a time zone. */
export function formatDayWithYear(value: string | Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone }).formatToParts(new Date(value))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('weekday')} ${get('day')} ${get('month')} ${get('year')}`
}

/** "Today", "Yesterday", or "Mon 12 Oct" — for "Last active". */
export function relativeDay(value: string | Date, timeZone?: string): string {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
  const today = todayIn(timeZone)
  const yesterday = new Date(`${today}T12:00:00Z`)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  if (day === today) return 'Today'
  if (day === yesterday.toISOString().slice(0, 10)) return 'Yesterday'
  return formatDay(value, timeZone)
}

/** 90 → "1h 30m", 120 → "2h", 45 → "45m". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`
}

/** "2h (10:00–12:00)", with ", next day" when it runs past midnight — duration first (pilot feedback, Nov 2026). */
export function formatTimeRange(start: string | Date, end: string | Date, timeZone?: string): string {
  const minutes = (new Date(end).getTime() - new Date(start).getTime()) / 60_000
  const nextDay = localDate(end, timeZone) > localDate(start, timeZone)
  return `${formatDuration(minutes)} (${formatTime(start, timeZone)}–${formatTime(end, timeZone)}${nextDay ? ', next day' : ''})`
}

/** A session's length, e.g. "2h" — under the start time in compact lists. */
export const lengthOf = (start: string | Date, end: string | Date) => formatDuration((new Date(end).getTime() - new Date(start).getTime()) / 60_000)

/** "22:00" + 150 → { time: "00:30", nextDay: true }. */
export function addToClock(time: string, minutes: number): { time: string; nextDay: boolean } {
  const [h, m] = time.split(':').map(Number)
  const total = h! * 60 + m! + minutes
  const wrapped = ((total % 1440) + 1440) % 1440
  return { time: `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`, nextDay: total >= 1440 }
}

/** The organisation-local date of a moment, as "2026-10-21". */
export function localDate(value: string | Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAY_PLURALS = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays']

/** [1, 3] → "Mon and Wed" (or "Mondays and Wednesdays" with `plural`). */
export function weekdayList(days: number[], options: { plural?: boolean } = {}): string {
  const names = [...days].sort().map((d) => (options.plural ? WEEKDAY_PLURALS : WEEKDAY_NAMES)[d - 1]!)
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

/** "Just now", "12m ago", "6h ago", then the day ("Yesterday", "Mon 3 Nov") — for feeds such as announcements. */
export function timeAgo(value: string | Date, timeZone?: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(value).getTime()) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 60 * 12) return `${Math.floor(minutes / 60)}h ago`
  return `${relativeDay(value, timeZone)}, ${formatTime(value, timeZone)}`
}
