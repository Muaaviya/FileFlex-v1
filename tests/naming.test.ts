import { describe, expect, it } from "vitest";
import {
  composeName,
  diffStrings,
  fillIndex,
  splitPath,
} from "../src/shared/naming";
import { extractSignals, withMtimeFallback } from "../src/shared/signals";

const sig = (base: string) =>
  withMtimeFallback(
    extractSignals(base),
    new Date("2026-09-08T10:00:00").getTime(),
  );

describe("composeName", () => {
  it("builds a snake_case name from tokens", () => {
    const name = composeName(
      "{type}_{topic}_{date}{ext}",
      sig("receipt_starbucks_20240312"),
      "snake",
      ".pdf",
    );
    expect(name).toBe("receipt_starbucks_2024-03-12.pdf");
  });

  it("drops empty tokens and collapses separators", () => {
    const name = composeName(
      "{date}_{type}_{topic}{ext}",
      sig("scan0001"),
      "snake",
      ".pdf",
    );
    expect(name).toBe("2026-09-08_scan.pdf");
  });

  it("kebab-cases topics", () => {
    const name = composeName(
      "{date}_{type}_{topic}{ext}",
      sig("Screenshot 2024-02-11 at 10.22.31 AM"),
      "kebab",
      ".png",
    );
    expect(name).toBe("2024-02-11_screenshot.png");
  });

  it("keeps course codes", () => {
    const name = composeName(
      "{course}_{type}_{topic}{ext}",
      sig("BIO101_syllabus_spring"),
      "snake",
      ".pdf",
    );
    expect(name).toBe("BIO101_syllabus_spring.pdf");
  });

  it("appends the extension if the pattern lacks {ext}", () => {
    const name = composeName(
      "{date}_{type}",
      sig("IMG_20240103_123445"),
      "kebab",
      ".jpg",
    );
    expect(name).toBe("2024-01-03_photo.jpg");
  });

  it("sanitizes forbidden filename characters", () => {
    const name = composeName(
      "{topic}{ext}",
      sig("invoice: acme?"),
      "snake",
      ".pdf",
    );
    expect(name).not.toMatch(/[:?]/);
  });
});

describe("fillIndex", () => {
  it("pads the index token", () => {
    expect(fillIndex("scan_2026-09-08_{index}.pdf", 3)).toBe(
      "scan_2026-09-08_03.pdf",
    );
  });
});

describe("splitPath", () => {
  it("handles windows paths", () => {
    expect(splitPath("C:\\Users\\me\\a b.txt")).toEqual({
      dir: "C:\\Users\\me",
      name: "a b.txt",
    });
  });
});

describe("diffStrings", () => {
  it("finds the changed middle", () => {
    const d = diffStrings("report draft.docx", "report_draft.docx");
    // only the separator changes; 'draft.docx' is the shared suffix
    expect(d.pre).toBe("report");
    expect(d.midA).toBe(" ");
    expect(d.midB).toBe("_");
    expect(d.post).toBe("draft.docx");
  });
});
