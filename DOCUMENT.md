# FileFlex — Project Documentation

> **FileFlex** (formerly TidyDesk) is a local-first desktop app for Windows, built with Electron + React + TypeScript. It scans messy folders, proposes standardized file names, detects exact and near duplicates, and suggests safe merges and folder structure — **nothing changes on disk until you approve**, and every applied change can be rolled back.

- **Package name:** `fileflex` (v0.1.0)
- **Description (package.json):** "Local-first folder cleanup: standardized names, duplicate detection, safe merges — nothing changes until you approve."
- **Platform:** Windows-first (tested on Windows 10/11); pure-JS dependencies only — no native modules.
- **Privacy:** All analysis is local. The app reads **file names, sizes, and timestamps only** — it never opens document contents and never makes a network call.

---

## Table of Contents

1. [Core Principles](#1-core-principles)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Architecture Overview](#4-architecture-overview)
5. [Main-Process Engines](#5-main-process-engines)
6. [Shared (Pure) Modules](#6-shared-pure-modules)
7. [IPC Reference](#7-ipc-reference)
8. [Data Model](#8-data-model)
9. [Data Persistence](#9-data-persistence)
10. [Renderer](#10-renderer)
11. [Theme Customization System](#11-theme-customization-system)
12. [Design System](#12-design-system)
13. [Naming Rules & Tokens](#13-naming-rules--tokens)
14. [Suggestion Engine Details](#14-suggestion-engine-details)
15. [Development Guide](#15-development-guide)
16. [Testing](#16-testing)
17. [Build & Packaging](#17-build--packaging)
18. [Security Model](#18-security-model)
19. [Behavior Guarantees & Limitations](#19-behavior-guarantees--limitations)

---

## 1. Core Principles

1. **Approve-first.** Nothing is renamed, moved, or merged until the user explicitly approves it in the Review & Approve step. The app is a *proposal* engine, not an automaton.
2. **No hard deletes.** Every operation is a rename or a move. "Duplicate cleanup" means moving extra copies into an internal `_Duplicates/<date>/` archive folder — never deleting them.
3. **Always undoable.** Every applied batch is logged as an ordered list of operations. Undo replays the inverse operations newest-first.
4. **Filename + metadata only.** Signals are extracted from names, extensions, sizes, and mtimes. Document *contents* are never parsed (only checksums are read for duplicate verification).
5. **Local-only.** No telemetry, no analytics, no network access anywhere in the codebase.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Electron 37 |
| Bundler | electron-vite 3 (Vite 6) |
| UI | React 19 + react-router-dom 7 (HashRouter) |
| State | Zustand 5 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`, `@theme` tokens) |
| Language | TypeScript 5.8 (strict, three tsconfigs: node / web / root) |
| Tests | Vitest 3 |
| Packaging | electron-builder 26 (Windows NSIS installer via `npm run dist`) |
| Persistence | Plain JSON files with atomic writes (no database) |

---

## 3. Project Structure

```
tidydesk/
├── electron.vite.config.ts      # electron-vite config (main/preload/renderer)
├── electron-builder.yml         # (packaging config, used by npm run dist)
├── package.json                 # name "fileflex", scripts, deps
├── tsconfig.json / tsconfig.node.json / tsconfig.web.json
├── vitest.config.ts
├── README.md
├── DOCUMENT.md                  # this file
├── tests/                       # Vitest unit tests (pure engine logic)
│   ├── applier.test.ts          # apply/undo, collision suffixing
│   ├── naming.test.ts           # composeName, fillIndex, diffStrings
│   ├── signals.test.ts          # date/type/course/topic extraction
│   └── suggest.test.ts          # suggestion builder behavior
└── src/
    ├── main/                    # Electron main process
    │   ├── index.ts             # app lifecycle, single-instance lock, window
    │   ├── ipc.ts               # all ipcMain.handle channels
    │   ├── store.ts             # JSON store + default settings/rules
    │   ├── scanner.ts           # recursive folder walk with exclusions
    │   ├── duplicates.ts        # exact (SHA-256) + near duplicate grouping
    │   ├── suggest.ts           # suggestion builder (dup/merge/rename/move)
    │   ├── scanService.ts       # orchestrates scan→dups→suggestions→summary
    │   ├── applier.ts           # executes batches, collision-safe, undo
    │   ├── scheduler.ts         # monthly scan timer + system notification
    │   └── fixtures.ts          # "Try with sample data" messy fixture generator
    ├── preload/
    │   └── index.ts             # contextBridge → window.api (typed)
    ├── shared/                  # pure modules used by both processes
    │   ├── types.ts             # all shared TS interfaces
    │   ├── api.ts               # TidyApi contract (preload ↔ renderer)
    │   ├── classifier.ts        # extension → category map, folder names
    │   ├── signals.ts           # filename signal extraction (date/type/course/topic/noise)
    │   ├── naming.ts            # name composition, casing, diff helper
    │   ├── schedule.ts          # next monthly run computation
    │   └── format.ts            # bytes/date formatting helpers
    └── renderer/
        ├── index.html
        └── src/
            ├── main.tsx         # React entry
            ├── App.tsx          # HashRouter + Sidebar + ThemeProvider + routes
            ├── api.ts           # re-exports window.api
            ├── store.ts         # Zustand store (all app state + actions)
            ├── index.css        # Tailwind v4 @theme tokens + base styles
            ├── contexts/
            │   └── ThemeContext.tsx   # theme state + CSS variable engine
            ├── components/
            │   ├── ui.tsx       # Button/Card/Modal/EmptyState/Stat/inputCls/Toasts
            │   └── icons.tsx    # inline SVG icon set
            └── pages/
                ├── ScanSetup.tsx        # /        folder picker, options, sample data
                ├── ScanResults.tsx      # /results summary tiles + category table
                ├── SuggestionsQueue.tsx # /queue   spreadsheet of proposals + bulk bar
                ├── ReviewApprove.tsx    # /review  before/after diff, apply
                ├── HistoryPage.tsx      # /history batch timeline + undo
                ├── RulesPage.tsx        # /rules   naming rule editor + live preview
                └── SettingsPage.tsx     # /settings theme, privacy, exclusions, scheduler
```

---

## 4. Architecture Overview

**Three-process split, strict isolation:**

```
┌────────────── Renderer (React, sandboxed web) ──────────────┐
│  Pages → Zustand store → window.api (TidyApi)               │
│  ThemeContext → CSS variables on document.documentElement    │
└──────────────────────────┬──────────────────────────────────┘
                 contextBridge (src/preload/index.ts)
┌──────────────────────────▼──────────────────────────────────┐
│                     Main process (Node)                     │
│  ipc.ts ── scanService ── scanner ── duplicates ── suggest  │
│           applier (apply/undo)      store (JSON on disk)    │
│           scheduler (setInterval 30s + Notification)        │
└─────────────────────────────────────────────────────────────┘
```

- **Preload** exposes exactly one object, `window.api`, built from `ipcRenderer.invoke` wrappers and two event subscriptions (`scan:progress`, `scheduler:fired`). `contextIsolation: true`, `nodeIntegration: false`.
- **Renderer never touches Node/fs.** All file work happens in main.
- **Long scans stream progress** over the `scan:progress` channel; the renderer only displays it while `scanning` is true.
- **Single-instance:** a second app launch just focuses the existing window (`app.requestSingleInstanceLock`).
- The native application menu is removed (`Menu.setApplicationMenu(null)`); the window is 1280×840 (min 1040×680), title "FileFlex".

---

## 5. Main-Process Engines

### 5.1 Store (`src/main/store.ts`)

Owns all persistence. Data directory: `app.getPath("userData")/data` (on Windows typically `%APPDATA%\FileFlex\data` — Electron derives it from the app name; `AppInfo.dataDir` exposes the exact path in Settings).

Files:
- `settings.json` — user settings (folders, scan options, exclusions, scheduler, theme)
- `rules.json` — naming rules
- `history.json` — applied batches (newest first)
- `scans/latest.json` — most recent scan snapshot (files + suggestions + summary)

Key behaviors:
- **Atomic writes:** every write goes to `<file>.tmp`, then `rename` — with 5 retries × 50 ms back-off to survive Windows file-locking (virus scanners, indexers).
- **Deep-merge patches:** `updateSettings(patch)` merges each top-level section (`scan`, `exclusions`, `scheduler`, `theme`) individually so a partial patch can't wipe other fields. The `theme` patch is merged key-by-key (`s.theme = { ...s.theme, ...patch.theme }`), which is what makes single-color theme edits persist safely.
- **Defaults live in code:** `DEFAULT_SETTINGS` (maxDepth 6, skipHidden true, exclusions `node_modules/.git/desktop.ini/thumbs.db` + `tmp/lnk` extensions, scheduler off, default theme) and `DEFAULT_RULES` (the 5 built-in naming rules listed in §13).
- `ensureNextRun()` seeds `scheduler.nextRunAt` on first launch after enabling.

### 5.2 Scanner (`src/main/scanner.ts`)

`scanFolders(opts, onProgress)` — async recursive walk of each chosen root.

- **Limits:** hard cap `MAX_FILES = 50 000` (sets `truncated: true`); depth limit from settings (default 6).
- **Always skipped:** hidden entries (when `skipHidden`, names starting with `.` or `$`) and `SKIP_DIRS` = `node_modules`, `.git`, `$recycle.bin`, `system volume information`, `$windows.~bt`, `appdata` (case-insensitive).
- **Exclusions:** user patterns are compiled from a glob subset (`*` → within-segment, `**` → across segments, `?` → one char; patterns containing a separator match against the full path, otherwise against the file name; case-insensitive). Excluded extensions are matched without a leading dot.
- Per file it records: `path, dir, name, base, ext, size, mtimeMs, ctimeMs, category` (from the classifier), `scanRoot`, and a stable 12-char id = SHA-1 of the lowercased full path.
- Progress events every 50 files: `{ phase: "scan", files, dir }`.

### 5.3 Duplicates (`src/main/duplicates.ts`)

`findDuplicateGroups(files, onProgress)` returns `DupGroup[]` where `kind` is `"exact"` or `"near"`.

**Exact duplicates — three-stage funnel (avoids checksumming everything):**
1. Group by **size** (zero-byte files ignored).
2. Within a size group, hash the **first 64 KB** of each file (SHA-256) with a concurrency pool of 6; group by sample hash.
3. Only on sample collision, compute the **full-file SHA-256** (pool of 4). Equal full hashes → an `exact` group.

**Near duplicates:** for files not in any exact group — group by `normalizeName(base) + ext` (noise words like `copy/final/old`, trailing `(1)`/`v2` counters, casing, and separators stripped); keep groups with ≥ 2 members whose sizes are within a **3× ratio** of each other → a `near` group.

Progress: `{ phase: "analyze", files: <group n>, dir: "checksum group n/total" }`.

### 5.4 Suggestion Engine (`src/main/suggest.ts`)

`buildSuggestions(files, dupGroups, rules)` — each file is claimed by **at most one** suggestion, evaluated in this priority order: **duplicate → merge → rename → structure move**. Output is sorted by kind (rename, duplicate, merge, move), then confidence desc.

1. **Duplicates** — for each dup group, keep the **newest** copy (mtime desc, path tie-break); every other member gets a `duplicate` suggestion moving it to `scanRoot/_Duplicates/<YYYY-MM-DD>/<relative dir>/<name>`. Confidence: **0.93** exact (reason: "verified by SHA-256 checksum"), **0.62** near. Grouped via `groupId`/`groupLabel`/`keepPath`.
2. **Merges** — files sharing a normalized base (length ≥ 4) across **≥ 2 extensions or ≥ 2 folders** are consolidated into `scanRoot/<Topic Title Case>/`. Confidence: `0.5 + 0.1 (multi-folder) + 0.05 × (n − 2)`, clamped 0.5–0.75.
3. **Renames** — first matching enabled rule (priority asc) wins. A file with zero signals (no date/type/course/topic) is skipped. If the composed name equals the current name (case-insensitive), the rule is a no-op. `{index}` tokens get per-directory 2-padded counters. Confidence formula:
   ```
   0.35 + (date in name ? +0.30 : date from mtime ? −0.05 : 0)
        + (docType ? +0.15) + (course ? +0.10) + (topic ? +0.05) + (noisy ? +0.10)
   → clamped 0.30–0.95
   ```
   The human-readable reason lists which signals matched (and flags mtime-derived dates).
4. **Structure moves** — loose files sitting directly in a scan root, ≥ **8** per category, get a `move` suggestion into `scanRoot/<CategoryFolder>/`. Confidence: `0.5 + 0.01 × n`, clamped ≤ 0.7. Grouped by `groupLabel` ("Organize 12 loose pdfs into PDFs/").

### 5.5 Applier (`src/main/applier.ts`)

- **`applyOps(ops: PlannedOp[]): BatchOp[]`** — sequential transaction: verify source exists → `mkdir -p` target dir → pick a free target (`name (2)`, `(3)`, … up to 999, case-insensitive on Windows) → move. `EXDEV` (cross-drive) falls back to copy + unlink. Failures are recorded per-op (`status: "error"`, `error` message) and don't abort the batch. **Only rename/move — never delete.**
- **`undoOps(batch)`** — replays successful ops in reverse, moving each applied file back to its origin (with the same collision suffixing). Marks each op `undone`, or `error` with "Applied file is missing; cannot undo" if the file vanished. Batch status becomes `undone` / `partial` / stays `applied`, and `undoneAt` is stamped on full undo.

### 5.6 Scheduler (`src/main/scheduler.ts`)

In-app monthly scheduler (no OS task):
- `startScheduler()` seeds the next run and checks every **30 s** (plus once 8 s after launch).
- When due, `runScheduledScan()` runs the saved scan, saves the snapshot, advances `nextRunAt` by computing the next monthly occurrence, shows a **system Notification** ("FileFlex monthly scan finished — N suggestions…"), and pushes `scheduler:fired` to every window (the renderer toasts "new suggestions are waiting in the queue").
- Optional `launchAtStartup` uses `app.setLoginItemSettings({ openAsHidden: true })`, applied whenever the setting patch changes it (`ipc.ts`).

### 5.7 Sample Data (`src/main/fixtures.ts`)

"Try with sample data" builds a realistic messy folder in the OS temp dir (`%TEMP%\fileflex-sample-<timestamp>`) with synthetic-but-valid PDF/JPG/PNG/ZIP-header/TXT bytes: exact duplicates (`IMG_20240103_123445 (2).jpg`, `invoice_acme_march (copy).pdf`, `report draft (copy).docx`, `budget 2024 (1).xlsx`), near duplicates (`screenshot 2-11 final.png`), scanner output (`scan0001–0003.pdf`), course files (`BIO101_*`), scattered merges (`report draft/final/report.pdf/report notes.txt`), an `Old/` and `photos/` subfolder. Returns the path; the renderer adds it to the folder list.

---

## 6. Shared (Pure) Modules

Used by both main and renderer; all unit-testable in Node.

### 6.1 `types.ts`
All shared interfaces: `Category`, `ScanFile`, `Suggestion` (kinds `rename|duplicate|merge|move`), `ScanSummary`, `ScanResult`, `ScanProgress`, `PlannedOp`/`BatchOp`/`Batch`, `NamingRule` (+ `Casing`), **`ThemeSettings`** (`mode: light|dark|system`, `accent`, `text`, `border`, `background`), `Settings`, `AppInfo`.

### 6.2 `signals.ts` — filename signal extraction
- **Dates:** finds explicit dates in names — ISO (`2024-03-12`), M-D-Y (`3-12-2024`), compact (`20240312`) with `-`/`_`/`.` separators; validates real calendar dates (1990–2100) and tries both field orders.
- **Document types** (ordered, first match wins): screenshot, photo (`IMG_/DSC_/PXL…` prefixes), invoice, receipt, resume/cv, cover letter, syllabus, transcript, homework/assignment, notes, report, contract/agreement/lease, statement, budget, scan (`scan0001`-style), minutes, agenda, proposal, essay/thesis/paper, exam/quiz, presentation/slides, document (`Doc1`, `untitled`). Word-boundary matching uses explicit alnum lookarounds (because `\b` fails inside snake_case).
- **Course codes:** case-**sensitive** `([A-Z]{2,4})[\s_-]?(\d{3,4})` → `BIO101`, `MATH2401` (so `scan0001` isn't mistaken for one).
- **Noise:** tokens like copy/final/draft/old/new/latest/backup/v2/untitled… plus trailing junk (`(copy)`, `(1)`, `[2]`, `final v1.2`) are detected (`noisy: true`) and stripped.
- **Topic:** remaining ≥ 2-char alphanumeric tokens (numbers-only and noise dropped, deduped) joined by spaces.
- `withMtimeFallback(sig, mtimeMs)` supplies the file's modified date when the name has none (renames then note "from modified time", and confidence is reduced).
- `normalizeName(base)` — the duplicate/merge grouping key (lowercased, noise + trailing counters stripped).

### 6.3 `naming.ts`
- `composeName(pattern, sig, casing, ext)` — fills tokens `{date} {year} {month} {day} {type} {course} {topic} {index} {ext}`; drops empty tokens, collapses repeated separators, strips Windows-forbidden chars `\ / : * ? " < > |`, guarantees the extension, falls back to `"file"`. `{index}` is preserved for the caller.
- `fillIndex(name, n)` — replaces `{index}` with a 2-padded counter (`01`).
- `applyCasing` — `snake` / `kebab` / `lower` / `keep`.
- `diffStrings(a, b)` — character-level common prefix/suffix split, powering the before/after diff highlighting in Review.

### 6.4 `classifier.ts`
Extension → category map across 10 categories: pdfs, documents, spreadsheets, presentations, images, archives, media, code, design, other (~80 extensions mapped). Also exports `CATEGORY_LABELS`, `CATEGORY_FOLDERS` (target folder names for structure moves), `ALL_CATEGORIES`.

### 6.5 `schedule.ts`
`computeNextRun(dayOfMonth, time, from)` — next monthly occurrence strictly after `from`; clamps to shorter months (Jan 31 → Feb 28) and sane defaults (09:00).

### 6.6 `format.ts`
`formatBytes`, `formatDate` (and friends) used by the UI, with `tabular-nums` styling in tables.

---

## 7. IPC Reference

Typed contract in `src/shared/api.ts` (`TidyApi`), implemented by preload (`src/preload/index.ts`) and handled in `src/main/ipc.ts`.

| Method | Channel | Purpose |
|---|---|---|
| `getInfo()` | `app:info` | `{ version, dataDir, platform }` |
| `pickFolders()` | `dialog:pick-folders` | native multi-select directory dialog |
| `getSettings()` | `settings:get` | current settings |
| `updateSettings(patch)` | `settings:update` | deep-merged patch → saved settings; applies `launchAtStartup` via `setLoginItemSettings` |
| `getRules()` / `saveRules(rules)` / `resetRules()` | `rules:*` | naming rules CRUD (reset restores defaults) |
| `startScan()` | `scan:start` | scan configured folders; saves snapshot; streams `scan:progress` |
| `getLatestScan()` | `scan:latest` | restore last scan snapshot on launch |
| `runScanNow()` | `scan:run-now` | manual scan + `lastRunAt` stamp |
| `dryRun(folders)` | `scan:dry-run` | scan arbitrary folders without saving |
| `applyBatch({label, ops})` | `apply:batch` | execute + log a batch |
| `getHistory()` / `undoBatch(id)` / `clearHistory()` | `history:*` | batch log & rollback |
| `runScheduledNow()` | `scheduler:run-now` | force the scheduled-scan path (notification + nextRun advance) |
| `prepareSampleData()` | `sample:prepare` | build the demo fixture folder |
| `openDataFolder()` | `data:open-folder` | reveal `dataDir` in Explorer |
| `onScanProgress(cb)` | `scan:progress` (event) | `{ phase: scan\|analyze, files, dir? }` |
| `onSchedulerFired(cb)` | `scheduler:fired` (event) | `{ count, scannedAt }` after a scheduled run |

Error convention: main throws `Error(msg)`; the renderer store unwraps to the last `Error: …` segment and shows it as a toast.

---

## 8. Data Model

```ts
interface Settings {
  folders: string[]                       // scan roots
  scan: { maxDepth: number; skipHidden: boolean }
  exclusions: { patterns: string[]; extensions: string[] }
  scheduler: {
    enabled: boolean
    dayOfMonth: number                    // 1–31, clamped per month
    time: string                          // "HH:mm" local
    nextRunAt: number | null
    lastRunAt: number | null
    launchAtStartup: boolean
  }
  theme: ThemeSettings                    // see §11
}

interface Suggestion {
  id: string                              // uuid
  kind: 'rename' | 'duplicate' | 'merge' | 'move'
  from: string; to: string
  confidence: number                      // 0–1 (chips: green ≥ 0.85, amber ≥ 0.6, red below)
  reason: string; detail?: string
  tags: string[]
  groupId?: string; groupLabel?: string   // multi-row operations
  keepPath?: string                       // duplicates: the surviving copy
}

interface Batch {
  id: string; label: string
  appliedAt: number; undoneAt?: number
  status: 'applied' | 'undone' | 'partial'
  ops: BatchOp[]                          // { kind, from, to, status: ok|error|undone, error? }
}
```

---

## 9. Data Persistence

| File | Contents | Written by |
|---|---|---|
| `data/settings.json` | Settings (incl. theme and saved themes) | settings:update |
| `data/rules.json` | Naming rules | rules:save/reset |
| `data/history.json` | All applied batches | apply:batch, history:undo/clear |
| `data/scans/latest.json` | Full last scan (files + suggestions + summary) | scan:start / run-now / scheduled |

All writes are atomic (tmp + rename with retry). The latest scan snapshot is restored on app start so results survive restarts. `Settings → "Open data folder"` reveals the directory.

---

## 10. Renderer

### 10.1 State (`src/renderer/src/store.ts`)
Single Zustand store. `init()` runs once (loads info, settings, rules, history, latest scan; subscribes to progress/scheduler events). Actions: `addFolders` / `removeFolder`, `patchSettings` (persists via IPC and stores the returned canonical settings), `startScan` / `runNow` / `prepareSample`, decision tracking (`decisions`: approved | dismissed | applied; multi-select `selection`), `applyApproved` (approved suggestions → `PlannedOp`s → `applyBatch` → toast + refresh history), `undoBatch`, `saveRules` / `resetRules`, `clearHistory`, `toast` (auto-dismiss ~5 s). `nextRunPreview(settings)` powers the sidebar footer.

### 10.2 Pages (routes in `App.tsx`, HashRouter)

| Route | Page | What it does |
|---|---|---|
| `/` | **Scan Setup** | folder list via native picker, exclusion summary, depth/hidden options, Start Scan with progress, recent scan info, "Try with sample data" |
| `/results` | **Scan Results** | summary tiles (files, size, categories, duplicates, suggestions), per-category breakdown table with drill-down file lists |
| `/queue` | **Suggestions Queue** | filter tabs (Renames / Duplicates / Merges / Moves), multi-term search across paths, proposed names, reasons, tags, and group labels, sortable columns (Kind, Current file, Size, Confidence — click to sort, again to flip, a third time restores engine order), Size column, checkbox rows, monospace paths, from→to previews, confidence chips, "X of Y shown" counter, bulk bar (approve selected / dismiss / approve high-confidence ≥ 0.85) |
| `/review` | **Review & Approve** | grouped before/after diff with character-level change highlighting, per-item include toggles, disk-reclaimed summary, "Nothing changes until you approve" banner, Apply with progress |
| `/history` | **History & Undo** | batch timeline, expandable op logs, status badges, Undo with progress |
| `/rules` | **Naming Rules** | ordered rule list with enable toggles, token legend, add/edit modal (extensions, doc types, casing, require course/date flags), live preview against sample filenames |
| `/settings` | **Settings** | **Theme customization card at the top** (see §11), privacy statement, exclusions editor (patterns + extensions), scheduler card (enable, day-of-month, time, next-run preview, launch-at-startup), data folder location, clear-history danger zone |

Sidebar groups: *Workflow* (first five) and *Configure* (Rules, Settings), with live badges (pending suggestions, approved count), a privacy line, the next monthly-scan date, and the app version.

### 10.3 Shared UI (`src/renderer/src/components/ui.tsx`)
`Button` (variants: primary `bg-brand-600`, secondary `bg-panel`, danger), `Card`, `Modal` (themed overlay `bg-black/40`, `bg-panel` body), `EmptyState`, `Stat`, `inputCls` (shared input classes), `Toasts`. All icons are inline SVGs (`icons.tsx`) — no icon dependency.

---

## 11. Theme Customization System

Implemented in `src/renderer/src/contexts/ThemeContext.tsx` + the Settings page's **Theme card (first card on the page)**. The app ships dark/light/system modes **and** full user recoloring, in both modes.

### 11.1 Model & defaults (`ThemeSettings`)
```ts
{ mode: 'light' | 'dark' | 'system',
  accent: '#2b86ac',      // brand-500
  text:   '#17202b',      // ink
  border: '#e4e8ee',      // line
  background: '#f6f8fa' } // surface
```
Persisted under `settings.theme` (deep-merged patch in the store). `mode: system` follows `prefers-color-scheme` live (media-query listener), so "currently dark/light" changes without reload.

**Saved themes (`ThemePreset`):** `{ id, name, theme: ThemeSettings }` stored in `settings.themePresets` (a record keyed by id, defaulting to `{}`). A preset captures all five settings — mode plus the four colors — so re-applying it restores the exact look, dark mode included. Presets persist in the same atomic `settings.json` and survive restarts; saving under an existing name overwrites that entry in place.

### 11.2 How theming works
- Tailwind v4 `@theme` defines static defaults; **runtime overrides** are set as inline CSS custom properties on `document.documentElement`, which recolor every Tailwind utility that references those tokens (`text-ink`, `bg-panel`, `border-line`, `bg-brand-600`, …).
- The Settings page writes patches through `applyTheme`-per-edit: it composes `next = { ...theme, ...patch }`, calls `patchSettings({ theme: next })`, and the Zustand subscription in `ThemeProvider` re-applies variables instantly — changes are visible immediately **and** persisted.
- Surfaces are two-tier: `--color-surface` (page background) and `--color-panel` (cards, sidebar, tables, modals). Every component uses token classes (`bg-panel`, `border-line`) — no hardcoded `bg-white` — so the whole UI recolors in one pass.

### 11.3 Accent → 10-step brand scale (`generateShadeScale`)
From the single accent hex, a full Tailwind-style ramp `brand-50…900` is generated in HSL:
- **Tints (50–400):** lightness rises toward 97; **saturation is boosted up to +70% of the gap to 100** so tints stay vivid rather than washing out.
- **500:** the exact user color.
- **Shades (600–900):** lightness falls to 28% of base; saturation rises (+32 max) to keep shades rich. **In dark mode** the dark end is floored (`600→40, 700→36, 800→32, 900→28` lightness) and saturation is boosted proportionally, so primary buttons/toggles stay bright and never look "dull" or overlaid on dark surfaces.

### 11.4 Light vs dark derivation (`applyTheme`)
- **Light:** `surface` = user background; `panel` = background lightness +3; `ink` = exact user text; `ink-2`/`ink-3` = same hue, lightness stepped ±15 from the text's; `line` = exact user border.
- **Dark:** palettes are **derived from the user's hues, not replaced** with gray. `surface` = background hue, lightness clamped 4–14; `panel` = +7 (10–20); `ink` = text hue **with saturation preserved up to 70** and lightness pinned 85–98 (`ink-2` 74, `ink-3` 58 — only lightness is constrained, so chosen text hues survive instead of graying out); `line` = border hue at lightness 14–26.
- Variables set: `--color-ink, --color-ink-2, --color-ink-3, --color-line, --color-surface, --color-panel` and `--color-brand-50…900`.

### 11.5 Theme card UX
- **Mode:** segmented Light / Dark / System buttons (System shows a live "currently dark/light" hint).
- **Presets:** one-click swatches — FileFlex (default), Midnight, Forest, Amber, Rose — which set all four colors at once.
- **Custom colors:** for accent / text / border / background, a native color picker plus a hex text input (both kept in sync; hex input validates before applying).
- **Saved themes:** type a name and hit "Save current theme" (or Enter) to snapshot the live theme; the list below shows each saved theme with a four-color swatch strip, its mode, an **Apply** button (instant re-color + persist), and a two-click **Delete**. Re-using a name updates that theme instead of duplicating it.

---

## 12. Design System

Defined once in `src/renderer/src/index.css` (`@theme`):

- **Fonts:** Segoe UI Variable/Segoe UI (13.5 px base); `Cascadia Mono`/Consolas for paths, diffs, and code. `.tnum` (tabular numerals) on sizes, dates, and table figures.
- **Light palette:** ink `#17202b` / ink-2 `#5c6774` / ink-3 `#8b95a2`, line `#e4e8ee`, surface `#f6f8fa`, panel `#ffffff`.
- **Brand scale:** teal-blue `brand-50 #eef7fb … brand-900 #123d51` (defaults reproduce the accent ramp).
- **Semantic (muted):** ok (green), warn (amber), bad (red) at 50/100/300/600/700 steps — used for confidence chips, banners, and destructive buttons.
- **Scrollbars** are themed via `--color-line` / `--color-ink-3`; selection color is `brand-100`.
- Dense spreadsheet-style tables with sticky headers; restrained color use (brand for actions only).

---

## 13. Naming Rules & Tokens

A rule: `{ id, name, enabled, priority, pattern, casing, extensions, docTypes, requireCourse?, requireDateFromName? }`. Rules apply in priority order; first match wins; a rule only fires if the file has signals it needs and passes scope filters.

**Tokens:** `{date}` → `YYYY-MM-DD`, `{year}`, `{month}`, `{day}`, `{type}` (doc type), `{course}`, `{topic}`, `{index}` (2-padded, per-directory counter, collision-safe), `{ext}`. Empty tokens are dropped and separators collapsed automatically.

**Default rules (shipped):**

| # | Name | Pattern | Casing | Scope |
|---|---|---|---|---|
| 1 | Invoices & receipts | `{type}_{topic}_{date}{ext}` | snake | docTypes: invoice, receipt, statement |
| 2 | Scanner output | `{type}_{date}_{index}{ext}` | snake | docTypes: scan |
| 3 | Photos & screenshots | `{date}_{type}_{topic}{ext}` | kebab | image extensions |
| 4 | Course files | `{course}_{type}_{topic}{ext}` | snake | requires course code in name |
| 5 | General cleanup | `{date}_{type}_{topic}{ext}` | snake | requires a date **in the filename** (prevents mtime-driven mass renames) |

The Rules page offers a live preview: pick a template and see composed names for sample filenames before saving.

---

## 14. Suggestion Engine Details

Confidence chip thresholds in the UI: **green ≥ 0.85** (bulk "approve high-confidence" uses this), **amber ≥ 0.6**, **red below**.

| Kind | Trigger | Confidence | Default action |
|---|---|---|---|
| duplicate | exact (SHA-256) | 0.93 | keep newest, archive rest to `_Duplicates/<date>/…` |
| duplicate | near (normalized name + ≤3× size) | 0.62 | same |
| merge | same base, ≥2 formats or ≥2 folders | 0.5–0.75 | consolidate into `Topic/` folder |
| rename | rule match with signals | 0.30–0.95 (formula in §5.4) | standardized name |
| move | ≥8 loose files of one category in a root | 0.5–0.7 | file into `Category/` folder |

Each duplicate/merge/move set shares a `groupId` + `groupLabel` so the queue and review pages can present it as one card (e.g. "4 identical files — keep `report final.docx`").

---

## 15. Development Guide

```bash
npm install
npm run dev         # electron-vite dev: main+preload rebuild, renderer HMR on :5173
npm run build       # build main/preload/renderer bundles to out/
npm start           # electron-vite preview (run the built app)
npm test            # vitest run (engine unit tests)
npm run typecheck   # tsc --noEmit for node + web tsconfigs
npm run dist        # build + electron-builder → Windows installer
npm run format      # prettier
```

- **electron-vite config** (`electron.vite.config.ts`): main/preload use `externalizeDepsPlugin`; renderer uses `@vitejs/plugin-react` + `@tailwindcss/vite`. Output under `out/{main,preload,renderer}`.
- **TypeScript:** three configs — `tsconfig.node.json` (main+preload), `tsconfig.web.json` (renderer), root `tsconfig.json` referencing both. Shared code imports freely across boundaries since it's pure TS.
- Path conventions: `@shared/*` style aliases are not used; cross-process imports are relative (`../../shared/types`).

## 16. Testing

Vitest (`vitest.config.ts`) runs pure-module tests only — no Electron needed:

- **signals.test.ts** — date formats (ISO, M-D-Y, compact), doc-type detection, course codes (`BIO101` yes, `scan0001` no), noise/trailing-junk stripping, topic extraction, mtime fallback.
- **naming.test.ts** — token composition, empty-token collapsing, forbidden chars, `{index}` padding, `diffStrings`.
- **suggest.test.ts** — rename rule application and priority, duplicate keep-newest + archive targets, merge grouping, structure-move threshold.
- **applier.test.ts** — apply with collision suffixing, undo reversing in order, partial-undo status.

Current status: **31/31 tests pass**, typecheck clean, production build clean.

## 17. Build & Packaging

`npm run dist` → `electron-vite build` + `electron-builder` produces a Windows NSIS installer. `package.json` pins `allowScripts` for the Electron postinstall (`electron@37.10.3: true`). No native dependencies → no rebuild toolchain required.

## 18. Security Model

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false` (required by the preload bridge), single narrow `window.api` surface via `contextBridge`.
- All filesystem access lives in the main process; the renderer can only trigger it through the typed IPC list in §7.
- User-picked folders are the only roots ever walked (plus the temp sample folder). The app never writes outside: user-chosen targets, the `_Duplicates` archive, `userData/data`, and the temp fixture.
- No network usage anywhere (no fetch/axios/telemetry); notifications are local system notifications.

## 19. Behavior Guarantees & Limitations

**Guarantees**
- Nothing is deleted — cleanup is rename/move only; duplicates go to `_Duplicates/`.
- Every applied batch is undoable (inverse ops, newest-first) unless a target file was moved/deleted by something outside the app.
- On-approval collision handling: targets get ` (2)`-style suffixes rather than overwriting.
- Settings/theme/rule changes take effect immediately and survive restarts (atomic JSON writes).

**Limitations / known behavior**
- Filename-heuristic engine: a file with no detectable signals gets no rename suggestion (by design).
- Near-duplicate matching requires the same extension and within-3× sizes; it does not do image/video content similarity.
- Scan cap of 50 000 files per scan (result flagged `truncated`).
- `{index}` numbering is computed at suggestion time; if the folder changes between scan and apply, the applier's collision suffixing is the final safety net.
- macOS/Linux are untested targets (Windows path/lock semantics are handled — e.g. EXDEV fallback and rename retries — but the installer is Windows NSIS only).
- The scheduler is in-app: monthly scans only run while the app is open (launch-at-startup optional).
