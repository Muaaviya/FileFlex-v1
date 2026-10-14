import { useState } from "react";
import { composeName, fillIndex } from "../../../shared/naming";
import { extractSignals, withMtimeFallback } from "../../../shared/signals";
import type { Casing, NamingRule } from "../../../shared/types";
import { ChevronDownIcon, PlusIcon, TagIcon } from "../components/icons";
import {
  Button,
  Card,
  Chip,
  ConfirmButton,
  Field,
  Modal,
  PageHeader,
  Select,
  Toggle,
  inputCls,
} from "../components/ui";
import { useStore } from "../store";

const TOKENS: Array<{ token: string; desc: string }> = [
  {
    token: "{date}",
    desc: "Date found in the filename, else the modified date — 2024-03-12",
  },
  {
    token: "{type}",
    desc: "Document type keyword — invoice, receipt, scan, syllabus…",
  },
  { token: "{topic}", desc: "Remaining descriptive words from the filename" },
  { token: "{course}", desc: "Course code like BIO101" },
  { token: "{ext}", desc: "Original file extension" },
  { token: "{index}", desc: "01, 02, 03… per folder, to keep names unique" },
  { token: "{year} {month} {day}", desc: "Individual date parts" },
];

const SAMPLES: Array<[string, string]> = [
  ["Invoice Acme April", ".pdf"],
  ["scan0003", ".pdf"],
  ["Screenshot 2024-02-11 at 10.22.31 AM", ".png"],
  ["BIO101_syllabus_spring", ".pdf"],
  ["report draft (copy)", ".docx"],
];
const SAMPLE_MTIME = new Date("2026-09-08T10:00:00").getTime();

function ruleMatchesPreview(
  rule: NamingRule,
  base: string,
  ext: string,
  docType?: string,
  course?: string,
): boolean {
  if (rule.requireCourse && !course) return false;
  if (
    rule.extensions.length &&
    !rule.extensions
      .map((e) => e.replace(/^\./, "").toLowerCase())
      .includes(ext.replace(/^\./, ""))
  )
    return false;
  if (rule.docTypes.length && (!docType || !rule.docTypes.includes(docType)))
    return false;
  return true;
}

function RuleEditor({
  initial,
  onSave,
  onClose,
}: {
  initial: NamingRule | null;
  onSave: (r: NamingRule) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [pattern, setPattern] = useState(
    initial?.pattern ?? "{date}_{type}_{topic}{ext}",
  );
  const [casing, setCasing] = useState<Casing>(initial?.casing ?? "snake");
  const [extensions, setExtensions] = useState(
    initial?.extensions.join(", ") ?? "",
  );
  const [docTypes, setDocTypes] = useState(initial?.docTypes.join(", ") ?? "");
  const [requireCourse, setRequireCourse] = useState(!!initial?.requireCourse);

  const save = (): void => {
    if (!name.trim()) return;
    onSave({
      id: initial?.id ?? `rule-${Date.now()}`,
      name: name.trim(),
      enabled: initial?.enabled ?? true,
      priority: initial?.priority ?? 99,
      pattern: pattern.trim() || "{date}_{type}_{topic}{ext}",
      casing,
      extensions: extensions
        .split(/[,\s]+/)
        .map((e) => e.replace(/^\./, "").trim())
        .filter(Boolean),
      docTypes: docTypes
        .split(/[,\s]+/)
        .map((t) => t.trim())
        .filter(Boolean),
      requireCourse,
      requireDateFromName: initial?.requireDateFromName,
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? `Edit rule — ${initial.name}` : "New naming rule"}
    >
      <div className="space-y-3">
        <Field label="Rule name">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Invoices & receipts"
          />
        </Field>
        <Field
          label="Name pattern"
          hint="Tokens are replaced per file; empty tokens and double separators are cleaned up."
        >
          <input
            className={`${inputCls} font-mono text-xs`}
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
          />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {TOKENS.slice(0, 6).map((t) => (
            <button
              key={t.token}
              onClick={() => setPattern((p) => p + t.token)}
              className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-brand-700 hover:border-brand-300 hover:bg-brand-50"
            >
              {t.token}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Casing">
            <Select
              value={casing}
              onChange={(v) => setCasing(v as Casing)}
              options={[
                { value: "snake", label: "snake_case" },
                { value: "kebab", label: "kebab-case" },
                { value: "lower", label: "lowercase" },
                { value: "keep", label: "Keep original" },
              ]}
            />
          </Field>
          <Field
            label="File types (optional)"
            hint="Comma separated: pdf, docx"
          >
            <input
              className={inputCls}
              value={extensions}
              onChange={(e) => setExtensions(e.target.value)}
              placeholder="All file types"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Document types (optional)"
            hint="invoice, receipt, scan, notes…"
          >
            <input
              className={inputCls}
              value={docTypes}
              onChange={(e) => setDocTypes(e.target.value)}
              placeholder="All detected types"
            />
          </Field>
          <Field label="Scope guard">
            <label className="flex h-8 items-center gap-2 text-[13px] text-ink">
              <Toggle checked={requireCourse} onChange={setRequireCourse} />
              Only files with a course code
            </label>
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!name.trim()}>
            Save rule
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function RulesPage() {
  const rules = useStore((s) => s.rules);
  const saveRules = useStore((s) => s.saveRules);
  const resetRules = useStore((s) => s.resetRules);
  const [editing, setEditing] = useState<NamingRule | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  const active = sorted.find((r) => r.id === selected) ?? sorted[0];

  const move = (rule: NamingRule, dir: -1 | 1): void => {
    const idx = sorted.findIndex((r) => r.id === rule.id);
    const other = sorted[idx + dir];
    if (!other) return;
    const a = { ...rule, priority: other.priority };
    const b = { ...other, priority: rule.priority };
    void saveRules(
      sorted.map((r) => (r.id === a.id ? a : r.id === b.id ? b : r)),
    );
  };

  const save = (rule: NamingRule): void => {
    void saveRules(
      isNew
        ? [...rules, rule]
        : rules.map((r) => (r.id === rule.id ? rule : r)),
    );
    setSelected(rule.id);
  };

  return (
    <div>
      <PageHeader
        title="Naming Rules"
        subtitle="Templates turn messy filenames into standardized ones. Rules run top to bottom — first match wins."
      >
        <Button onClick={() => void resetRules()}>Restore defaults</Button>
        <Button
          variant="primary"
          onClick={() => {
            setIsNew(true);
            setEditing(null);
          }}
        >
          <PlusIcon className="h-3.5 w-3.5" /> New rule
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="space-y-2.5 lg:col-span-3">
          {sorted.map((rule, i) => (
            <div
              key={rule.id}
              className={`rounded-lg border bg-panel px-4 py-3 transition-colors ${
                active?.id === rule.id ? "border-brand-300" : "border-line"
              }`}
              onClick={() => setSelected(rule.id)}
            >
              <div className="flex items-center gap-2.5">
                <Toggle
                  checked={rule.enabled}
                  onChange={(v) =>
                    void saveRules(
                      rules.map((r) =>
                        r.id === rule.id ? { ...r, enabled: v } : r,
                      ),
                    )
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-semibold text-ink">
                      {rule.name}
                    </span>
                    <Chip>{i + 1}</Chip>
                    {rule.requireCourse && (
                      <Chip tone="brand">needs course code</Chip>
                    )}
                  </div>
                  <div className="mt-1 truncate font-mono text-xs text-brand-700">
                    {rule.pattern}
                  </div>
                  <div className="mt-1 text-xs text-ink-3">
                    {rule.extensions.length
                      ? `*.${rule.extensions.join(", *.")}`
                      : "All file types"}
                    {rule.docTypes.length
                      ? ` · types: ${rule.docTypes.join(", ")}`
                      : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  <Button
                    variant="ghost"
                    sm
                    disabled={i === 0}
                    onClick={() => move(rule, -1)}
                    aria-label="Move up"
                  >
                    <ChevronDownIcon className="h-3.5 w-3.5 rotate-180" />
                  </Button>
                  <Button
                    variant="ghost"
                    sm
                    disabled={i === sorted.length - 1}
                    onClick={() => move(rule, 1)}
                    aria-label="Move down"
                  >
                    <ChevronDownIcon className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    sm
                    onClick={() => {
                      setIsNew(false);
                      setEditing(rule);
                    }}
                  >
                    Edit
                  </Button>
                  <ConfirmButton
                    onConfirm={() =>
                      void saveRules(rules.filter((r) => r.id !== rule.id))
                    }
                    label="Delete"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card title="Token legend">
            <ul className="space-y-2">
              {TOKENS.map((t) => (
                <li key={t.token} className="flex gap-2 text-xs">
                  <code className="shrink-0 rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-brand-700">
                    {t.token}
                  </code>
                  <span className="text-ink-2">{t.desc}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card
            title="Live preview"
            subtitle={
              active
                ? `How “${active.name}” would rename sample files`
                : undefined
            }
          >
            {active ? (
              <table className="w-full text-xs">
                <tbody>
                  {SAMPLES.map(([base, ext], i) => {
                    const sig = extractSignals(base);
                    const full = withMtimeFallback(sig, SAMPLE_MTIME);
                    const matches = ruleMatchesPreview(
                      active,
                      base,
                      ext,
                      sig.docType,
                      sig.course,
                    );
                    const newName = matches
                      ? fillIndex(
                          composeName(active.pattern, full, active.casing, ext),
                          i + 1,
                        )
                      : null;
                    return (
                      <tr
                        key={base}
                        className="border-b border-line/60 last:border-b-0"
                      >
                        <td className="py-1.5 pr-2 font-mono text-ink-3">
                          {base}
                          {ext}
                        </td>
                        <td className="w-4 py-1.5 text-center text-ink-3">→</td>
                        <td className="py-1.5 text-right font-mono text-ink">
                          {newName ?? (
                            <span className="text-ink-3">not in scope</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="flex items-center gap-2 text-xs text-ink-3">
                <TagIcon className="h-3.5 w-3.5" /> Select a rule to preview it.
              </div>
            )}
          </Card>
        </div>
      </div>

      {(editing || isNew) && (
        <RuleEditor
          initial={editing}
          onSave={save}
          onClose={() => {
            setEditing(null);
            setIsNew(false);
          }}
        />
      )}
    </div>
  );
}
