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

/** Result of applyOps: the op log plus the derived batch status. */
export interface ApplyResult {
  ops: BatchOp[];
  status: Batch["status"];
}

/**
 * Applies planned ops in order. **Transactional**: if any op fails, every
 * already-applied op is rolled back (last-op first) so the filesystem is
 * left exactly as it was. Returns the op log and a status:
 * - "applied"  : all ops succeeded
 * - "failed"   : at least one op failed; everything was rolled back
 */
export function applyOps(ops: PlannedOp[]): ApplyResult {
  const results: BatchOp[] = [];
  /** Ops that were applied and may need rolling back. */
  const applied: BatchOp[] = [];
  let failed = false;
  for (const op of ops) {
    try {
      if (!exists(op.from)) throw new Error("Source file no longer exists");
      fs.mkdirSync(path.dirname(op.to), { recursive: true });
      const target = uniqueTarget(op.to, op.from);
      moveFile(op.from, target);
      const r: BatchOp = {
        kind: op.kind,
        from: op.from,
        to: target,
        status: "ok",
      };
      results.push(r);
      applied.push(r);
    } catch (e) {
      results.push({
        kind: op.kind,
        from: op.from,
        to: op.to,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
      failed = true;
    }
  }
  if (failed) {
    // Roll back everything applied so far, last-op first.
    for (const r of [...applied].reverse()) {
      try {
        if (!exists(r.to)) {
          r.status = "error";
          r.error = "Applied file is missing; cannot roll back";
          continue;
        }
        fs.mkdirSync(path.dirname(r.from), { recursive: true });
        const back = uniqueTarget(r.from, r.to);
        moveFile(r.to, back);
        r.status = "undone";
      } catch (e) {
        r.status = "error";
        r.error = `Rollback failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    // After full rollback, no ops remain "ok" → status is "failed".
    return { ops: results, status: "failed" };
  }
  return { ops: results, status: "applied" };
}

/**
 * Reverses a batch: moves every successfully applied op back, last-op first.
 * Idempotent — ops that are already `undone` or `error` are skipped.
 */
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
  batch.status = batchStatusFromOps(batch.ops);
  if (batch.status === "undone") batch.undoneAt = Date.now();
  return batch;
}

/** Derives the batch status string from its ops. Used by undoOps. */
export function batchStatusFromOps(ops: BatchOp[]): Batch["status"] {
  const anyOk = ops.some((o) => o.status === "ok");
  const anyUndone = ops.some((o) => o.status === "undone");
  // anyUndone && anyOk → partial; anyUndone && !anyOk → undone;
  // !anyUndone && anyOk → applied; !anyUndone && !anyOk → failed (all error).
  return anyUndone
    ? anyOk
      ? "partial"
      : "undone"
    : anyOk
      ? "applied"
      : "failed";
}