import fs from "node:fs";
import path from "node:path";
import type { Batch, BatchOp, PlannedOp } from "../shared/types";

function exists(p: string): boolean {
  try {
    fs.statSync(p);
    return true;
  } catch {
    return false;
  }
}

/** Picks a free target, appending " (2)" style suffixes on collisions (case-insensitive on Windows). */
function uniqueTarget(to: string, from: string): string {
  if (to.toLowerCase() === from.toLowerCase()) return to;
  if (!exists(to)) return to;
  const dir = path.dirname(to);
  const ext = path.extname(to);
  const base = path.basename(to, ext);
  for (let i = 2; i < 1000; i++) {
    const cand = path.join(dir, `${base} (${i})${ext}`);
    if (!exists(cand)) return cand;
  }
  throw new Error("Could not find a free target name");
}

function moveFile(from: string, to: string): void {
  try {
    fs.renameSync(from, to);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "EXDEV") {
      fs.copyFileSync(from, to);
      fs.unlinkSync(from);
    } else {
      throw e;
    }
  }
}

/** Applies planned ops in order. Every op is a rename/move — nothing is ever deleted. */
export function applyOps(ops: PlannedOp[]): BatchOp[] {
  const results: BatchOp[] = [];
  for (const op of ops) {
    try {
      if (!exists(op.from)) throw new Error("Source file no longer exists");
      fs.mkdirSync(path.dirname(op.to), { recursive: true });
      const target = uniqueTarget(op.to, op.from);
      moveFile(op.from, target);
      results.push({ kind: op.kind, from: op.from, to: target, status: "ok" });
    } catch (e) {
      results.push({
        kind: op.kind,
        from: op.from,
        to: op.to,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}

/** Reverses a batch: moves every successfully applied op back, last-op first. */
export function undoOps(batch: Batch): Batch {
  const ops = [...batch.ops].reverse();
  for (const op of ops) {
    if (op.status !== "ok") continue;
    try {
      if (!exists(op.to)) {
        op.status = "error";
        op.error = "Applied file is missing; cannot undo";
        continue;
      }
      fs.mkdirSync(path.dirname(op.from), { recursive: true });
      const back = uniqueTarget(op.from, op.to);
      moveFile(op.to, back);
      op.status = "undone";
    } catch (e) {
      op.status = "error";
      op.error = `Undo failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  const anyOk = batch.ops.some((o) => o.status === "ok");
  const anyUndone = batch.ops.some((o) => o.status === "undone");
  batch.status = !anyOk ? "undone" : anyUndone ? "partial" : "applied";
  if (batch.status === "undone") batch.undoneAt = Date.now();
  return batch;
}
