import { Fragment, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "../../../shared/classifier";
import { formatBytes, formatDateTime } from "../../../shared/format";
import type { Category } from "../../../shared/types";
import {
  ArrowRightIcon,
  ChartIcon,
  FileIcon,
  PlayIcon,
} from "../components/icons";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  Stat,
  TrustBanner,
} from "../components/ui";
import { useStore } from "../store";

export default function ScanResults() {
  const navigate = useNavigate();
  const scan = useStore((s) => s.scan);
  const decisions = useStore((s) => s.decisions);
  const [expanded, setExpanded] = useState<Category | null>(null);

  if (!scan) {
    return (
      <div>
        <PageHeader title="Scan Results" />
        <EmptyState
          icon={<ChartIcon className="h-7 w-7" />}
          title="No scan yet"
          body="Pick folders and run a scan to see what FileFlex found."
        >
          <Button variant="primary" onClick={() => navigate("/")}>
            <PlayIcon className="h-3.5 w-3.5" /> Go to Scan Setup
          </Button>
        </EmptyState>
      </div>
    );
  }

  const { summary } = scan;
  const suggestionCount =
    summary.counts.rename +
    summary.counts.duplicate +
    summary.counts.merge +
    summary.counts.move;
  const categories = ALL_CATEGORIES.filter((c) => summary.byCategory[c]).sort(
    (a, b) =>
      (summary.byCategory[b]!.size ?? 0) - (summary.byCategory[a]!.size ?? 0),
  );
  const approvedCount = scan.suggestions.filter(
    (s) => decisions[s.id] === "approved",
  ).length;

  return (
    <div>
      <PageHeader
        title="Scan Results"
        subtitle={`Scanned ${formatDateTime(scan.scannedAt)} · ${scan.folders.length} folder${scan.folders.length > 1 ? "s" : ""}`}
      >
        <Button onClick={() => navigate("/")}>Rescan</Button>
        <Button
          variant="primary"
          disabled={!suggestionCount}
          onClick={() => navigate("/queue")}
        >
          Review {suggestionCount} suggestions{" "}
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </Button>
      </PageHeader>
      <TrustBanner>
        Preview only — this scan read file names and metadata. Files stay
        untouched until you approve changes.
      </TrustBanner>

      {scan.truncated && (
        <div className="mb-4 rounded-md border border-warn-300/70 bg-warn-50 px-3 py-2 text-xs text-warn-700">
          The scan stopped at the 50,000-file safety cap — results below cover
          the first part of your folders.
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 md:grid-cols-5">
        <Stat
          label="Files scanned"
          value={summary.fileCount.toLocaleString()}
        />
        <Stat label="Total size" value={formatBytes(summary.totalSize)} />
        <Stat
          label="Suggestions"
          value={suggestionCount}
          sub="renames, dups, merges, moves"
        />
        <Stat
          label="Duplicate copies"
          value={summary.duplicateFileCount}
          sub="verified by checksum"
        />
        <Stat
          label="Duplicate space"
          value={formatBytes(summary.duplicateSize)}
          sub="archived, not deleted"
        />
      </div>

      {approvedCount > 0 && (
        <p className="mt-3 text-xs text-ink-2">
          {approvedCount} suggestion{approvedCount > 1 ? "s" : ""} approved and
          waiting in{" "}
          <button
            className="text-brand-700 hover:underline"
            onClick={() => navigate("/review")}
          >
            Review &amp; Approve
          </button>
          .
        </p>
      )}

      <Card
        className="mt-4"
        title="Detected file types & categories"
        padded={false}
      >
        <table className="w-full text-[18px]">
          <thead>
            <tr className="border-b border-line text-left text-lg text-ink-2">
              <th className="px-4 py-4 font-medium">Category</th>
              <th className="px-1 py-2 text-right font-medium">Files</th>
              <th className="px-14 py-2 text-right font-medium">Size</th>
              <th className="px-16 py-2 font-medium">Share of folder</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => {
              const info = summary.byCategory[c]!;
              const pct = summary.totalSize
                ? Math.round((info.size / summary.totalSize) * 100)
                : 0;
              const files = scan.files.filter((f) => f.category === c);
              const open = expanded === c;
              return (
                <Fragment key={c}>
                  <tr className="border-b border-line/60 hover:bg-surface/60">
                    <td className="px-4 py-4 w-48 font-medium text-ink">
                      {CATEGORY_LABELS[c]}
                    </td>

                    <td className="tnum px-4 py-4 text-right w-48">
                      {info.count.toLocaleString()}
                    </td>

                    <td className="tnum px-12 py-4 text-right w-1/6">
                      {formatBytes(info.size)}
                    </td>

                    <td className="px-16 py-4 w-2xl">
                      <div className="flex items-center gap-6">
                        <div className="h-2.5 w-xl overflow-hidden rounded-full bg-surface">
                          <div
                            className="h-full rounded-full bg-brand-400"
                            style={{ width: `${Math.max(2, pct)}%` }}
                          />
                        </div>
                        <span className="tnum text-md text-ink-2">{pct}%</span>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-center">
                      <Button
                        variant="ghost"
                        sm
                        onClick={() => setExpanded(open ? null : c)}
                      >
                        {open ? "Hide" : "View files"}
                      </Button>
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-line/60 bg-surface/40">
                      <td colSpan={5} className="px-4 py-3">
                        <table className="w-full text-sm">
                          <tbody>
                            {files.slice(0, 60).map((f) => (
                              <tr key={f.id} className="align-baseline">
                                <td
                                  className="w-2/5 truncate py-0.5 pr-4 font-mono text-ink"
                                  title={f.path}
                                >
                                  {f.name}
                                </td>
                                <td
                                  className="truncate py-0.5 pr-4 font-mono text-ink-3"
                                  title={f.dir}
                                >
                                  {f.dir}
                                </td>
                                <td className="tnum w-20 py-0.5 text-right text-ink-2">
                                  {formatBytes(f.size)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {files.length > 60 && (
                          <p className="mt-2 text-xs text-ink-3">
                            …and {files.length - 60} more{" "}
                            {CATEGORY_LABELS[c].toLowerCase()}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="mt-4 flex items-center gap-2 text-md text-ink-3">
        <FileIcon className="h-3.5 w-3.5" />
        <span>
          {scan.files.length.toLocaleString()} files indexed in this scan
          snapshot.
        </span>
      </div>
    </div>
  );
}
