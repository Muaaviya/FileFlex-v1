import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatBytes } from "../../../shared/format";
import { splitPath } from "../../../shared/naming";
import type { Suggestion, SuggestionKind } from "../../../shared/types";
import { ArrowRightIcon, CheckSquareIcon, ListIcon } from "../components/icons";
import {
  Button,
  Checkbox,
  Chip,
  ConfidenceChip,
  EmptyState,
  PageHeader,
  TrustBanner,
  inputCls,
} from "../components/ui";
import { useStore } from "../store";

const KIND_LABELS: Record<SuggestionKind, string> = {
  rename: "Rename",
  duplicate: "Duplicate",
  merge: "Merge",
  move: "Move",
};

const KIND_TONES: Record<SuggestionKind, "brand" | "warn" | "ok" | "neutral"> =
  {
    rename: "brand",
    duplicate: "warn",
    merge: "ok",
    move: "neutral",
  };

type Tab = "all" | SuggestionKind;
type ConfFilter = "all" | "high" | "medium" | "low";
type SortKey = "kind" | "name" | "size" | "confidence";
type SortDir = "asc" | "desc";

const KIND_ORDER: Record<SuggestionKind, number> = {
  rename: 0,
  duplicate: 1,
  merge: 2,
  move: 3,
};

/** Direction applied on the first click of a column header. */
const PRIMARY_DIR: Record<SortKey, SortDir> = {
  kind: "asc",
  name: "asc",
  size: "desc",
  confidence: "desc",
};

function ProposedCell({ s }: { s: Suggestion }) {
  const to = splitPath(s.to);
  const from = splitPath(s.from);
  if (s.kind === "rename") {
    return <span className="font-mono text-xs text-ink">{to.name}</span>;
  }
  return (
    <span className="font-mono text-xs text-ink">
      {to.name !== from.name ? to.name : ""}
      <span className="text-ink-3">
        {to.name !== from.name ? "  ·  " : ""}
        {to.dir}
      </span>
    </span>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  th,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey | null; dir: SortDir };
  onSort: (k: SortKey) => void;
  th: string;
}) {
  const active = sort.key === sortKey;
  return (
    <th className={th}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex w-full items-center gap-1 rounded text-left hover:text-ink ${
          active ? "text-ink" : ""
        } ${th.includes("text-right") ? "justify-end" : ""}`}
        title="Click to sort; click again to flip; a third click restores default order"
      >
        {label}
        <span
          className={`text-[9px] leading-none ${
            active ? "text-brand-700" : "text-transparent"
          }`}
        >
          {active && sort.dir === "asc" ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}

export default function SuggestionsQueue() {
  const navigate = useNavigate();
  const scan = useStore((s) => s.scan);
  const decisions = useStore((s) => s.decisions);
  const selection = useStore((s) => s.selection);
  const decide = useStore((s) => s.decide);
  const toggleSelect = useStore((s) => s.toggleSelect);
  const selectMany = useStore((s) => s.selectMany);
  const clearSelection = useStore((s) => s.clearSelection);

  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [conf, setConf] = useState<ConfFilter>("all");
  const [showHandled, setShowHandled] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey | null; dir: SortDir }>({
    key: null,
    dir: "desc",
  });

  const sizeByPath = useMemo(() => {
    const m = new Map<string, number>();
    if (scan) for (const f of scan.files) m.set(f.path, f.size);
    return m;
  }, [scan]);

  function cycleSort(key: SortKey): void {
    setSort((cur) => {
      if (cur.key !== key) return { key, dir: PRIMARY_DIR[key] };
      if (cur.dir === PRIMARY_DIR[key])
        return { key, dir: cur.dir === "asc" ? "desc" : "asc" };
      return { key: null, dir: "desc" };
    });
  }

  const rows = useMemo(() => {
    if (!scan) return [];
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const filtered = scan.suggestions.filter((s) => {
      if (tab !== "all" && s.kind !== tab) return false;
      const d = decisions[s.id];
      if (!showHandled && d) return false;
      if (conf === "high" && s.confidence < 0.85) return false;
      if (conf === "medium" && (s.confidence < 0.6 || s.confidence >= 0.85))
        return false;
      if (conf === "low" && s.confidence >= 0.6) return false;
      if (terms.length) {
        const haystack = [
          s.from,
          s.to,
          s.reason,
          s.groupLabel ?? "",
          KIND_LABELS[s.kind],
          ...s.tags,
        ]
          .join(" ")
          .toLowerCase();
        if (!terms.every((t) => haystack.includes(t))) return false;
      }
      return true;
    });
    if (!sort.key) return filtered;
    const mul = sort.dir === "asc" ? 1 : -1;
    const cmp = {
      kind: (a: Suggestion, b: Suggestion) =>
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
      name: (a: Suggestion, b: Suggestion) => {
        const an = splitPath(a.from);
        const bn = splitPath(b.from);
        return (
          an.name.localeCompare(bn.name, undefined, { numeric: true }) ||
          an.dir.localeCompare(bn.dir)
        );
      },
      size: (a: Suggestion, b: Suggestion) =>
        (sizeByPath.get(a.from) ?? 0) - (sizeByPath.get(b.from) ?? 0),
      confidence: (a: Suggestion, b: Suggestion) => a.confidence - b.confidence,
    }[sort.key];
    return [...filtered].sort((a, b) => cmp(a, b) * mul);
  }, [scan, decisions, tab, query, conf, showHandled, sort, sizeByPath]);

  if (!scan) {
    return (
      <div>
        <PageHeader title="Suggestions Queue" />
        <EmptyState
          icon={<ListIcon className="h-7 w-7" />}
          title="Nothing to review yet"
          body="Run a scan first — suggestions appear here for your approval."
        >
          <Button variant="primary" onClick={() => navigate("/")}>
            Go to Scan Setup
          </Button>
        </EmptyState>
      </div>
    );
  }

  const pendingAll = scan.suggestions.filter((s) => !decisions[s.id]);
  const highConfidence = pendingAll.filter((s) => s.confidence >= 0.85);
  const approvedCount = scan.suggestions.filter(
    (s) => decisions[s.id] === "approved",
  ).length;
  const selectedIds = rows.filter((r) => selection[r.id]).map((r) => r.id);
  const counts = {
    all: pendingAll.length,
    rename: pendingAll.filter((s) => s.kind === "rename").length,
    duplicate: pendingAll.filter((s) => s.kind === "duplicate").length,
    merge: pendingAll.filter((s) => s.kind === "merge").length,
    move: pendingAll.filter((s) => s.kind === "move").length,
  };
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  const tabs: Array<{ key: Tab; label: string; count: number }> = [
    { key: "all", label: "All", count: counts.all },
    { key: "rename", label: "Renames", count: counts.rename },
    { key: "duplicate", label: "Duplicates", count: counts.duplicate },
    { key: "merge", label: "Merges", count: counts.merge },
    { key: "move", label: "Moves", count: counts.move },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title="Suggestions Queue"
        subtitle="Every row is a proposal. Approve individually, in bulk, or by confidence."
      >
        {highConfidence.length > 0 && (
          <Button
            onClick={() =>
              decide(
                highConfidence.map((s) => s.id),
                "approved",
              )
            }
          >
            <CheckSquareIcon className="h-3.5 w-3.5" /> Approve all
            high-confidence ({highConfidence.length})
          </Button>
        )}
        <Button
          variant="primary"
          disabled={!approvedCount}
          onClick={() => navigate("/review")}
        >
          Review approved <ArrowRightIcon className="h-3.5 w-3.5" />
        </Button>
      </PageHeader>
      <TrustBanner />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-md border border-line bg-panel">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`border-l border-line px-3 py-1.5 text-xs font-medium first:border-l-0 ${
                tab === t.key
                  ? "bg-brand-50 text-brand-800"
                  : "bg-panel text-ink-2 hover:bg-surface"
              }`}
            >
              {t.label} <span className="tnum ml-1 text-ink-3">{t.count}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input
            className={`${inputCls} w-64 font-mono text-xs`}
            placeholder="Search paths, reasons, tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className={`${inputCls} w-32`}
            value={conf}
            onChange={(e) => setConf(e.target.value as ConfFilter)}
          >
            <option value="all">All confidence</option>
            <option value="high">High ≥ 85%</option>
            <option value="medium">Medium</option>
            <option value="low">Low &lt; 60%</option>
          </select>
          <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-ink-2">
            <Checkbox
              checked={showHandled}
              onChange={setShowHandled}
            />
            Show handled
          </label>
          {(query.trim() || conf !== "all") && (
            <span className="tnum whitespace-nowrap text-xs text-ink-3">
              {rows.length} of {scan.suggestions.length} shown
            </span>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ListIcon className="h-7 w-7" />}
          title="No suggestions match"
          body={
            pendingAll.length === 0
              ? "All caught up — every suggestion has been handled."
              : "Try clearing the filters."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-panel">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line bg-panel text-left text-xs text-ink-2">
                <th className="w-8 px-3 py-2">
                  <Checkbox
                    checked={allSelected}
                    onChange={(checked) =>
                      selectMany(
                        rows.map((r) => r.id),
                        checked,
                      )
                    }
                    aria-label="Select all"
                  />
                </th>
                <SortHeader
                  label="Kind"
                  sortKey="kind"
                  sort={sort}
                  onSort={cycleSort}
                  th="w-20 px-2 py-2 font-medium"
                />
                <SortHeader
                  label="Current file"
                  sortKey="name"
                  sort={sort}
                  onSort={cycleSort}
                  th="px-2 py-2 font-medium"
                />
                <th className="px-2 py-2 font-medium">Proposed</th>
                <SortHeader
                  label="Size"
                  sortKey="size"
                  sort={sort}
                  onSort={cycleSort}
                  th="w-20 px-2 py-2 text-right font-medium"
                />
                <SortHeader
                  label="Confidence"
                  sortKey="confidence"
                  sort={sort}
                  onSort={cycleSort}
                  th="w-28 px-2 py-2 font-medium"
                />
                <th className="px-2 py-2 font-medium">Why</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const d = decisions[s.id];
                const from = splitPath(s.from);
                return (
                  <tr
                    key={s.id}
                    className={`border-b border-line/60 last:border-b-0 ${d ? "opacity-45" : "hover:bg-surface/60"}`}
                  >
                    <td className="px-3 py-2 align-top">
                      <Checkbox
                        checked={!!selection[s.id]}
                        disabled={!!d}
                        onChange={() => toggleSelect(s.id)}
                        aria-label="Select row"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Chip tone={KIND_TONES[s.kind]}>
                        {KIND_LABELS[s.kind]}
                      </Chip>
                      {d && (
                        <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-ink-3">
                          {d}
                        </div>
                      )}
                    </td>
                    <td className="max-w-[280px] px-2 py-2 align-top">
                      <div
                        className="truncate font-mono text-xs text-ink-3"
                        title={from.dir}
                      >
                        {from.dir}
                      </div>
                      <div
                        className="truncate font-mono text-xs font-medium text-ink"
                        title={s.from}
                      >
                        {from.name}
                      </div>
                    </td>
                    <td
                      className="tnum w-20 px-2 py-2 text-right align-top text-xs text-ink-2"
                      title={`${sizeByPath.get(s.from) ?? 0} bytes`}
                    >
                      {formatBytes(sizeByPath.get(s.from) ?? 0)}
                    </td>
                    <td className="max-w-[280px] px-2 py-2 align-top">
                      <ProposedCell s={s} />
                      {s.kind === "duplicate" && s.keepPath && (
                        <div
                          className="mt-0.5 truncate font-mono text-[11px] text-ink-3"
                          title={s.keepPath}
                        >
                          keep: {splitPath(s.keepPath).name}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <ConfidenceChip value={s.confidence} />
                    </td>
                    <td className="max-w-[240px] px-2 py-2 align-top">
                      <div
                        className="truncate text-xs text-ink-2"
                        title={s.reason}
                      >
                        {s.reason}
                      </div>
                      {s.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {s.tags.slice(0, 3).map((t) => (
                            <Chip key={t} className="px-1! py-0! text-[10px]">
                              {t}
                            </Chip>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="fixed bottom-0 left-[224px] right-0 z-40 border-t border-line bg-panel/95 px-7 py-2.5 shadow-[0_-4px_12px_rgba(23,32,43,0.05)] backdrop-blur">
          <div className="flex w-full items-center justify-between gap-3 max-w-[1120px] mx-auto">
            <span className="tnum text-[13px] font-medium text-ink">
              {selectedIds.length} selected
            </span>
            <Button
              variant="primary"
              sm
              onClick={() => decide(selectedIds, "approved")}
            >
              <CheckSquareIcon className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button sm onClick={() => decide(selectedIds, "dismissed")}>
              Dismiss
            </Button>
            <Button variant="ghost" sm onClick={clearSelection}>
              Clear
            </Button>
            <span className="ml-auto text-xs text-ink-3">
              Approved rows go to Review &amp; Approve — nothing is applied yet.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
