import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { randomUUID } from "node:crypto";
import type { Batch, PlannedOp, Settings } from "../shared/types";
import { applyOps, undoOps } from "./applier";
import { buildSampleData } from "./fixtures";
import { runScan } from "./scanService";
import { runScheduledScan } from "./scheduler";
import { DEFAULT_RULES, store } from "./store";

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle("app:info", () => ({
    version: app.getVersion(),
    dataDir: store.dataDir,
    platform: process.platform,
  }));

  ipcMain.handle("dialog:pick-folders", async () => {
    const win = getWindow();
    if (!win) return [];
    const res = await dialog.showOpenDialog(win, {
      properties: ["openDirectory", "multiSelections"],
      title: "Choose folders to scan",
    });
    return res.canceled ? [] : res.filePaths;
  });

  ipcMain.handle("settings:get", () => store.getSettings());

  ipcMain.handle("settings:update", (_e, patch: Partial<Settings>) => {
    const next = store.updateSettings(patch);
    if (
      patch.scheduler &&
      typeof patch.scheduler.launchAtStartup === "boolean"
    ) {
      app.setLoginItemSettings({
        openAsHidden: true,
        openAtLogin: patch.scheduler.launchAtStartup,
      });
    }
    return next;
  });

  ipcMain.handle("rules:get", () => store.getRules());

  ipcMain.handle("rules:save", (_e, rules) => store.saveRules(rules));

  ipcMain.handle("rules:reset", () => store.saveRules(DEFAULT_RULES));

  ipcMain.handle("scan:start", async (e) => {
    const s = store.getSettings();
    if (!s.folders.length) throw new Error("No folders selected");
    const result = await runScan(s.folders, (p) => {
      if (!e.sender.isDestroyed()) e.sender.send("scan:progress", p);
    });
    store.saveScan(result);
    return result;
  });

  ipcMain.handle("scan:latest", () => store.getLatestScan());

  ipcMain.handle("scan:run-now", async (e) => {
    const s = store.getSettings();
    if (!s.folders.length) throw new Error("No folders selected");
    const result = await runScan(s.folders, (p) => {
      if (!e.sender.isDestroyed()) e.sender.send("scan:progress", p);
    });
    store.saveScan(result);
    store.updateSettings({
      scheduler: { ...s.scheduler, lastRunAt: Date.now() },
    });
    return result;
  });

  ipcMain.handle("scan:dry-run", async (e, folders: string[]) => {
    const s = store.getSettings();
    const result = await runScan(folders, (p) => {
      if (!e.sender.isDestroyed()) e.sender.send("scan:progress", p);
    });
    return result;
  });

  ipcMain.handle(
    "apply:batch",
    (_e, req: { label: string; ops: PlannedOp[] }) => {
      const ops = applyOps(req.ops);
      const batch: Batch = {
        id: randomUUID(),
        label: req.label || `Applied ${ops.length} changes`,
        appliedAt: Date.now(),
        status: "applied",
        ops,
      };
      store.saveBatch(batch);
      return batch;
    },
  );

  ipcMain.handle("history:list", () => store.getHistory());

  ipcMain.handle("history:undo", (_e, batchId: string) => {
    const batch = store.getHistory().find((b) => b.id === batchId);
    if (!batch) throw new Error("Batch not found");
    const undone = undoOps(batch);
    store.updateBatch(undone);
    return undone;
  });

  ipcMain.handle("history:clear", () => store.clearHistory());

  ipcMain.handle("scheduler:run-now", async () => runScheduledScan());

  ipcMain.handle("sample:prepare", () => buildSampleData());

  ipcMain.handle("data:open-folder", () => {
    void shell.openPath(store.dataDir);
  });
}
