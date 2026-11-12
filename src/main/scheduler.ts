import { BrowserWindow, Notification } from "electron";
import { computeNextRun } from "../shared/schedule";
import type { ScanResult } from "../shared/types";
import { isScanInProgress, runScan } from "./scanService";
import { store } from "./store";

let timer: NodeJS.Timeout | null = null;
/** True while runScheduledScan() is executing — prevents re-entrant fires. */
let firing = false;

export function startScheduler(): void {
  store.ensureNextRun();
  if (timer) return;
  timer = setInterval(() => {
    void check();
  }, 30000);
  setTimeout(() => {
    void check();
  }, 8000);
}

export async function check(): Promise<void> {
  const s = store.getSettings();
  if (!s.scheduler.enabled || !s.scheduler.nextRunAt) return;
  if (Date.now() < s.scheduler.nextRunAt) return;
  // Don't fire while a scan is already running (manual or scheduled).
  if (isScanInProgress()) return;
  if (firing) return;
  await runScheduledScan();
}

export async function runScheduledScan(): Promise<ScanResult | null> {
  if (firing) return null;
  firing = true;
  try {
    const s = store.getSettings();
    const result = await runScan(s.folders);
    store.saveScan(result);
    store.updateSettings({
      scheduler: {
        ...s.scheduler,
        lastRunAt: Date.now(),
        nextRunAt: computeNextRun(s.scheduler.dayOfMonth, s.scheduler.time),
      },
    });
    if (Notification.isSupported()) {
      new Notification({
        title: "FileFlex monthly scan finished",
        body: `${result.suggestions.length} suggestions found across ${result.folders.length} folder(s). Review them — nothing changes until you approve.`,
      }).show();
    }
    for (const w of BrowserWindow.getAllWindows()) {
      w.webContents.send("scheduler:fired", {
        count: result.suggestions.length,
        scannedAt: result.scannedAt,
      });
    }
    return result;
  } finally {
    firing = false;
  }
}