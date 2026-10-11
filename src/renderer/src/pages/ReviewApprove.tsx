import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { diffStrings } from "../../../shared/naming";
import type { Suggestion, SuggestionKind } from "../../../shared/types";
import {
  ArrowRightIcon,
  CheckSquareIcon,
  ShieldIcon,
} from "../components/icons";
import {
  Button,
  Checkbox,
  Chip,
  ConfidenceChip,
  EmptyState,
  PageHeader,
  TrustBanner,
} from "../components/ui";
import { useStore } from "../store";

const KIND_ORDER: SuggestionKind[] = ["rename", "duplicate", "merge", "move"];
const KIND_LABELS: Record<SuggestionKind, string> = {
  rename: "Rename",
  duplicate: "Archive duplicates",
  merge: "Merge into folders",
  move: "Organize into folders",
};

function PathDiff({
  oldPath,
  newPath,
  tone,
}: {
  oldPath: string;
  newPath: string;
  tone: "old" | "new";
}) {
  const { pre, midA, midB, post } = diffStrings(oldPath, newPath);
  const mid = tone === "old" ? midA : midB;
  const markCls =
    tone === "old"
      ? "bg-bad-100 text-bad-700 rounded px-0.5"
      : "bg-ok-100 text-ok-700 rounded px-0.5";
  return (
    <span className="break-all font-mono text-xs">
      <span className="text-ink-3">{pre}</span>
      <span
        className={
          mid ? markCls : tone === "old" ? "text-ink" : "text-ink font-medium"
        }
      >
        {mid}
      </span>
      <span className="text-ink-3">{post}</span>
    </span>
  );
}

function DiffRow({
  s,
  included,
  onToggle,
}: {
  s: Suggestion;
  included: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`flex gap-3 px-4 py-2.5 ${included ? "" : "opacity-40"}`}>
      <Checkbox
        checked={included}
        onChange={onToggle}
        aria-label="Include this change"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="w-3 shrink-0 font-mono text-xs font-semibold text-bad-600">
            −
          </span>
          <PathDiff oldPath={s.from} newPath={s.to} tone="old" />
        </div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="w-3 shrink-0 font-mono text-xs font-semibold text-ok-600">
            +
          </span>
          <PathDiff oldPath={s.from} newPath={s.to} tone="new" />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-5">
          <ConfidenceChip value={s.confidence} />
          {s.tags.map((t) => (
            <Chip key={t} className="px-1! py-0! text-[10px]">
              {t}
            </Chip>
          ))}
          <span className="text-xs text-ink-3">{s.detail ?? s.reason}</span>
        </div>
      </div>
    </div>
  );
}

interface Section {
  key: string;
  title: string;
  meta?: string;
  items: Suggestion[];
}

export default function ReviewApprove() {
  const navigate = useNavigate();
  const scan = useStore((s) => s.scan);
  const decisions = useStore((s) => s.decisions);
  const applyApproved = useStore((s) => s.applyApproved);
  const [excluded, setExcluded] = useState<Record<string, true>>({});

  const sections = useMemo<Section[]>(() => {
    if (!scan) return [];
    const approved = scan.suggestions.filter(
      (s) => decisions[s.id] === "approved",
    );
    const out: Section[] = [];
    for (const kind of KIND_ORDER) {
      const kindRows = approved.filter((s) => s.kind === kind);
      if (!kindRows.length) continue;
      if (kind === "rename") {
        out.push({
          key: kind,
          title: `Rename — ${kindRows.length} file${kindRows.length > 1 ? "s" : ""}`,
          items: kindRows,
        });
      } else {
        const groups = new Map<string, Suggestion[]>();
        for (const s of kindRows) {
          const g = s.groupId ?? "ungrouped";
          const arr = groups.get(g) ?? [];
          arr.push(s);
          groups.set(g, arr);
        }
        let i = 1;
        for (const [, rows] of groups) {
          out.push({
            key: `${kind}-${i++}`,
            title: rows[0].groupLabel ?? KIND_LABELS[kind],
            meta:
              kind === "duplicate"
                ? "Moved to _Duplicates/ — never deleted"
                : undefined,
            items: rows,
          });
        }
      }
    }
    return out;
  }, [scan, decisions]);

  if (!scan) {
    return (
      <div>
        <PageHeader title="Review & Approve" />
        <EmptyState
          icon={<CheckSquareIcon className="h-7 w-7" />}
          title="No scan to review"
          body="Approve suggestions from the queue first."
        >
          <Button variant="primary" onClick={() => navigate("/queue")}>
            Open Suggestions Queue
          </Button>
        </EmptyState>
      </div>
    );
  }

  const approved = scan.suggestions.filter(
    (s) => decisions[s.id] === "approved",
  );
  const includedRows = approved.filter((s) => !excluded[s.id]);
  const renameCount = includedRows.filter((s) => s.kind === "rename").length;
  const moveCount = includedRows.length - renameCount;

  const apply = async (): Promise<void> => {
    const n = await applyApproved();
    if (n > 0) navigate("/history");
  };

  return (
    <div className="pb-20">
      <PageHeader
        title="Review & Approve"
        subtitle="Before/after for every approved change. Uncheck anything you want to leave out."
      />

      {approved.length === 0 ? (
        <EmptyState
          icon={<CheckSquareIcon className="h-7 w-7" />}
          title="Nothing approved yet"
          body="Approve suggestions in the queue — they will show up here as a before/after diff."
        >
          <Button variant="primary" onClick={() => navigate("/queue")}>
            Open Suggestions Queue
          </Button>
        </EmptyState>
      ) : (
        <>
          <TrustBanner>
            <span className="font-medium">
              Nothing changes until you approve.
            </span>{" "}
            This is the final step — files are renamed or moved only when you
            press Apply, and every change stays reversible from History.
          </TrustBanner>

          <div className="space-y-4">
            {sections.map((sec) => (
              <section
                key={sec.key}
                className="overflow-hidden rounded-lg border border-line bg-panel"
              >
                <header className="flex items-center justify-between gap-3 border-b border-line bg-surface/50 px-4 py-2">
                  <h2 className="text-[13px] font-semibold text-ink">
                    {sec.title}
                  </h2>
                  {sec.meta && (
                    <span className="text-xs text-ink-3">{sec.meta}</span>
                  )}
                </header>
                <div className="divide-y divide-line/70">
                  {sec.items.map((s) => (
                    <DiffRow
                      key={s.id}
                      s={s}
                      included={!excluded[s.id]}
                      onToggle={() =>
                        setExcluded((prev) => {
                          const next = { ...prev };
                          if (next[s.id]) delete next[s.id];
                          else next[s.id] = true;
                          return next;
                        })
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="fixed bottom-0 left-[224px] right-0 z-40 border-t border-line bg-panel/95 px-7 py-3 shadow-[0_-4px_12px_rgba(23,32,43,0.05)] backdrop-blur">
            <div className="flex w-full items-center justify-between gap-3 max-w-[1120px] mx-auto">
              <span className="tnum text-[13px] text-ink">
                <b>{renameCount}</b> rename{renameCount === 1 ? "" : "s"} ·{" "}
                <b>{moveCount}</b> move
                {moveCount === 1 ? "" : "s"}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-ink-3">
                <ShieldIcon className="h-3.5 w-3.5" /> No deletions — originals
                stay recoverable
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setExcluded({})}
                  disabled={Object.keys(excluded).length === 0}
                >
                  Reset exclusions
                </Button>
                <Button
                  variant="primary"
                  disabled={!includedRows.length}
                  onClick={() => void apply()}
                >
                  Apply {includedRows.length} change
                  {includedRows.length === 1 ? "" : "s"}
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
