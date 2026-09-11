import { create } from "zustand";
import { computeNextRun } from "../../shared/schedule";
import type {
  AppInfo,
  Batch,
  NamingRule,
  PlannedOp,
  ScanProgress,
  ScanResult,
  Settings,
} from "../../shared/types";
import { api } from "./api";

export type Decision = "approved" | "dismissed" | "applied";

export interface Toast {
  id: number;
  text: string;
  tone: "ok" | "warn" | "bad";
}

interface AppState {
  ready: boolean;
  info: AppInfo | null;
  settings: Settings | null;
  rules: NamingRule[];
  scan: ScanResult | null;
  scanning: boolean;
  progress: ScanProgress | null;
  decisions: Record<string, Decision>;
  selection: Record<string, true>;
  history: Batch[];
  toasts: Toast[];

  init: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  addFolders: (paths: string[]) => Promise<void>;
  removeFolder: (folder: string) => Promise<void>;
  patchSettings: (patch: Partial<Settings>) => Promise<void>;
  startScan: () => Promise<void>;
  runNow: () => Promise<void>;
  prepareSample: () => Promise<void>;
  decide: (ids: string[], decision: Decision | null) => void;
  toggleSelect: (id: string) => void;
  selectMany: (ids: string[], on: boolean) => void;
  clearSelection: () => void;
  applyApproved: () => Promise<number>;
  undoBatch: (id: string) => Promise<void>;
  saveRules: (rules: NamingRule[]) => Promise<void>;
  resetRules: () => Promise<void>;
  clearHistory: () => Promise<void>;
  toast: (text: string, tone?: Toast["tone"]) => void;
  dropToast: (id: number) => void;
}

function errText(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const idx = raw.lastIndexOf("Error: ");
  return idx >= 0 ? raw.slice(idx + 7) : raw;
}

let toastSeq = 1;
let initOnce: Promise<void> | null = null;

export const useStore = create<AppState>((set, get) => ({
  ready: false,
  info: null,
  settings: null,
  rules: [],
  scan: null,
  scanning: false,
  progress: null,
  decisions: {},
  selection: {},
  history: [],
  toasts: [],

  init: async () => {
    if (initOnce) return initOnce;
    initOnce = (async () => {
      api.onScanProgress((p) => {
        if (get().scanning) set({ progress: p });
      });
      api.onSchedulerFired(async () => {
        get().toast(
          "Monthly scan finished — new suggestions are waiting in the queue.",
          "warn",
        );
        set({ scan: await api.getLatestScan() });
      });
      const [info, settings, rules, history, scan] = await Promise.all([
        api.getInfo(),
        api.getSettings(),
        api.getRules(),
        api.getHistory(),
        api.getLatestScan(),
      ]);
      set({ info, settings, rules, history, scan, ready: true });
    })();
    return initOnce;
  },

  refreshHistory: async () => {
    set({ history: await api.getHistory() });
  },

  addFolders: async (paths) => {
    const s = get().settings;
    if (!s) return;
    const merged = [...new Set([...s.folders, ...paths])];
    set({ settings: await api.updateSettings({ folders: merged }) });
  },

  removeFolder: async (folder) => {
    const s = get().settings;
    if (!s) return;
    set({
      settings: await api.updateSettings({
        folders: s.folders.filter((f) => f !== folder),
      }),
    });
  },

  patchSettings: async (patch) => {
    set({ settings: await api.updateSettings(patch) });
  },

  startScan: async () => {
    if (get().scanning) return;
    set({ scanning: true, progress: null });
    try {
      const scan = await api.startScan();
      set({ scan, decisions: {}, selection: {} });
    } catch (e) {
      get().toast(errText(e), "bad");
    } finally {
      set({ scanning: false, progress: null });
    }
  },

  runNow: async () => {
    if (get().scanning) return;
    set({ scanning: true, progress: null });
    try {
      const scan = await api.runScanNow();
      set({ scan, decisions: {}, selection: {} });
      get().toast("Scan finished — suggestions updated.", "ok");
    } catch (e) {
      get().toast(errText(e), "bad");
    } finally {
      set({ scanning: false, progress: null });
    }
  },

  prepareSample: async () => {
    try {
      const dir = await api.prepareSampleData();
      await get().addFolders([dir]);
      get().toast("Sample folder created and added to the scan list.", "ok");
    } catch (e) {
      get().toast(errText(e), "bad");
    }
  },

  decide: (ids, decision) =>
    set((state) => {
      const d = { ...state.decisions };
      const sel = { ...state.selection };
      for (const id of ids) {
        if (decision) d[id] = decision;
        else delete d[id];
        delete sel[id];
      }
      return { decisions: d, selection: sel };
    }),

  toggleSelect: (id) =>
    set((state) => {
      const sel = { ...state.selection };
      if (sel[id]) delete sel[id];
      else sel[id] = true;
      return { selection: sel };
    }),

  selectMany: (ids, on) =>
    set((state) => {
      const sel = { ...state.selection };
      for (const id of ids) {
        if (on) sel[id] = true;
        else delete sel[id];
      }
      return { selection: sel };
    }),

  clearSelection: () => set({ selection: {} }),

  applyApproved: async () => {
    const { scan, decisions } = get();
    if (!scan) return 0;
    const approved = scan.suggestions.filter(
      (s) => decisions[s.id] === "approved",
    );
    if (!approved.length) return 0;
    const ops: PlannedOp[] = approved.map((s) => ({
      kind: s.kind === "rename" ? "rename" : "move",
      from: s.from,
      to: s.to,
    }));
    const renames = ops.filter((o) => o.kind === "rename").length;
    const label = `Approved changes — ${renames} renamed, ${ops.length - renames} moved or archived`;
    try {
      await api.applyBatch({ label, ops });
      const next = { ...get().decisions };
      for (const s of approved) next[s.id] = "applied";
      set({ decisions: next, selection: {} });
      await get().refreshHistory();
      get().toast(
        `Applied ${ops.length} changes. Undo anytime from History.`,
        "ok",
      );
      return ops.length;
    } catch (e) {
      get().toast(errText(e), "bad");
      return 0;
    }
  },

  undoBatch: async (id) => {
    try {
      const batch = await api.undoBatch(id);
      await get().refreshHistory();
      get().toast(
        batch.status === "undone"
          ? "All changes in this batch were rolled back."
          : "Batch partially rolled back — see details.",
        batch.status === "undone" ? "ok" : "warn",
      );
    } catch (e) {
      get().toast(errText(e), "bad");
    }
  },

  saveRules: async (rules) => {
    set({ rules: await api.saveRules(rules) });
  },

  resetRules: async () => {
    set({ rules: await api.resetRules() });
    get().toast("Naming rules restored to defaults.", "ok");
  },

  clearHistory: async () => {
    await api.clearHistory();
    await get().refreshHistory();
    get().toast("History cleared.", "ok");
  },

  toast: (text, tone = "ok") => {
    const id = toastSeq++;
    set((state) => ({ toasts: [...state.toasts, { id, text, tone }] }));
    setTimeout(() => get().dropToast(id), 5200);
  },

  dropToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Scheduler preview used by both Settings and the sidebar footer. */
export function nextRunPreview(s: Settings | null): number | null {
  if (!s || !s.scheduler.enabled) return null;
  return computeNextRun(s.scheduler.dayOfMonth, s.scheduler.time);
}
