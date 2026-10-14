import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { formatDateTime } from "../../../shared/format";
import { api } from "../api";
import {
  FolderIcon,
  FolderPlusIcon,
  PlayIcon,
  ShieldIcon,
  SparkleIcon,
} from "../components/icons";
import {
  Button,
  Card,
  PageHeader,
  Select,
  Toggle,
  TrustBanner,
  inputCls,
} from "../components/ui";
import { nextRunPreview, useStore } from "../store";

export default function ScanSetup() {
  const navigate = useNavigate();
  const settings = useStore((s) => s.settings);
  const scan = useStore((s) => s.scan);
  const scanning = useStore((s) => s.scanning);
  const progress = useStore((s) => s.progress);
  const startScan = useStore((s) => s.startScan);
  const prepareSample = useStore((s) => s.prepareSample);
  const addFolders = useStore((s) => s.addFolders);
  const removeFolder = useStore((s) => s.removeFolder);
  const patchSettings = useStore((s) => s.patchSettings);
  const lastScanId = useRef<string | null>(scan?.id ?? null);

  useEffect(() => {
    if (scan && scan.id !== lastScanId.current) {
      lastScanId.current = scan.id;
      navigate("/results");
    }
  }, [scan, navigate]);

  if (!settings) return null;
  const canScan = settings.folders.length > 0 && !scanning;

  const pick = async (): Promise<void> => {
    const dirs = await api.pickFolders();
    if (dirs.length) await addFolders(dirs);
  };

  return (
    <div>
      <PageHeader
        title="Scan Setup"
        subtitle="Choose the folders FileFlex should analyze. The scan only reads file names, sizes and timestamps."
      />
      <TrustBanner />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title={`Folders to scan (${settings.folders.length})`}
          actions={
            <>
              <Button onClick={() => void pick()}>
                <FolderPlusIcon className="h-3.5 w-3.5" /> Add folders
              </Button>
              <Button onClick={() => void prepareSample()}>
                <SparkleIcon className="h-3.5 w-3.5" /> Try with sample data
              </Button>
            </>
          }
        >
          {settings.folders.length === 0 ? (
            <div className="rounded-md border border-dashed border-line px-4 py-10 text-center">
              <FolderIcon className="mx-auto h-6 w-6 text-ink-3" />
              <p className="mt-2 text-[16px] font-medium text-ink">
                No folders selected yet
              </p>
              <p className="mt-1 text-xs text-ink-2">
                Add a messy folder — Downloads, Desktop, a course folder — or
                load the bundled sample data.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {settings.folders.map((f) => (
                <li
                  key={f}
                  className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <FolderIcon className="h-5 w-5 shrink-0 text-brand-600" />
                  <span
                    className="truncate font-mono text-sm text-ink"
                    title={f}
                  >
                    {f}
                  </span>
                  <Button
                    variant="ghost"
                    sm
                    className="ml-auto opacity-0 group-hover:opacity-100"
                    onClick={() => void removeFolder(f)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Scan options">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[16px] font-medium text-ink">
                    Folder depth
                  </div>
                  <div className="text-xs text-ink-2">
                    How deep to look inside subfolders
                  </div>
                </div>
                <Select
                  className="w-24"
                  value={settings.scan.maxDepth}
                  onChange={(v) =>
                    void patchSettings({
                      scan: {
                        ...settings.scan,
                        maxDepth: Number(v),
                      },
                    })
                  }
                  options={[2, 4, 6, 10, 20].map((d) => ({
                    value: d,
                    label: `${d} levels`,
                  }))}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[16px] font-medium text-ink">
                    Skip hidden files
                  </div>
                  <div className="text-xs text-ink-2">
                    Dotfiles and system entries
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
              <div className="flex items-center justify-between gap-4 border-t border-line pt-3">
                <div className="text-xs text-ink-2">
                  {settings.exclusions.patterns.length} exclusion patterns ·{" "}
                  {settings.exclusions.extensions.length} blocked types
                </div>
                <Button
                  variant="ghost"
                  sm
                  onClick={() => navigate("/settings")}
                >
                  Edit
                </Button>
              </div>
            </div>
          </Card>

          <Card title="Monthly scan">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[16px] font-medium text-ink">
                  {settings.scheduler.enabled ? "On" : "Off"}
                </div>
                <div className="tnum text-xs text-ink-2">
                  {settings.scheduler.enabled && nextRunPreview(settings)
                    ? `Next run ${formatDateTime(nextRunPreview(settings)!)}`
                    : "Enable in Settings to rescan automatically"}
                </div>
              </div>
              <Toggle
                checked={settings.scheduler.enabled}
                onChange={(v) =>
                  void patchSettings({
                    scheduler: { ...settings.scheduler, enabled: v },
                  })
                }
              />
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-4 rounded-lg border border-line bg-panel px-4 py-3.5">
        <PlayIcon className="h-4 w-4 text-brand-700" />
        {scanning ? (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-4 text-[16px] font-medium text-ink">
              Scanning…
              {progress && (
                <span className="tnum text-xs font-normal text-ink-2">
                  {progress.files} files so far
                </span>
              )}
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-brand-500" />
            </div>
            {progress?.dir && (
              <div
                className="mt-1.5 truncate font-mono text-[11px] text-ink-3"
                title={progress.dir}
              >
                {progress.phase === "scan"
                  ? progress.dir
                  : "Checksumming for duplicates…"}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-medium text-ink">
                {settings.folders.length
                  ? `Ready to scan ${settings.folders.length} folder${settings.folders.length > 1 ? "s" : ""}`
                  : "Add a folder to begin"}
              </div>
              <div className="text-xs text-ink-2">
                The scan proposes changes — applying them is a separate,
                explicit step.
              </div>
            </div>
            <Button
              variant="primary"
              disabled={!canScan}
              onClick={() => void startScan()}
            >
              <PlayIcon className="h-3.5 w-3.5" /> Start scan
            </Button>
          </>
        )}
      </div>

      {scan && !scanning && (
        <p className="mt-3 text-md text-ink-3">
          Last scan: {formatDateTime(scan.scannedAt)} — {scan.summary.fileCount}{" "}
          files, {scan.suggestions.length} suggestions.{" "}
          <button
            className="text-brand-700 hover:underline"
            onClick={() => navigate("/results")}
          >
            View results
          </button>
        </p>
      )}

      <div className="mt-6 flex items-start gap-2 text-md text-ink-3">
        <ShieldIcon className="mt-px h-3.5 w-3.5 shrink-0" />
        <span>
          Analysis runs entirely on this machine. FileFlex reads file metadata
          only — it never opens or uploads your documents.
        </span>
      </div>
    </div>
  );
}
