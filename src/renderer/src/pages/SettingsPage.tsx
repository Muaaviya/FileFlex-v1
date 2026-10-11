import { useState } from "react";
import { formatDateTime } from "../../../shared/format";
import { computeNextRun } from "../../../shared/schedule";
import {
  FolderIcon,
  FolderPlusIcon,
  PlayIcon,
  PlusIcon,
  ShieldIcon,
  TrashIcon,
} from "../components/icons";
import {
  Button,
  Card,
  Chip,
  ConfirmButton,
  Field,
  PageHeader,
  Toggle,
  inputCls,
} from "../components/ui";
import { api } from "../api";
import { useStore } from "../store";
import { useTheme } from "../contexts/ThemeContext";

function ChipListEditor({
  values,
  onChange,
  placeholder,
  mono = false,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  mono?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const add = (): void => {
    const v = draft.trim();
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    setDraft("");
  };
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {values.length === 0 && (
          <span className="text-xs text-ink-3">None</span>
        )}
        {values.map((v) => (
          <Chip key={v} className={mono ? "font-mono" : ""}>
            {v}
            <button
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="opacity-60 hover:opacity-100"
              aria-label={`Remove ${v}`}
            >
              ×
            </button>
          </Chip>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className={`${inputCls} ${mono ? "font-mono text-xs" : ""}`}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button onClick={add}>Add</Button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const info = useStore((s) => s.info);
  const patchSettings = useStore((s) => s.patchSettings);
  const addFolders = useStore((s) => s.addFolders);
  const removeFolder = useStore((s) => s.removeFolder);
  const runNow = useStore((s) => s.runNow);
  const scanning = useStore((s) => s.scanning);
  const clearHistory = useStore((s) => s.clearHistory);
  const toast = useStore((s) => s.toast);
  const {
    theme,
    setTheme,
    resolvedTheme,
    presets: savedThemes,
    savePreset,
    applyPreset,
    deletePreset,
  } = useTheme();
  const [themeName, setThemeName] = useState("");

  if (!settings) return null;

  const commitPreset = (): void => {
    void savePreset(themeName).then((ok) => {
      if (ok) setThemeName("");
    });
  };
  const sched = settings.scheduler;
  const previewNext = sched.enabled
    ? computeNextRun(sched.dayOfMonth, sched.time)
    : null;

  const applyTheme = (patch: Partial<typeof theme>): void => {
    const next = { ...theme, ...patch };
    setTheme(patch);
    void patchSettings({ theme: next });
  };

  const modeOptions: Array<{ label: string; value: typeof theme.mode }> = [
    { label: "Light", value: "light" },
    { label: "Dark", value: "dark" },
    { label: "System", value: "system" },
  ];

  const presets = [
    {
      name: "FileFlex",
      accent: "#2b86ac",
      text: "#17202b",
      border: "#e4e8ee",
      background: "#f6f8fa",
    },
    {
      name: "Midnight",
      accent: "#6ea8ff",
      text: "#e8edf2",
      border: "#2a3542",
      background: "#12181f",
    },
    {
      name: "Forest",
      accent: "#3fb950",
      text: "#16202b",
      border: "#d0d7de",
      background: "#f6f8fa",
    },
    {
      name: "Amber",
      accent: "#d29922",
      text: "#1a1a1a",
      border: "#d9d9d9",
      background: "#ffffff",
    },
    {
      name: "Rose",
      accent: "#e5484d",
      text: "#1a1a1a",
      border: "#d9d9d9",
      background: "#ffffff",
    },
  ];

  const patchSched = (patch: Partial<typeof sched>): void => {
    const next = { ...sched, ...patch };
    if (next.enabled)
      next.nextRunAt = computeNextRun(next.dayOfMonth, next.time);
    void patchSettings({ scheduler: next });
  };

  const openData = async (): Promise<void> => {
    await api.openDataFolder();
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Privacy, exclusions, and the recurring monthly scan."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card
          title="Theme"
          subtitle="Customize colors and light/dark mode"
          className="xl:col-span-2"
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-medium text-ink-2">Mode</div>
              <div className="inline-flex rounded-md border border-line bg-panel p-0.5">
                {modeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => applyTheme({ mode: opt.value })}
                    className={`rounded px-3 py-1 text-[13px] font-medium transition-colors ${
                      theme.mode === opt.value
                        ? "bg-brand-600 text-white"
                        : "text-ink-2 hover:bg-surface"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-ink-3">
                {theme.mode === "system"
                  ? `Currently ${resolvedTheme}`
                  : theme.mode}
              </p>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-ink-2">Presets</div>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                  <button
                    key={p.name}
                    onClick={() =>
                      applyTheme({
                        accent: p.accent,
                        text: p.text,
                        border: p.border,
                        background: p.background,
                      })
                    }
                    className="group flex items-center gap-2 rounded-md border border-line px-2 py-1 text-[13px] hover:border-brand-400"
                  >
                    <span className="flex h-4 w-4 items-center justify-center gap-0.5 rounded-sm border border-line">
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ background: p.accent }}
                      />
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ background: p.text }}
                      />
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ background: p.border }}
                      />
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ background: p.background }}
                      />
                    </span>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Accent color">
              <div className="flex items-center gap-2">
                <label className="relative h-8 w-12 cursor-pointer overflow-hidden rounded-md border border-line">
                  <input
                    type="color"
                    value={theme.accent}
                    onChange={(e) => applyTheme({ accent: e.target.value })}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                  <span
                    className="block h-full w-full"
                    style={{ background: theme.accent }}
                  />
                </label>
                <input
                  className={`${inputCls} font-mono text-xs`}
                  value={theme.accent}
                  onChange={(e) => applyTheme({ accent: e.target.value })}
                />
              </div>
            </Field>

            <Field label="Text color">
              <div className="flex items-center gap-2">
                <label className="relative h-8 w-12 cursor-pointer overflow-hidden rounded-md border border-line">
                  <input
                    type="color"
                    value={theme.text}
                    onChange={(e) => applyTheme({ text: e.target.value })}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                  <span
                    className="block h-full w-full"
                    style={{ background: theme.text }}
                  />
                </label>
                <input
                  className={`${inputCls} font-mono text-xs`}
                  value={theme.text}
                  onChange={(e) => applyTheme({ text: e.target.value })}
                />
              </div>
            </Field>

            <Field label="Border color">
              <div className="flex items-center gap-2">
                <label className="relative h-8 w-12 cursor-pointer overflow-hidden rounded-md border border-line">
                  <input
                    type="color"
                    value={theme.border}
                    onChange={(e) => applyTheme({ border: e.target.value })}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                  <span
                    className="block h-full w-full"
                    style={{ background: theme.border }}
                  />
                </label>
                <input
                  className={`${inputCls} font-mono text-xs`}
                  value={theme.border}
                  onChange={(e) => applyTheme({ border: e.target.value })}
                />
              </div>
            </Field>

            <Field label="Background color">
              <div className="flex items-center gap-2">
                <label className="relative h-8 w-12 cursor-pointer overflow-hidden rounded-md border border-line">
                  <input
                    type="color"
                    value={theme.background}
                    onChange={(e) => applyTheme({ background: e.target.value })}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                  <span
                    className="block h-full w-full"
                    style={{ background: theme.background }}
                  />
                </label>
                <input
                  className={`${inputCls} font-mono text-xs`}
                  value={theme.background}
                  onChange={(e) => applyTheme({ background: e.target.value })}
                />
              </div>
            </Field>
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <div className="text-xs font-medium text-ink-2">Saved themes</div>
            <div className="mt-0.5 text-[11px] text-ink-3">
              Save the colors above under a name, then re-apply them any time.
              Saving a name that already exists overwrites it.
            </div>

            <div className="mt-2.5 flex gap-2">
              <input
                className={`${inputCls} max-w-[260px]`}
                placeholder="Theme name, e.g. Late night"
                value={themeName}
                onChange={(e) => setThemeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitPreset();
                  }
                }}
              />
              <Button
                variant="primary"
                disabled={!themeName.trim()}
                onClick={commitPreset}
              >
                <PlusIcon className="h-3.5 w-3.5" /> Save current theme
              </Button>
            </div>

            {savedThemes.length === 0 ? (
              <div className="mt-3 text-xs text-ink-3">
                No saved themes yet — tune the colors and save them here.
              </div>
            ) : (
              <div className="mt-3 space-y-1.5">
                {savedThemes.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2.5 rounded-md border border-line bg-surface/50 px-2.5 py-1.5"
                  >
                    <span className="flex h-4 w-9 shrink-0 overflow-hidden rounded-sm border border-line">
                      <span
                        className="h-full w-1/4"
                        style={{ background: t.theme.accent }}
                      />
                      <span
                        className="h-full w-1/4"
                        style={{ background: t.theme.text }}
                      />
                      <span
                        className="h-full w-1/4"
                        style={{ background: t.theme.border }}
                      />
                      <span
                        className="h-full w-1/4"
                        style={{ background: t.theme.background }}
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                      {t.name}
                    </span>
                    <span className="shrink-0 text-[11px] capitalize text-ink-3">
                      {t.theme.mode}
                    </span>
                    <Button sm onClick={() => applyPreset(t.id)}>
                      Apply
                    </Button>
                    <ConfirmButton
                      label="Delete"
                      confirmLabel="Confirm"
                      onConfirm={() => void deletePreset(t.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card title="Privacy" subtitle="How FileFlex handles your files">
          <ul className="space-y-2.5 text-[13px] text-ink-2">
            <li className="flex gap-2">
              <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>
                <b className="text-ink">Everything is local.</b> Scanning,
                analysis, and renaming happen entirely on this machine. There is
                no account, no server, and no telemetry.
              </span>
            </li>
            <li className="flex gap-2">
              <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>
                <b className="text-ink">File names and metadata only.</b>{" "}
                Documents are never opened or read — suggestions come from
                filenames, extensions, sizes, and timestamps.
              </span>
            </li>
            <li className="flex gap-2">
              <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>
                <b className="text-ink">No deletions, ever.</b> Duplicate files
                are archived to a review folder; you can empty it yourself once
                satisfied. Every change is reversible from History.
              </span>
            </li>
          </ul>
        </Card>

        <Card title="Monthly scan" subtitle="Runs while the app is open">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-medium text-ink">
                  Enable recurring scan
                </div>
                <div className="tnum text-xs text-ink-2">
                  {previewNext
                    ? `Next run: ${formatDateTime(previewNext)}`
                    : "Currently off"}
                  {sched.lastRunAt &&
                    ` · Last: ${formatDateTime(sched.lastRunAt)}`}
                </div>
              </div>
              <Toggle
                checked={sched.enabled}
                onChange={(v) => patchSched({ enabled: v })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Day of month (1–28)">
                <input
                  type="number"
                  min={1}
                  max={28}
                  className={`${inputCls} tnum`}
                  value={sched.dayOfMonth}
                  onChange={(e) =>
                    patchSched({
                      dayOfMonth: Math.min(
                        28,
                        Math.max(1, Number(e.target.value) || 1),
                      ),
                    })
                  }
                />
              </Field>
              <Field label="Time">
                <input
                  type="time"
                  className={inputCls}
                  value={sched.time}
                  onChange={(e) =>
                    patchSched({ time: e.target.value || "09:00" })
                  }
                />
              </Field>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
              <div>
                <div className="text-[13px] font-medium text-ink">
                  Launch at startup
                </div>
                <div className="text-xs text-ink-2">
                  So the monthly scan can fire on time
                </div>
              </div>
              <Toggle
                checked={sched.launchAtStartup}
                onChange={(v) => patchSched({ launchAtStartup: v })}
              />
            </div>
            <Button
              onClick={() => void runNow()}
              disabled={scanning || !settings.folders.length}
            >
              <PlayIcon className="h-3.5 w-3.5" /> Run scan now
            </Button>
          </div>
        </Card>

        <Card title="Folders & exclusions" subtitle="Applied to every scan">
          <div className="space-y-4">
            <Field label="Folders to scan">
              <div className="space-y-1.5">
                {settings.folders.length === 0 && (
                  <span className="text-xs text-ink-3">
                    None — add them in Scan Setup.
                  </span>
                )}
                {settings.folders.map((f) => (
                  <div
                    key={f}
                    className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5"
                  >
                    <FolderIcon className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                    <span className="truncate font-mono text-xs">{f}</span>
                    <button
                      className="ml-auto text-xs text-ink-3 hover:text-bad-600"
                      onClick={() => void removeFolder(f)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <Button
                  sm
                  onClick={async () => {
                    const dirs = await api.pickFolders();
                    if (dirs.length) await addFolders(dirs);
                  }}
                >
                  <FolderPlusIcon className="h-3.5 w-3.5" /> Add folders
                </Button>
              </div>
            </Field>
            <Field
              label="Excluded name patterns"
              hint="Matches file or folder names anywhere. * and ** wildcards allowed."
            >
              <ChipListEditor
                mono
                values={settings.exclusions.patterns}
                onChange={(patterns) =>
                  void patchSettings({
                    exclusions: { ...settings.exclusions, patterns },
                  })
                }
                placeholder="e.g. node_modules"
              />
            </Field>
            <Field label="Excluded extensions">
              <ChipListEditor
                mono
                values={settings.exclusions.extensions}
                onChange={(extensions) =>
                  void patchSettings({
                    exclusions: { ...settings.exclusions, extensions },
                  })
                }
                placeholder="e.g. tmp"
              />
            </Field>
            <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
              <div>
                <div className="text-[13px] font-medium text-ink">
                  Skip hidden files
                </div>
                <div className="text-xs text-ink-2">
                  Dotfiles, $Recycle.Bin, system entries
                </div>
              </div>
              <Toggle
                checked={settings.scan.skipHidden}
                onChange={(v) =>
                  void patchSettings({
                    scan: { ...settings.scan, skipHidden: v },
                  })
                }
              />
            </div>
          </div>
        </Card>

        <Card title="Data" subtitle="Where FileFlex keeps its records">
          <div className="space-y-3">
            <Field
              label="App data folder"
              hint="Settings, rules, scan snapshots, and the operation log."
            >
              <input
                className={`${inputCls} font-mono text-xs`}
                readOnly
                value={info?.dataDir ?? ""}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void openData()}>Open data folder</Button>
              <ConfirmButton
                onConfirm={() => {
                  void clearHistory();
                  toast("History cleared.", "ok");
                }}
                label={
                  <>
                    <TrashIcon className="h-3.5 w-3.5" /> Clear history log
                  </>
                }
                confirmLabel="Clear all history?"
                variant="danger"
              />
            </div>
            <p className="text-xs text-ink-3">
              Clearing history removes the undo log for past batches — files
              already changed keep their new names.
            </p>
            {info && (
              <p className="text-xs text-ink-3">
                FileFlex v{info.version} · {info.platform}
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
