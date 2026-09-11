import { randomUUID } from "node:crypto";
import type {
  Category,
  ScanProgress,
  ScanResult,
  ScanFile,
  Settings,
  Suggestion,
} from "../shared/types";
import { MAX_FILES, scanFolders } from "./scanner";
import { findDuplicateGroups } from "./duplicates";
import { buildSuggestions } from "./suggest";
import { store } from "./store";

export function scanOptionsFromSettings(s: Settings) {
  return {
    folders: s.folders,
    maxDepth: s.scan.maxDepth,
    skipHidden: s.scan.skipHidden,
    excludePatterns: s.exclusions.patterns,
    excludeExtensions: s.exclusions.extensions,
  };
}

function summarize(files: ScanFile[], suggestions: Suggestion[]) {
  const byCategory: Partial<Record<Category, { count: number; size: number }>> =
    {};
  let totalSize = 0;
  for (const f of files) {
    const entry = byCategory[f.category] ?? { count: 0, size: 0 };
    entry.count++;
    entry.size += f.size;
    byCategory[f.category] = entry;
    totalSize += f.size;
  }
  const counts = { rename: 0, duplicate: 0, merge: 0, move: 0 };
  let duplicateFileCount = 0;
  let duplicateSize = 0;
  for (const s of suggestions) {
    counts[s.kind]++;
    if (s.kind === "duplicate") {
      duplicateFileCount++;
      const f = files.find((x) => x.path === s.from);
      if (f) duplicateSize += f.size;
    }
  }
  return {
    fileCount: files.length,
    totalSize,
    byCategory,
    counts,
    duplicateFileCount,
    duplicateSize,
  };
}

export async function runScan(
  folders: string[],
  onProgress?: (p: ScanProgress) => void,
): Promise<ScanResult> {
  const settings = store.getSettings();
  const { files, truncated } = await scanFolders(
    scanOptionsFromSettings({ ...settings, folders }),
    onProgress,
  );
  onProgress?.({
    phase: "analyze",
    files: files.length,
    dir: "checksumming & matching duplicates",
  });
  const dupGroups = await findDuplicateGroups(files, onProgress);
  const suggestions = buildSuggestions(files, dupGroups, store.getRules());
  return {
    id: randomUUID(),
    scannedAt: Date.now(),
    folders,
    truncated: truncated || files.length >= MAX_FILES,
    summary: summarize(files, suggestions),
    files,
    suggestions,
  };
}
