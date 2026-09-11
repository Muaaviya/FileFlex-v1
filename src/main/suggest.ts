import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  extractSignals,
  withMtimeFallback,
  normalizeName,
} from "../shared/signals";
import { composeName, fillIndex } from "../shared/naming";
import { CATEGORY_FOLDERS, CATEGORY_LABELS } from "../shared/classifier";
import type {
  Category,
  NamingRule,
  ScanFile,
  Suggestion,
} from "../shared/types";
import type { DupGroup } from "./duplicates";

const DUP_FOLDER = "_Duplicates";
const STRUCTURE_THRESHOLD = 8;

function pushMap<K, V>(map: Map<K, V[]>, key: K, val: V): void {
  const arr = map.get(key);
  if (arr) arr.push(val);
  else map.set(key, [val]);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function ruleMatches(
  rule: NamingRule,
  f: ScanFile,
  sig: ReturnType<typeof extractSignals>,
): boolean {
  if (rule.requireCourse && !sig.course) return false;
  if (rule.requireDateFromName && !sig.date) return false;
  if (
    rule.extensions.length &&
    !rule.extensions
      .map((e) => e.toLowerCase().replace(/^\./, ""))
      .includes(f.ext.replace(/^\./, ""))
  )
    return false;
  if (
    rule.docTypes.length &&
    (!sig.docType || !rule.docTypes.includes(sig.docType))
  )
    return false;
  return true;
}

function renameReason(
  rule: NamingRule,
  sig: ReturnType<typeof extractSignals>,
  full: ReturnType<typeof withMtimeFallback>,
): string {
  const bits: string[] = [];
  if (full.date)
    bits.push(
      `date ${full.date.iso}${sig.date ? "" : " (from modified time)"}`,
    );
  if (sig.docType) bits.push(`type “${sig.docType}”`);
  if (sig.course) bits.push(`course code ${sig.course}`);
  if (sig.topic) bits.push(`topic “${sig.topic}”`);
  if (sig.noisy) bits.push("cleanup markers (copy/final/draft)");
  return `Detected ${bits.join(", ") || "no usable signals"} — applied rule “${rule.name}”`;
}

function titleCase(s: string): string {
  return s
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function archiveTarget(f: ScanFile): string {
  const date = new Date().toISOString().slice(0, 10);
  const rel = path.relative(f.scanRoot, f.dir);
  const relPart = rel && !rel.startsWith("..") ? rel : "";
  return path.join(f.scanRoot, DUP_FOLDER, date, relPart, f.name);
}

/**
 * Builds all suggestions for a scan. Priority per file: duplicate > merge > rename > structure move,
 * so every file is claimed by at most one suggestion.
 */
export function buildSuggestions(
  files: ScanFile[],
  dupGroups: DupGroup[],
  rules: NamingRule[],
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const claimed = new Set<string>();
  const rulesSorted = [...rules]
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority - b.priority);

  // 1) Duplicates — keep the newest copy, archive the rest (never delete)
  for (const g of dupGroups) {
    const members = [...g.files].sort(
      (a, b) => b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path),
    );
    const keep = members[0];
    const others = members.slice(1);
    if (!others.length) continue;
    const gid = g.id;
    const label = `${g.files.length} ${g.kind === "exact" ? "identical" : "similar"} files — keep “${keep.name}”`;
    for (const f of others) {
      claimed.add(f.id);
      suggestions.push({
        id: randomUUID(),
        kind: "duplicate",
        from: f.path,
        to: archiveTarget(f),
        confidence: g.kind === "exact" ? 0.93 : 0.62,
        reason:
          g.kind === "exact"
            ? "Identical content, verified by SHA-256 checksum"
            : "Same name and similar size as a newer file",
        detail: `Keep newest: ${keep.name} — original is moved to ${DUP_FOLDER}/, never deleted`,
        tags: ["duplicate"],
        groupId: gid,
        groupLabel: label,
        keepPath: keep.path,
      });
    }
  }

  // 2) Merge candidates — same normalized base across formats or folders
  const byNormBase = new Map<string, ScanFile[]>();
  for (const f of files) {
    if (claimed.has(f.id)) continue;
    const norm = normalizeName(f.base);
    if (norm.length < 4) continue;
    pushMap(byNormBase, norm, f);
  }
  for (const [norm, group] of byNormBase) {
    const active = group.filter((f) => !claimed.has(f.id));
    if (active.length < 2) continue;
    const exts = new Set(active.map((f) => f.ext));
    const dirs = new Set(active.map((f) => f.dir.toLowerCase()));
    if (exts.size < 2 && dirs.size < 2) continue;
    const topic = titleCase(norm);
    const targetDir = path.join(active[0].scanRoot, topic);
    const conf = clamp(
      0.5 + (dirs.size > 1 ? 0.1 : 0) + 0.05 * (active.length - 2),
      0.5,
      0.75,
    );
    const gid = randomUUID();
    const where = dirs.size > 1 ? `${dirs.size} folders` : "multiple formats";
    for (const f of active) {
      claimed.add(f.id);
      suggestions.push({
        id: randomUUID(),
        kind: "merge",
        from: f.path,
        to: path.join(targetDir, f.name),
        confidence: conf,
        reason: `Files named “${norm}” are scattered across ${where}`,
        detail: `Consolidate into one folder: ${targetDir}`,
        tags: ["merge"],
        groupId: gid,
        groupLabel: `Consolidate ${active.length} files into ${topic}/`,
      });
    }
  }

  // 3) Renames — first matching rule wins, {index} avoids target collisions
  const indexCounters = new Map<string, number>();
  for (const f of files) {
    if (claimed.has(f.id)) continue;
    const sig = extractSignals(f.base);
    if (!sig.date && !sig.docType && !sig.topic && !sig.course) continue;
    for (const rule of rulesSorted) {
      if (!ruleMatches(rule, f, sig)) continue;
      const full = withMtimeFallback(sig, f.mtimeMs);
      const composed = composeName(rule.pattern, full, rule.casing, f.ext);
      if (composed.toLowerCase() === f.name.toLowerCase()) break; // already standard per this rule
      let finalName = composed;
      if (composed.includes("{index}")) {
        const key = `${f.dir}|${composed}`;
        const n = (indexCounters.get(key) ?? 0) + 1;
        indexCounters.set(key, n);
        finalName = fillIndex(composed, n);
      }
      const confidence = clamp(
        0.35 +
          (sig.date ? 0.3 : full.date ? -0.05 : 0) +
          (sig.docType ? 0.15 : 0) +
          (sig.course ? 0.1 : 0) +
          (sig.topic ? 0.05 : 0) +
          (sig.noisy ? 0.1 : 0),
        0.3,
        0.95,
      );
      claimed.add(f.id);
      suggestions.push({
        id: randomUUID(),
        kind: "rename",
        from: f.path,
        to: path.join(f.dir, finalName),
        confidence,
        reason: renameReason(rule, sig, full),
        detail: `Rule: ${rule.name}`,
        tags: sig.tags,
      });
      break;
    }
  }

  // 4) Folder structure — loose files in the root of a scanned folder
  const roots = new Set(files.map((f) => f.scanRoot));
  for (const root of roots) {
    const loose = files.filter(
      (f) => f.scanRoot === root && f.dir === root && !claimed.has(f.id),
    );
    const byCat = new Map<Category, ScanFile[]>();
    loose.forEach((f) => pushMap(byCat, f.category, f));
    for (const [cat, group] of byCat) {
      if (group.length < STRUCTURE_THRESHOLD) continue;
      const targetDir = path.join(root, CATEGORY_FOLDERS[cat]);
      const conf = clamp(0.5 + group.length * 0.01, 0.5, 0.7);
      const gid = randomUUID();
      const label = `Organize ${group.length} loose ${CATEGORY_LABELS[cat].toLowerCase()} into ${CATEGORY_FOLDERS[cat]}/`;
      for (const f of group) {
        claimed.add(f.id);
        suggestions.push({
          id: randomUUID(),
          kind: "move",
          from: f.path,
          to: path.join(targetDir, f.name),
          confidence: conf,
          reason: `${group.length} loose ${CATEGORY_LABELS[cat].toLowerCase()} sitting in the folder root`,
          detail: `Organize into ${targetDir}`,
          tags: ["organize"],
          groupId: gid,
          groupLabel: label,
        });
      }
    }
  }

  const kindOrder: Record<Suggestion["kind"], number> = {
    rename: 0,
    duplicate: 1,
    merge: 2,
    move: 3,
  };
  return suggestions.sort(
    (a, b) =>
      kindOrder[a.kind] - kindOrder[b.kind] ||
      b.confidence - a.confidence ||
      a.from.localeCompare(b.from),
  );
}
