import { describe, expect, it } from 'vitest'
import { categoryFor } from '../src/shared/classifier'
import type { NamingRule, ScanFile } from '../src/shared/types'
import { type DupGroup } from '../src/main/duplicates'
import { buildSuggestions } from '../src/main/suggest'

function file(name: string, dir: string, size = 100, mtime = 1000): ScanFile {
  const ext = name.slice(name.lastIndexOf('.'))
  const base = name.slice(0, name.length - ext.length)
  return {
    id: `${dir}/${name}`,
    path: `${dir}\\${name}`,
    dir,
    name,
    base,
    ext,
    size,
    mtimeMs: mtime,
    ctimeMs: mtime,
    category: categoryFor(ext),
    scanRoot: 'C:\\Root'
  }
}

const RULES: NamingRule[] = [
  {
    id: 'r1',
    name: 'Invoices',
    enabled: true,
    priority: 1,
    pattern: '{type}_{topic}_{date}{ext}',
    casing: 'snake',
    extensions: [],
    docTypes: ['invoice', 'receipt']
  },
  {
    id: 'r2',
    name: 'General',
    enabled: true,
    priority: 2,
    pattern: '{date}_{type}_{topic}{ext}',
    casing: 'snake',
    extensions: [],
    docTypes: [],
    requireDateFromName: true
  }
]

describe('buildSuggestions', () => {
  it('suggests archiving exact duplicates and keeps the newest', () => {
    const old = file('a.pdf', 'C:\\Root', 100, 1000)
    const newer = file('a (copy).pdf', 'C:\\Root', 100, 2000)
    const groups: DupGroup[] = [{ id: 'g1', kind: 'exact', files: [old, newer] }]
    const out = buildSuggestions([old, newer], groups, RULES)
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('duplicate')
    expect(out[0].from).toBe(old.path)
    expect(out[0].confidence).toBeGreaterThanOrEqual(0.85)
    expect(out[0].to).toContain('_Duplicates')
  })

  it('claims each file at most once', () => {
    const files = [
      file('IMG_20240103_123445.jpg', 'C:\\Root'),
      file('IMG_20240103_123445 (2).jpg', 'C:\\Root'),
      file('report draft.docx', 'C:\\Root'),
      file('report draft (copy).docx', 'C:\\Root'),
      file('report final.docx', 'C:\\Root'),
      file('report.pdf', 'C:\\Root')
    ]
    const groups: DupGroup[] = [
      { id: 'g1', kind: 'exact', files: [files[0], files[1]] },
      { id: 'g2', kind: 'exact', files: [files[2], files[3]] }
    ]
    const out = buildSuggestions(files, groups, RULES)
    const froms = out.map((s) => s.from)
    expect(new Set(froms).size).toBe(froms.length)
    // the exact dupes are claimed by duplicate suggestions, so the merge group
    // only forms from the two unclaimed 'report' files (different extensions)
    const merge = out.find((s) => s.kind === 'merge')
    expect(merge).toBeDefined()
    expect(merge!.to).toContain('Report')
    // the kept duplicate (newest) stays unclaimed, so it joins the merge group:
    // kept draft (copy) + report final.docx + report.pdf → 3 merge suggestions
    expect(merge!.from).toBe(files[3].path)
    expect(out.filter((s) => s.kind === 'merge')).toHaveLength(3)
  })

  it('proposes renames with confidence based on signals', () => {
    const strong = file('receipt_starbucks_20240312.pdf', 'C:\\Root')
    const out = buildSuggestions([strong], [], RULES)
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('rename')
    expect(out[0].to.endsWith('receipt_starbucks_2024-03-12.pdf')).toBe(true)
    expect(out[0].confidence).toBeGreaterThanOrEqual(0.85)
  })

  it('skips files that already match their standard name', () => {
    const f = file('invoice_acme_2024-03-12.pdf', 'C:\\Root')
    const out = buildSuggestions([f], [], RULES)
    expect(out).toHaveLength(0)
  })

  it('proposes structure moves for many loose files of one category', () => {
    // names carry no date/type signals, and the general rule requires a date in
    // the name — so nothing is claimed by renames and the structure rule fires
    const files = Array.from({ length: 10 }, (_, i) => file(`zz loose ${i}.txt`, 'C:\\Root'))
    const out = buildSuggestions(files, [], RULES)
    const moves = out.filter((s) => s.kind === 'move')
    expect(moves.length).toBeGreaterThan(0)
    expect(moves[0].to).toContain('Documents')
  })

  it('ignores disabled rules', () => {
    const f = file('receipt_starbucks_20240312.pdf', 'C:\\Root')
    const disabled = RULES.map((r) => ({ ...r, enabled: false }))
    expect(buildSuggestions([f], [], disabled)).toHaveLength(0)
  })
})
