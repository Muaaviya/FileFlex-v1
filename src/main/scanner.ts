import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { categoryFor } from '../shared/classifier'
import type { ScanFile, ScanProgress } from '../shared/types'

export interface ScanOptions {
  folders: string[]
  maxDepth: number
  skipHidden: boolean
  excludePatterns: string[]
  excludeExtensions: string[]
}

export const MAX_FILES = 50000

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '$recycle.bin',
  'system volume information',
  '$windows.~bt',
  'appdata'
])

function globToRegex(pattern: string): { re: RegExp; hasSep: boolean } {
  const p = pattern.trim().toLowerCase()
  const src = p
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0001')
    .replace(/\*/g, '[^\\\\/]*')
    .replace(/\u0001/g, '.*')
    .replace(/\?/g, '[^\\\\/]')
  return { re: new RegExp(`^${src}$`), hasSep: p.includes('/') || p.includes('\\') }
}

class Exclusions {
  private items: Array<{ re: RegExp; hasSep: boolean }>

  constructor(patterns: string[]) {
    this.items = patterns.filter((p) => p.trim()).map(globToRegex)
  }

  matches(fullPath: string, name: string): boolean {
    const lower = fullPath.toLowerCase()
    const lowerName = name.toLowerCase()
    return this.items.some(({ re, hasSep }) => (hasSep ? re.test(lower) : re.test(lowerName)))
  }
}

export async function scanFolders(
  opts: ScanOptions,
  onProgress?: (p: ScanProgress) => void
): Promise<{ files: ScanFile[]; truncated: boolean }> {
  const files: ScanFile[] = []
  let truncated = false
  const excl = new Exclusions(opts.excludePatterns)
  const exclExts = new Set(opts.excludeExtensions.map((e) => e.toLowerCase().replace(/^\./, '')))

  async function walk(dir: string, root: string, depth: number): Promise<void> {
    if (truncated || depth > opts.maxDepth) return
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (files.length >= MAX_FILES) {
        truncated = true
        return
      }
      if (opts.skipHidden && (entry.name.startsWith('.') || entry.name.startsWith('$'))) continue
      if (SKIP_DIRS.has(entry.name.toLowerCase())) continue
      const full = path.join(dir, entry.name)
      if (excl.matches(full, entry.name)) continue
      if (entry.isDirectory()) {
        await walk(full, root, depth + 1)
        continue
      }
      if (!entry.isFile()) continue
      const ext = path.extname(entry.name).toLowerCase()
      if (exclExts.has(ext.replace(/^\./, ''))) continue
      let st
      try {
        st = await fs.stat(full)
      } catch {
        continue
      }
      files.push({
        id: createHash('sha1').update(full.toLowerCase()).digest('hex').slice(0, 12),
        path: full,
        dir,
        name: entry.name,
        base: path.basename(entry.name, path.extname(entry.name)),
        ext,
        size: st.size,
        mtimeMs: st.mtimeMs,
        ctimeMs: st.ctimeMs,
        category: categoryFor(ext),
        scanRoot: root
      })
      if (files.length % 50 === 0) onProgress?.({ phase: 'scan', files: files.length, dir })
    }
  }

  for (const root of opts.folders) await walk(root, root, 0)
  return { files, truncated }
}
