# FileFlex

A local-first desktop app (Electron + React + TypeScript) that helps busy professionals and students clean up messy folders: it scans folders, proposes standardized names, flags duplicates, and suggests safe merges — **nothing changes until you approve**, and every applied change can be rolled back.

## Run

```bash
npm install
npm run dev        # development with HMR
npm run build      # build main/preload/renderer
npm start          # run the built app
npm test           # engine unit tests (vitest)
npm run typecheck  # tsc for node + web configs
npm run dist       # package a Windows installer (electron-builder)
```

## How it works

- **Scan Setup** — pick folders (or load bundled sample data). The scanner reads file names, sizes, and timestamps only; it never opens document contents and never touches the network.
- **Scan Results** — detected file types/categories, sizes, and duplicate stats.
- **Suggestions Queue** — a spreadsheet of proposals: renames (rule-based with confidence scores), exact/near duplicates (SHA-256 verified, newest kept, others archived to `_Duplicates/` — never deleted), merge candidates (same base scattered across folders or formats), and folder-structure moves. Bulk actions included.
- **Review & Approve** — a before/after diff of every approved change; uncheck anything; Apply executes the batch.
- **History & Undo** — batches with full operation logs; undo replays the inverse operations newest-first.
- **Naming Rules** — ordered templates with tokens `{date} {type} {topic} {course} {index} {ext}…`, scoping by extension/type, and a live preview.
- **Settings** — privacy notes, exclusion patterns/extensions, and the monthly recurring scan (in-app scheduler with optional launch-at-startup).

Data lives in `userData/data` as JSON (settings, rules, history, latest scan snapshot).
