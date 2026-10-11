import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { computeNextRun } from "../shared/schedule";
import type { Batch, NamingRule, ScanResult, Settings } from "../shared/types";

export const DEFAULT_RULES: NamingRule[] = [
  {
    id: "rule-invoices",
    name: "Invoices & receipts",
    enabled: true,
    priority: 1,
    pattern: "{type}_{topic}_{date}{ext}",
    casing: "snake",
    extensions: [],
    docTypes: ["invoice", "receipt", "statement"],
  },
  {
    id: "rule-scans",
    name: "Scanner output",
    enabled: true,
    priority: 2,
    pattern: "{type}_{date}_{index}{ext}",
    casing: "snake",
    extensions: [],
    docTypes: ["scan"],
  },
  {
    id: "rule-photos",
    name: "Photos & screenshots",
    enabled: true,
    priority: 3,
    pattern: "{date}_{type}_{topic}{ext}",
    casing: "kebab",
    extensions: ["png", "jpg", "jpeg", "heic", "webp", "gif"],
    docTypes: [],
  },
  {
    id: "rule-course",
    name: "Course files",
    enabled: true,
    priority: 4,
    pattern: "{course}_{type}_{topic}{ext}",
    casing: "snake",
    extensions: [],
    docTypes: [],
    requireCourse: true,
  },
  {
    id: "rule-general",
    name: "General cleanup",
    enabled: true,
    priority: 5,
    pattern: "{date}_{type}_{topic}{ext}",
    casing: "snake",
    extensions: [],
    docTypes: [],
    requireDateFromName: true,
  },
];

export const DEFAULT_SETTINGS: Settings = {
  folders: [],
  scan: { maxDepth: 6, skipHidden: true },
  exclusions: {
    patterns: ["node_modules", ".git", "desktop.ini", "thumbs.db"],
    extensions: ["tmp", "lnk"],
  },
  scheduler: {
    enabled: false,
    dayOfMonth: 1,
    time: "09:00",
    nextRunAt: null,
    lastRunAt: null,
    launchAtStartup: false,
  },
  theme: {
    mode: "system",
    accent: "#2b86ac", // brand-500
    text: "#17202b", // ink
    border: "#e4e8ee", // line
    background: "#f6f8fa", // surface
  },
  themePresets: {},
};

function sleepSync(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* busy wait — used only to back off Windows rename retries */
  }
}

class Store {
  private dir = "";
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private rules: NamingRule[] = DEFAULT_RULES;
  private history: Batch[] = [];

  get dataDir(): string {
    return this.dir;
  }

  init(): void {
    this.dir = path.join(app.getPath("userData"), "data");
    fs.mkdirSync(path.join(this.dir, "scans"), { recursive: true });
    this.settings = this.readJson("settings.json", DEFAULT_SETTINGS);
    this.rules = this.readJson("rules.json", DEFAULT_RULES);
    this.history = this.readJson("history.json", []);
  }

  private file(name: string): string {
    return path.join(this.dir, name);
  }

  private readJson<T>(name: string, fallback: T): T {
    try {
      const parsed: unknown = JSON.parse(
        fs.readFileSync(this.file(name), "utf-8"),
      );
      // Array-backed files (rules, history) must never go through the object
      // merge: spreading an array into {...} yields a plain object with numeric
      // keys, which crashes consumers that iterate it.
      if (Array.isArray(fallback)) {
        if (Array.isArray(parsed)) return parsed as T;
        if (parsed && typeof parsed === "object")
          return Object.values(parsed as Record<string, unknown>) as T;
        return fallback;
      }
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { ...(fallback as object), ...(parsed as object) } as T;
      }
      return fallback;
    } catch {
      return fallback;
    }
  }

  private writeJson(name: string, data: unknown): void {
    const file = this.file(name);
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
    for (let i = 0; i < 5; i++) {
      try {
        fs.renameSync(tmp, file);
        return;
      } catch (e) {
        if (i === 4) throw e;
        sleepSync(50);
      }
    }
  }

  getSettings(): Settings {
    return this.settings;
  }

  updateSettings(patch: Partial<Settings>): Settings {
    const s = this.settings;
    if (patch.folders) s.folders = patch.folders;
    if (patch.scan) s.scan = { ...s.scan, ...patch.scan };
    if (patch.exclusions)
      s.exclusions = { ...s.exclusions, ...patch.exclusions };
    if (patch.scheduler) s.scheduler = { ...s.scheduler, ...patch.scheduler };
    if (patch.theme) s.theme = { ...s.theme, ...patch.theme };
    if (patch.themePresets) s.themePresets = patch.themePresets;
    this.writeJson("settings.json", s);
    return s;
  }

  getRules(): NamingRule[] {
    return this.rules;
  }

  saveRules(rules: NamingRule[]): NamingRule[] {
    this.rules = [...rules].sort((a, b) => a.priority - b.priority);
    this.writeJson("rules.json", this.rules);
    return this.rules;
  }

  getHistory(): Batch[] {
    return this.history;
  }

  saveBatch(batch: Batch): void {
    this.history = [batch, ...this.history];
    this.writeJson("history.json", this.history);
  }

  updateBatch(batch: Batch): void {
    this.history = this.history.map((b) => (b.id === batch.id ? batch : b));
    this.writeJson("history.json", this.history);
  }

  clearHistory(): void {
    this.history = [];
    this.writeJson("history.json", []);
  }

  saveScan(result: ScanResult): void {
    this.writeJson(path.join("scans", "latest.json"), result);
  }

  getLatestScan(): ScanResult | null {
    try {
      return JSON.parse(
        fs.readFileSync(this.file(path.join("scans", "latest.json")), "utf-8"),
      );
    } catch {
      return null;
    }
  }

  ensureNextRun(): void {
    const s = this.settings.scheduler;
    if (s.enabled && !s.nextRunAt) {
      this.updateSettings({
        scheduler: { ...s, nextRunAt: computeNextRun(s.dayOfMonth, s.time) },
      });
    }
  }
}

export const store = new Store();
