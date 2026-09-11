import type { Category } from "./types";

const EXT_MAP: Record<string, Category> = {};
function assign(cat: Category, exts: string[]): void {
  for (const e of exts) EXT_MAP[e] = cat;
}

assign("pdfs", ["pdf"]);
assign("documents", [
  "doc",
  "docx",
  "txt",
  "md",
  "rtf",
  "odt",
  "pages",
  "tex",
  "log",
]);
assign("spreadsheets", ["xls", "xlsx", "csv", "tsv", "ods", "numbers"]);
assign("presentations", ["ppt", "pptx", "key", "odp"]);
assign("images", [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "heic",
  "bmp",
  "tiff",
  "svg",
  "avif",
]);
assign("archives", ["zip", "7z", "rar", "tar", "gz", "bz2", "xz", "iso"]);
assign("media", [
  "mp4",
  "mov",
  "avi",
  "mkv",
  "webm",
  "mp3",
  "wav",
  "m4a",
  "flac",
  "aac",
  "ogg",
]);
assign("code", [
  "js",
  "ts",
  "tsx",
  "jsx",
  "py",
  "java",
  "c",
  "cpp",
  "h",
  "cs",
  "go",
  "rs",
  "rb",
  "php",
  "html",
  "css",
  "json",
  "xml",
  "yml",
  "yaml",
  "sh",
  "bat",
  "sql",
]);
assign("design", [
  "fig",
  "psd",
  "ai",
  "xd",
  "sketch",
  "indd",
  "afdesign",
  "afphoto",
]);

export function categoryFor(ext: string): Category {
  return EXT_MAP[ext.toLowerCase().replace(/^\./, "")] ?? "other";
}

export const CATEGORY_LABELS: Record<Category, string> = {
  documents: "Documents",
  spreadsheets: "Spreadsheets",
  presentations: "Presentations",
  pdfs: "PDFs",
  images: "Images",
  archives: "Archives",
  media: "Media",
  code: "Code",
  design: "Design",
  other: "Other",
};

export const CATEGORY_FOLDERS: Record<Category, string> = {
  documents: "Documents",
  spreadsheets: "Spreadsheets",
  presentations: "Presentations",
  pdfs: "PDFs",
  images: "Images",
  archives: "Archives",
  media: "Media",
  code: "Code",
  design: "Design",
  other: "Other",
};

export const ALL_CATEGORIES: Category[] = [
  "pdfs",
  "documents",
  "spreadsheets",
  "presentations",
  "images",
  "media",
  "archives",
  "code",
  "design",
  "other",
];
