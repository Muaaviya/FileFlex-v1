import { describe, expect, it } from "vitest";
import {
  extractSignals,
  findDateInName,
  normalizeName,
  withMtimeFallback,
} from "../src/shared/signals";

describe("findDateInName", () => {
  it("parses ISO dates", () => {
    expect(findDateInName("report 2024-03-12 draft")?.date.iso).toBe(
      "2024-03-12",
    );
  });
  it("parses compact dates", () => {
    expect(findDateInName("IMG_20240103_123445")?.date.iso).toBe("2024-01-03");
  });
  it("parses M-D-Y dates", () => {
    expect(findDateInName("notes 3-12-2024")?.date.iso).toBe("2024-03-12");
  });
  it("rejects impossible dates", () => {
    expect(findDateInName("file 2024-13-45")).toBeNull();
  });
  it("rejects bare years", () => {
    expect(findDateInName("budget 2024")).toBeNull();
  });
});

describe("extractSignals", () => {
  it("detects type and date", () => {
    const sig = extractSignals("receipt_starbucks_20240312");
    expect(sig.docType).toBe("receipt");
    expect(sig.date?.iso).toBe("2024-03-12");
    expect(sig.topic).toContain("starbucks");
    expect(sig.tags).toContain("2024-03");
  });

  it("detects course codes", () => {
    const sig = extractSignals("BIO101_syllabus_spring");
    expect(sig.course).toBe("BIO101");
    expect(sig.docType).toBe("syllabus");
    expect(sig.topic).toContain("spring");
  });

  it("flags cleanup markers as noise", () => {
    const sig = extractSignals("report draft (copy)");
    expect(sig.noisy).toBe(true);
    expect(sig.docType).toBe("report");
    // the type word is carried by {type}, so the topic is what remains
    expect(sig.topic).toBe("");
  });

  it("classifies camera photos", () => {
    const sig = extractSignals("IMG_20240103_123445");
    expect(sig.docType).toBe("photo");
    expect(sig.date?.iso).toBe("2024-01-03");
  });

  it("falls back to mtime date", () => {
    const sig = withMtimeFallback(
      extractSignals("acme contract"),
      new Date("2026-02-03T08:00:00").getTime(),
    );
    expect(sig.date?.iso).toBe("2026-02-03");
  });
});

describe("normalizeName", () => {
  it("strips copy/version noise and casing", () => {
    expect(normalizeName("Report Draft (copy)")).toBe(
      normalizeName("report draft"),
    );
    expect(normalizeName("resume_v3 (final)")).toBe("resume");
    expect(normalizeName("IMG_20240103_123445 (2)")).toBe("img");
  });
  it("keeps genuinely different names apart", () => {
    expect(normalizeName("meeting minutes march")).not.toBe(
      normalizeName("meeting minutes april"),
    );
  });
});
