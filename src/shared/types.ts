export type Category =
  | "documents"
  | "spreadsheets"
  | "presentations"
  | "pdfs"
  | "images"
  | "archives"
  | "media"
  | "code"
  | "design"
  | "other";

export interface ScanFile {
  id: string;
  path: string;
  dir: string;
  name: string;
  base: string;
  ext: string;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
  category: Category;
  scanRoot: string;
}

export type SuggestionKind = "rename" | "duplicate" | "merge" | "move";

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  from: string;
  to: string;
  confidence: number;
  reason: string;
  detail?: string;
  tags: string[];
  groupId?: string;
  groupLabel?: string;
  keepPath?: string;
}

export interface ScanSummary {
  fileCount: number;
  totalSize: number;
  byCategory: Partial<Record<Category, { count: number; size: number }>>;
  counts: { rename: number; duplicate: number; merge: number; move: number };
  duplicateFileCount: number;
  duplicateSize: number;
}

export interface ScanResult {
  id: string;
  scannedAt: number;
  folders: string[];
  truncated: boolean;
  summary: ScanSummary;
  files: ScanFile[];
  suggestions: Suggestion[];
}

export interface ScanProgress {
  phase: "scan" | "analyze";
  files: number;
  dir?: string;
}

export type OpKind = "rename" | "move";

export interface PlannedOp {
  kind: OpKind;
  from: string;
  to: string;
}

export interface BatchOp {
  kind: OpKind;
  from: string;
  to: string;
  status: "ok" | "error" | "undone";
  error?: string;
}

export interface Batch {
  id: string;
  label: string;
  appliedAt: number;
  undoneAt?: number;
  status: "applied" | "undone" | "partial";
  ops: BatchOp[];
}

export type Casing = "keep" | "snake" | "kebab" | "lower";

export interface NamingRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  pattern: string;
  casing: Casing;
  extensions: string[];
  docTypes: string[];
  requireCourse?: boolean;
  /** Only fire when the filename itself contains a date (prevents mtime-based mass renames). */
  requireDateFromName?: boolean;
}

export interface ThemeSettings {
  mode: "light" | "dark" | "system";
  accent: string;
  text: string;
  border: string;
  background: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  theme: ThemeSettings;
}

export interface Settings {
  folders: string[];
  scan: { maxDepth: number; skipHidden: boolean };
  exclusions: { patterns: string[]; extensions: string[] };
  scheduler: {
    enabled: boolean;
    dayOfMonth: number;
    time: string;
    nextRunAt: number | null;
    lastRunAt: number | null;
    launchAtStartup: boolean;
  };
  theme: ThemeSettings;
  themePresets: Record<string, ThemePreset>;
}

export interface AppInfo {
  version: string;
  dataDir: string;
  platform: string;
}
