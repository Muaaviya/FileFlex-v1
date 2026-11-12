import {
  mkdtempSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { applyOps, undoOps, batchStatusFromOps } from "../src/main/applier";
import type { Batch, BatchOp } from "../src/shared/types";

let dir: string;
const tmp = (): string => {
  if (!dir) dir = mkdtempSync(path.join(tmpdir(), "fileflex-test-"));
  return dir;
};

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("applyOps + undoOps", () => {
  it("renames a file and rolls it back", () => {
    const root = tmp();
    const from = path.join(root, "messy name.txt");
    writeFileSync(from, "hello");
    const to = path.join(root, "messy_name.txt");

    const { ops, status } = applyOps([{ kind: "rename", from, to }]);
    expect(ops[0].status).toBe("ok");
    expect(status).toBe("applied");
    expect(existsSync(to)).toBe(true);
    expect(existsSync(from)).toBe(false);

    const batch: Batch = {
      id: "b1",
      label: "test",
      appliedAt: 0,
      status,
      ops,
    };
    const undone = undoOps(batch);
    expect(undone.status).toBe("undone");
    expect(existsSync(from)).toBe(true);
    expect(existsSync(to)).toBe(false);
  });

  it("moves a file into a new folder and rolls back, recreating the source dir", () => {
    const root = tmp();
    const from = path.join(root, "sub", "report.txt");
    mkdirSync(path.join(root, "sub"), { recursive: true });
    writeFileSync(from, "data");
    const to = path.join(root, "Report", "report.txt");

    const { ops, status } = applyOps([{ kind: "move", from, to }]);
    expect(ops[0].status).toBe("ok");
    expect(status).toBe("applied");
    expect(existsSync(to)).toBe(true);

    const undone = undoOps({
      id: "b2",
      label: "t",
      appliedAt: 0,
      status,
      ops,
    });
    expect(undone.status).toBe("undone");
    expect(existsSync(from)).toBe(true);
  });

  it("auto-suffixes on target collision and undoes to the actual target", () => {
    const root = tmp();
    writeFileSync(path.join(root, "doc.txt"), "existing target");
    const from = path.join(root, "doc (1).txt");
    writeFileSync(from, "moving in");
    const to = path.join(root, "doc.txt");

    const { ops, status } = applyOps([{ kind: "rename", from, to }]);
    expect(ops[0].status).toBe("ok");
    expect(ops[0].to).toBe(path.join(root, "doc (2).txt"));
    expect(readFileSync(ops[0].to, "utf-8")).toBe("moving in");

    const undone = undoOps({
      id: "b3",
      label: "t",
      appliedAt: 0,
      status,
      ops,
    });
    expect(undone.status).toBe("undone");
    expect(existsSync(from)).toBe(true);
  });

  it("is fail-fast per op, and rolls back earlier ops when a later op fails", () => {
    const root = tmp();
    const good = path.join(root, "good.txt");
    writeFileSync(good, "x");
    const { ops, status } = applyOps([
      {
        kind: "rename",
        from: path.join(root, "missing.txt"),
        to: path.join(root, "whatever.txt"),
      },
      { kind: "rename", from: good, to: path.join(root, "good2.txt") },
    ]);
    expect(ops[0].status).toBe("error");
    // good.txt → good2.txt was rolled back because op 0 failed
    expect(ops[1].status).toBe("undone");
    expect(status).toBe("failed");
    expect(existsSync(path.join(root, "good2.txt"))).toBe(false);
  });

  it("is transactional: rolls back earlier ops when a later op fails", () => {
    const root = tmp();
    const good1 = path.join(root, "good1.txt");
    const good2 = path.join(root, "good2.txt");
    writeFileSync(good1, "a");
    writeFileSync(good2, "b");
    const { ops, status } = applyOps([
      { kind: "rename", from: good1, to: path.join(root, "renamed1.txt") },
      { kind: "rename", from: good2, to: path.join(root, "renamed2.txt") },
      { kind: "rename", from: path.join(root, "missing.txt"), to: path.join(root, "whatever.txt") },
    ]);
    expect(ops[0].status).toBe("undone");
    expect(ops[1].status).toBe("undone");
    expect(ops[2].status).toBe("error");
    expect(status).toBe("failed");
    // Original files should be back after rollback
    expect(existsSync(good1)).toBe(true);
    expect(existsSync(good2)).toBe(true);
    // Renamed files were rolled back, so they don't exist
    expect(existsSync(path.join(root, "renamed1.txt"))).toBe(false);
    expect(existsSync(path.join(root, "renamed2.txt"))).toBe(false);
  });

  it("batchStatusFromOps returns correct status for all-op combos", () => {
    const ok: BatchOp = { kind: "rename", from: "a", to: "b", status: "ok" };
    const err: BatchOp = { kind: "rename", from: "a", to: "b", status: "error", error: "e" };
    const undone: BatchOp = { kind: "rename", from: "a", to: "b", status: "undone" };

    expect(batchStatusFromOps([])).toBe("failed");
    expect(batchStatusFromOps([ok])).toBe("applied");
    expect(batchStatusFromOps([err])).toBe("failed");
    expect(batchStatusFromOps([undone])).toBe("undone");
    expect(batchStatusFromOps([ok, ok])).toBe("applied");
    expect(batchStatusFromOps([ok, err])).toBe("applied");
    expect(batchStatusFromOps([ok, undone])).toBe("partial");
    expect(batchStatusFromOps([err, undone])).toBe("undone");
    expect(batchStatusFromOps([ok, ok, err])).toBe("applied");
    expect(batchStatusFromOps([ok, err, undone])).toBe("partial");
    expect(batchStatusFromOps([ok, ok, undone])).toBe("partial");
  });
});
