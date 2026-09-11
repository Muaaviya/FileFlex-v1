import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { normalizeName } from "../shared/signals";
import type { ScanFile, ScanProgress } from "../shared/types";

export interface DupGroup {
  id: string;
  kind: "exact" | "near";
  files: ScanFile[];
}

async function pool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await fn(items[idx]);
      }
    }),
  );
  return results;
}

async function sampleHash(f: ScanFile): Promise<string> {
  const h = createHash("sha256");
  const stream = createReadStream(f.path, { start: 0, end: 65535 });
  for await (const chunk of stream) h.update(chunk as Buffer);
  return h.digest("hex");
}

async function fullHash(p: string): Promise<string> {
  const h = createHash("sha256");
  const stream = createReadStream(p);
  for await (const chunk of stream) h.update(chunk as Buffer);
  return h.digest("hex");
}

function pushMap<K, V>(map: Map<K, V[]>, key: K, val: V): void {
  const arr = map.get(key);
  if (arr) arr.push(val);
  else map.set(key, [val]);
}

/**
 * Exact duplicates: group by size → 64 KB sample hash → full SHA-256 on collision.
 * Near duplicates: same normalized name + extension, similar size, not already exact.
 */
export async function findDuplicateGroups(
  files: ScanFile[],
  onProgress?: (p: ScanProgress) => void,
): Promise<DupGroup[]> {
  const groups: DupGroup[] = [];
  const exactIds = new Set<string>();

  const bySize = new Map<number, ScanFile[]>();
  for (const f of files) {
    if (f.size === 0) continue;
    pushMap(bySize, f.size, f);
  }
  const sizeGroups = [...bySize.entries()].filter(([, g]) => g.length > 1);

  let done = 0;
  for (const [, group] of sizeGroups) {
    const hashes = await pool(group, 6, sampleHash);
    const bySample = new Map<string, ScanFile[]>();
    group.forEach((f, i) => pushMap(bySample, hashes[i], f));
    for (const candidates of bySample.values()) {
      if (candidates.length < 2) continue;
      const fh = await pool(candidates, 4, (f) => fullHash(f.path));
      const byFull = new Map<string, ScanFile[]>();
      candidates.forEach((f, i) => pushMap(byFull, fh[i], f));
      for (const same of byFull.values()) {
        if (same.length < 2) continue;
        same.forEach((f) => exactIds.add(f.id));
        groups.push({ id: randomUUID(), kind: "exact", files: same });
      }
    }
    done++;
    onProgress?.({
      phase: "analyze",
      files: done,
      dir: `checksum group ${done}/${sizeGroups.length}`,
    });
  }

  const byNorm = new Map<string, ScanFile[]>();
  for (const f of files) {
    if (exactIds.has(f.id)) continue;
    const norm = normalizeName(f.base);
    if (norm.length < 3) continue;
    pushMap(byNorm, `${norm}|${f.ext}`, f);
  }
  for (const group of byNorm.values()) {
    if (group.length < 2) continue;
    const sizes = group.map((f) => f.size);
    const min = Math.min(...sizes);
    const max = Math.max(...sizes);
    if (min === 0 || max / min > 3) continue;
    groups.push({ id: randomUUID(), kind: "near", files: group });
  }

  return groups;
}
