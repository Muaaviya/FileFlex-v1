import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PDF = (title: string): Buffer =>
  Buffer.from(
    `%PDF-1.4\n% FileFlex sample document: ${title}\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n`,
    "utf8",
  );

const JPG = (seed: number): Buffer => {
  const head = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
  ]);
  const body = Buffer.alloc(900 + seed * 137);
  for (let i = 0; i < body.length; i++) body[i] = (i * seed + 7) % 251;
  return Buffer.concat([head, body, Buffer.from([0xff, 0xd9])]);
};

const PNG = (seed: number): Buffer => {
  const head = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const body = Buffer.alloc(600 + seed * 91);
  for (let i = 0; i < body.length; i++) body[i] = (i * seed + 3) % 241;
  return Buffer.concat([head, body]);
};

const OFFICE = (label: string, seed: number): Buffer => {
  const head = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const body = Buffer.from(
    `fileflex sample ${label} #${seed} `.repeat(40 + seed * 8),
    "utf8",
  );
  return Buffer.concat([head, body]);
};

const TXT = (label: string): Buffer =>
  Buffer.from(
    `${label}\n\nSample notes created by FileFlex for the demo scan.\n`,
    "utf8",
  );

/**
 * Creates a realistic messy folder in the OS temp dir: exact duplicates, near duplicates,
 * scanner output, camera photos, course files and scattered drafts.
 */
export function buildSampleData(): string {
  const root = path.join(os.tmpdir(), `fileflex-sample-${Date.now()}`);
  fs.mkdirSync(path.join(root, "Old"), { recursive: true });
  fs.mkdirSync(path.join(root, "photos"), { recursive: true });

  const put = (rel: string, buf: Buffer): void => {
    fs.writeFileSync(path.join(root, rel), buf);
  };

  const jpgA = JPG(1);
  const pdfAcme = PDF("invoice acme march");
  const docxDraft = OFFICE("report draft", 1);
  const xlsxBudget = OFFICE("budget 2024", 2);

  put("IMG_20240103_123445.jpg", jpgA);
  put("IMG_20240103_123445 (2).jpg", jpgA); // exact duplicate
  put("IMG_20240211_093012.jpg", JPG(2));
  put("Screenshot 2024-02-11 at 10.22.31 AM.png", PNG(1));
  put("screenshot 2-11 final.png", PNG(2));
  put("invoice_acme_march.pdf", pdfAcme);
  put("Invoice Acme April.pdf", PDF("invoice acme april"));
  put("invoice_acme_march (copy).pdf", pdfAcme); // exact duplicate
  put("receipt_starbucks_20240312.pdf", PDF("receipt starbucks"));
  put("scan0001.pdf", PDF("scan 1"));
  put("scan0002.pdf", PDF("scan 2"));
  put("scan0003.pdf", PDF("scan 3"));
  put("report draft.docx", docxDraft);
  put("report draft (copy).docx", docxDraft); // exact duplicate
  put("report final.docx", OFFICE("report final", 3));
  put("report.pdf", PDF("report")); // merges with the report drafts into Report/
  put("report notes.txt", TXT("Report notes"));
  put("BIO101_syllabus_spring.pdf", PDF("bio101 syllabus"));
  put("bio101 notes week 1.txt", TXT("Bio101 week 1 notes"));
  put("BIO101-homework-1.docx", OFFICE("bio101 homework", 4));
  put("resume_v3 (final).pdf", PDF("resume v3"));
  put("resume_old.pdf", PDF("resume old"));
  put("budget 2024.xlsx", xlsxBudget);
  put("budget 2024 (1).xlsx", xlsxBudget); // exact duplicate
  put("Old/meeting minutes 03-2024.docx", OFFICE("minutes march", 5));
  put("Old/meeting-minutes-april-2024.docx", OFFICE("minutes april", 6));
  put("photos/IMG_20240315_221100.jpg", JPG(3));

  return root;
}
