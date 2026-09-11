import type {
  AppInfo,
  Batch,
  NamingRule,
  PlannedOp,
  ScanProgress,
  ScanResult,
  Settings,
  Suggestion,
} from "./types";

export interface TidyApi {
  getInfo(): Promise<AppInfo>;
  pickFolders(): Promise<string[]>;
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  getRules(): Promise<NamingRule[]>;
  saveRules(rules: NamingRule[]): Promise<NamingRule[]>;
  resetRules(): Promise<NamingRule[]>;
  startScan(): Promise<ScanResult>;
  getLatestScan(): Promise<ScanResult | null>;
  runScanNow(): Promise<ScanResult>;
  dryRun(folders: string[]): Promise<ScanResult>;
  applyBatch(req: { label: string; ops: PlannedOp[] }): Promise<Batch>;
  getHistory(): Promise<Batch[]>;
  undoBatch(batchId: string): Promise<Batch>;
  clearHistory(): Promise<void>;
  runScheduledNow(): Promise<ScanResult>;
  prepareSampleData(): Promise<string>;
  openDataFolder(): Promise<void>;
  onScanProgress(cb: (p: ScanProgress) => void): () => void;
  onSchedulerFired(
    cb: (d: { count: number; scannedAt: number }) => void,
  ): () => void;
}

export type {
  AppInfo,
  Batch,
  NamingRule,
  PlannedOp,
  ScanProgress,
  ScanResult,
  Settings,
  Suggestion,
};
