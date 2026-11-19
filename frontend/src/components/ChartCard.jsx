import { useState } from 'react'
import { BarChart3, Table2 } from 'lucide-react'
import EmptyState from './EmptyState'
import { Skeleton } from './LoadingSpinner'
import { ErrorState } from './ui'

/**
 * A chart sheet with a built-in table view (every chart's numbers stay readable
 * without colour), plus loading, error and empty states.
 * table: { columns: [{ key, label, align? }], rows: [{...}] }
 */
export default function ChartCard({ title, description, loading, error, onRetry, empty, emptyText = 'No data for this selection.', table, legend, children, className = '', height = 'h-64' }) {
  const [asTable, setAsTable] = useState(false)
  return (
    <section className={`sheet flex flex-col ${className}`}>
      <div className="sheet-head items-start">
        <div className="min-w-0">
          <h3 className="sheet-title">{title}</h3>
          {description && <p className="sheet-sub mt-0.5">{description}</p>}
        </div>
        {table && !loading && !error && !empty && (
          <button type="button" onClick={() => setAsTable((v) => !v)} className="btn-ghost btn-sm shrink-0 no-print" aria-pressed={asTable}>
            {asTable ? <BarChart3 className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
            {asTable ? 'Chart' : 'Table'}
          </button>
        )}
      </div>
      <div className="px-5 pb-5 flex-1">
        {loading ? (
          <Skeleton className={height} />
        ) : error ? (
          <ErrorState compact message={error} onRetry={onRetry} />
        ) : empty ? (
          <EmptyState compact icon={BarChart3} title="Nothing to chart" description={emptyText} />
        ) : asTable && table ? (
          <div className="overflow-x-auto max-h-80 rounded-panel border border-line relative">
            <table className="tbl text-sm">
              <thead>
                <tr>
                  {table.columns.map((c) => (
                    <th key={c.key} className={c.align === 'right' ? 'text-right' : ''}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i}>
                    {table.columns.map((c) => (
                      <td key={c.key} className={`!py-2 ${c.align === 'right' ? 'text-right tabular' : ''}`}>
                        {r[c.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            {legend && <div className="mb-3">{legend}</div>}
            <div className={height}>{children}</div>
          </>
        )}
      </div>
    </section>
  )
}
