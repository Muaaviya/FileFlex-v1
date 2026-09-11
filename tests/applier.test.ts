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
import { applyOps, undoOps } from "../src/main/applier";
import type { Batch } from "../src/shared/types";

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

    const ops = applyOps([{ kind: "rename", from, to }]);
    expect(ops[0].status).toBe("ok");
    expect(existsSync(to)).toBe(true);
    expect(existsSync(from)).toBe(false);

    const batch: Batch = {
      id: "b1",
      label: "test",
      appliedAt: 0,
      status: "applied",
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

    const ops = applyOps([{ kind: "move", from, to }]);
    expect(ops[0].status).toBe("ok");
    expect(existsSync(to)).toBe(true);

    const undone = undoOps({
      id: "b2",
      label: "t",
      appliedAt: 0,
      status: "applied",
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

    const ops = applyOps([{ kind: "rename", from, to }]);
    expect(ops[0].status).toBe("ok");
    expect(ops[0].to).toBe(path.join(root, "doc (2).txt"));
    expect(readFileSync(ops[0].to, "utf-8")).toBe("moving in");

    const undone = undoOps({
      id: "b3",
      label: "t",
      appliedAt: 0,
      status: "applied",
      ops,
    });
    expect(undone.status).toBe("undone");
    expect(existsSync(from)).toBe(true);
  });

  it("reports missing sources as errors without touching the rest", () => {
    const root = tmp();
    const good = path.join(root, "good.txt");
    writeFileSync(good, "x");
    const ops = applyOps([
      {
        kind: "rename",
        from: path.join(root, "missing.txt"),
        to: path.join(root, "whatever.txt"),
      },
      { kind: "rename", from: good, to: path.join(root, "good2.txt") },
    ]);
    expect(ops[0].status).toBe("error");
    expect(ops[1].status).toBe("ok");
    expect(existsSync(path.join(root, "good2.txt"))).toBe(true);
  });
});
