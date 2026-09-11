export interface ParsedDate {
  iso: string;
  year: number;
  month: number;
  day: number;
}

export interface DateMatch {
  date: ParsedDate;
  matched: string;
}

export interface NameSignals {
  date?: ParsedDate;
  dateFromName: boolean;
  course?: string;
  docType?: string;
  topic: string;
  tokens: string[];
  tags: string[];
  noisy: boolean;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function validDate(y: number, m: number, d: number): ParsedDate | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (y < 1990 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return { iso: `${y}-${pad(m)}-${pad(d)}`, year: y, month: m, day: d };
}

/** Finds an explicit date in the filename (ISO, M-D-Y, compact forms). */
export function findDateInName(base: string): DateMatch | null {
  const patterns: RegExp[] = [
    /(?:^|[^\d])(\d{4})[-_.](\d{1,2})[-_.](\d{1,2})(?:[^\d]|$)/,
    /(?:^|[^\d])(\d{1,2})[-_.](\d{1,2})[-_.](\d{4})(?:[^\d]|$)/,
    /(?:^|[^\d])(\d{4})(\d{2})(\d{2})(?:[^\d]|$)/,
  ];
  for (const re of patterns) {
    const m = base.match(re);
    if (!m) continue;
    const candidates: Array<[number, number, number, string]> = [
      [+m[1], +m[2], +m[3], m[0]],
      [+m[3], +m[1], +m[2], m[0]],
    ];
    for (const [y, mo, d, raw] of candidates) {
      const date = validDate(y, mo, d);
      if (date) {
        const matched = raw.replace(/^[^\d]+|[^\d]+$/g, "");
        return { date, matched };
      }
    }
  }
  return null;
}

// "_" is a word character, so \b fails inside snake_case names — use explicit
// alnum lookarounds instead of \b everywhere.
const B = "(?<![a-z0-9])";
const E = "(?![a-z0-9])";
const rx = (body: string, flags = "i"): RegExp => new RegExp(body, flags);

const DOC_TYPES: Array<[string, RegExp]> = [
  ["screenshot", rx(`screen[\\s_-]?shot|${B}screenshot${E}`)],
  ["photo", /^(img|dsc|dscn|pxl|photo|picture)[\s_-]*(\d|$)/i],
  ["invoice", rx(`${B}invoices?${E}|${B}inv[\\s_-]?\\d`)],
  ["receipt", rx(`${B}receipts?${E}`)],
  ["resume", rx(`${B}resume${E}|${B}cv${E}`)],
  ["cover letter", /cover[\s_-]?letter/i],
  ["syllabus", /syllabus/i],
  ["transcript", /transcript/i],
  ["homework", rx(`${B}homework${E}|${B}hw[\\s_-]?\\d|${B}assignment${E}`)],
  ["notes", rx(`${B}notes?${E}`)],
  ["report", rx(`${B}report${E}`)],
  ["contract", rx(`${B}(contract|agreement|lease)${E}`)],
  ["statement", rx(`${B}statement${E}`)],
  ["budget", rx(`${B}budget${E}`)],
  ["scan", rx(`^scan[\\s_-]*\\d*|${B}scan${E}`)],
  ["minutes", rx(`${B}minutes${E}`)],
  ["agenda", rx(`${B}agenda${E}`)],
  ["proposal", rx(`${B}proposal${E}`)],
  ["essay", rx(`${B}(essay|thesis|paper)${E}`)],
  ["exam", rx(`${B}(exam|quiz)${E}`)],
  ["presentation", rx(`${B}presentation${E}|${B}slides?${E}`)],
  ["document", /^(doc|document|untitled|file)[\s_-]*\d*/i],
];

const NOISE_TOKENS = new Set([
  "copy",
  "copies",
  "final",
  "draft",
  "old",
  "new",
  "newest",
  "latest",
  "backup",
  "bak",
  "original",
  "temp",
  "tmp",
  "untitled",
  "version",
  "ver",
  "edited",
  "updated",
  "the",
  "and",
  "at",
  "am",
  "pm",
]);

const NOISE_RE = rx(
  `${B}(copy|copies|final|draft|old|new|newest|latest|backup|bak|original|temp|tmp|untitled|version|ver|v\\d+|edited|updated)${E}`,
  "gi",
);
const TRAILING_RE = rx(
  `[\\s_-]*(\\(\\s*(?:\\d+|copy(?:\\s*\\d+)?|final(?:\\s*\\d+)?|v\\d+(?:\\.\\d+)?|new|old|backup)\\s*\\)|\\[\\s*\\d+\\s*\\]|copy(?:\\s*\\d+)?|final(?:\\s*\\d+)?|v\\d+(?:\\.\\d+)?)$`,
  "gi",
);
// Course codes are conventionally uppercase (BIO101, MATH2401) — case-sensitive
// so lowercase words like "scan0001" don't get mistaken for one.
const COURSE_RE = /(?<![A-Z])([A-Z]{2,4})[\s_-]?(\d{3,4})(?![A-Z0-9])/;

/** Extracts naming signals from a file basename (without extension). */
export function extractSignals(base: string): NameSignals {
  let work = base;

  const dm = findDateInName(work);
  let date: ParsedDate | undefined;
  if (dm) {
    date = dm.date;
    work = work.replace(dm.matched, " ");
  }

  const cm = work.match(COURSE_RE);
  let course: string | undefined;
  if (cm && cm[1].toLowerCase() !== "the") {
    course = (cm[1] + cm[2]).toUpperCase();
    work = work.replace(cm[0], " ");
  }

  let docType: string | undefined;
  for (const [type, re] of DOC_TYPES) {
    const m = work.match(re);
    if (m) {
      docType = type;
      work = work.replace(m[0], " ");
      break;
    }
  }

  const noisy = NOISE_RE.test(base);
  NOISE_RE.lastIndex = 0;
  work = work.replace(NOISE_RE, " ").replace(TRAILING_RE, " ");

  const tokens = work
    .split(/[^A-Za-z0-9]+/)
    .filter(
      (t) =>
        t.length >= 2 && !/^\d+$/.test(t) && !NOISE_TOKENS.has(t.toLowerCase()),
    )
    .filter((t, i, arr) => arr.indexOf(t) === i);

  const topic = tokens.join(" ").trim();
  const tags = [
    docType,
    course,
    date ? date.iso.slice(0, 7) : undefined,
  ].filter((t): t is string => !!t);

  return {
    date,
    dateFromName: !!dm,
    course,
    docType,
    topic,
    tokens,
    tags,
    noisy,
  };
}

export function withMtimeFallback(
  sig: NameSignals,
  mtimeMs: number,
): NameSignals {
  if (sig.date) return sig;
  const d = new Date(mtimeMs);
  return {
    ...sig,
    date: {
      iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
    },
  };
}

/** Normalizes a basename for duplicate / merge grouping: strips noise, casing, separators, trailing counters. */
export function normalizeName(base: string): string {
  let s = base.toLowerCase();
  s = s.replace(TRAILING_RE, "");
  s = s.replace(NOISE_RE, " ");
  const tokens = s
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !NOISE_TOKENS.has(t) && !/^\d+$/.test(t));
  return tokens.join(" ").trim();
}
