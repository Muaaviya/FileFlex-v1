import type { Casing } from './types'
import type { NameSignals } from './signals'

const FORBIDDEN = /[\\/:*?"<>|]/g

export function applyCasing(s: string, casing: Casing): string {
  const t = s.trim()
  if (!t) return ''
  switch (casing) {
    case 'snake':
      return t.toLowerCase().replace(/\s+/g, '_')
    case 'kebab':
      return t.toLowerCase().replace(/\s+/g, '-')
    case 'lower':
      return t.toLowerCase()
    default:
      return t
  }
}

/**
 * Composes a standardized file name from a rule pattern.
 * Tokens: {date} {year} {month} {day} {type} {course} {topic} {index} {ext}
 * Empty tokens are dropped and separators collapsed.
 */
export function composeName(
  pattern: string,
  sig: NameSignals,
  casing: Casing,
  ext: string
): string {
  const values: Record<string, string> = {
    date: sig.date ? sig.date.iso : '',
    year: sig.date ? String(sig.date.year) : '',
    month: sig.date ? String(sig.date.month).padStart(2, '0') : '',
    day: sig.date ? String(sig.date.day).padStart(2, '0') : '',
    type: applyCasing(sig.docType ?? '', casing === 'keep' ? 'snake' : casing),
    course: sig.course ?? '',
    topic: applyCasing(sig.topic, casing),
    index: String(sig.tokens.length ? '' : '')
  }
  values.index = ''

  let name = pattern.replace(/\{(\w+)\}/g, (whole, key: string) => {
    if (key === 'index') return whole // filled in later by the caller via fillIndex
    return values[key] ?? ''
  })

  // collapse repeated separators left by empty tokens, trim the ends
  name = name.replace(/[_\s.-]{2,}/g, (m) => m[0])
  name = name.replace(/^[_\s.-]+|[_\s.-]+$/g, '')
  name = name.replace(FORBIDDEN, '')
  if (!name) name = 'file'
  if (!name.toLowerCase().endsWith(ext.toLowerCase())) name += ext
  return name
}

/** Replaces {index} with a 2-padded counter once final numbering is known. */
export function fillIndex(name: string, index: number): string {
  return name.replace(/\{index\}/g, String(index).padStart(2, '0'))
}

export function splitPath(p: string): { dir: string; name: string } {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i === -1 ? { dir: '', name: p } : { dir: p.slice(0, i), name: p.slice(i + 1) }
}

/** Character-level prefix/suffix diff between two strings (for the diff view). */
export function diffStrings(a: string, b: string): { pre: string; midA: string; midB: string; post: string } {
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  return { pre: a.slice(0, start), midA: a.slice(start, endA), midB: b.slice(start, endB), post: a.slice(endA) }
}
