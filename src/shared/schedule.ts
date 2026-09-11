function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/**
 * Next monthly occurrence of `dayOfMonth` at `time` (HH:mm, local) strictly after `from`.
 * Clamps to the last day of shorter months (e.g. Jan 31 → Feb 28).
 */
export function computeNextRun(dayOfMonth: number, time: string, from: number = Date.now()): number {
  const [hh, mm] = time.split(':').map((n) => parseInt(n, 10))
  const hour = Number.isFinite(hh) ? hh : 9
  const minute = Number.isFinite(mm) ? mm : 0
  const base = new Date(from)
  for (let i = 0; i < 4; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1, hour, minute, 0, 0)
    const day = Math.min(Math.max(1, dayOfMonth), daysInMonth(d.getFullYear(), d.getMonth()))
    d.setDate(day)
    if (d.getTime() > from) return d.getTime()
  }
  return from + 30 * 24 * 3600 * 1000
}
