import { useState } from 'react'
import { formatDateTime } from '../../../shared/format'
import type { Batch } from '../../../shared/types'
import { ChevronDownIcon, ChevronRightIcon, ClockIcon, UndoIcon } from '../components/icons'
import { Button, Chip, ConfirmButton, EmptyState, PageHeader, TrustBanner } from '../components/ui'
import { useStore } from '../store'

function StatusChip({ status }: { status: Batch['status'] | 'ok' | 'error' | 'undone' }) {
  const map: Record<string, { tone: 'ok' | 'warn' | 'bad' | 'neutral'; label: string }> = {
    applied: { tone: 'ok', label: 'Applied' },
    undone: { tone: 'neutral', label: 'Undone' },
    partial: { tone: 'warn', label: 'Partial' },
    ok: { tone: 'ok', label: 'Done' },
    error: { tone: 'bad', label: 'Failed' }
  }
  const { tone, label } = map[status]
  return <Chip tone={tone}>{label}</Chip>
}

function BatchCard({ batch }: { batch: Batch }) {
  const undoBatch = useStore((s) => s.undoBatch)
  const [open, setOpen] = useState(false)
  const errors = batch.ops.filter((o) => o.status === 'error').length
  const canUndo = batch.status === 'applied' || batch.status === 'partial'

  return (
    <section className="overflow-hidden rounded-lg border border-line bg-panel">
      <header className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setOpen(!open)} className="text-ink-3 hover:text-ink" aria-label={open ? 'Collapse' : 'Expand'}>
          {open ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-ink">{batch.label}</div>
          <div className="tnum mt-0.5 text-xs text-ink-3">
            {formatDateTime(batch.appliedAt)} · {batch.ops.length} operation{batch.ops.length === 1 ? '' : 's'}
            {errors > 0 && ` · ${errors} failed`}
          </div>
        </div>
        <StatusChip status={batch.status} />
        {canUndo && (
          <ConfirmButton
            onConfirm={() => void undoBatch(batch.id)}
            label={
              <>
                <UndoIcon className="h-3.5 w-3.5" /> Undo batch
              </>
            }
            confirmLabel="Confirm undo"
            variant="secondary"
          />
        )}
      </header>
      {open && (
        <div className="border-t border-line bg-surface/40 px-4 py-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-ink-2">
                <th className="w-16 pb-1 font-medium">Op</th>
                <th className="pb-1 font-medium">From → To</th>
                <th className="w-20 pb-1 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {batch.ops.map((op, i) => (
                <tr key={i} className="align-top">
                  <td className="pb-1.5 pr-2 text-ink-2">{op.kind}</td>
                  <td className="pb-1.5 pr-2">
                    <div className="truncate font-mono text-ink" title={op.from}>
                      {op.from}
                    </div>
                    <div className="truncate font-mono text-ink-2" title={op.to}>
                      → {op.to}
                    </div>
                    {op.error && <div className="mt-0.5 text-bad-600">{op.error}</div>}
                  </td>
                  <td className="pb-1.5 text-right">
                    <StatusChip status={op.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function HistoryPage() {
  const history = useStore((s) => s.history)

  return (
    <div>
      <PageHeader
        title="History & Undo"
        subtitle="Every applied change is logged here as a batch. Undo restores the exact previous state."
      />
      <TrustBanner>
        Undo moves files back to their original locations, last operation first. If a name is taken, the file returns
        alongside it with a “(restored)” suffix — nothing is ever lost.
      </TrustBanner>

      {history.length === 0 ? (
        <EmptyState
          icon={<ClockIcon className="h-7 w-7" />}
          title="No changes applied yet"
          body="Applied batches appear here with a full operation log and one-click rollback."
        />
      ) : (
        <div className="space-y-3">
          {history.map((b) => (
            <BatchCard key={b.id} batch={b} />
          ))}
        </div>
      )}
    </div>
  )
}
