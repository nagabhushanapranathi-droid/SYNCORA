import { useTheme } from '../context/ThemeContext'

/**
 * Chart colours per theme. Categorical slots are assigned in fixed order and were run
 * through the dataviz palette validator (lightness band, chroma floor, CVD separation,
 * normal-vision floor, contrast) against each theme's sheet surface:
 *  light  #C94653 #7A5CC0 #2B9370 #C08A12 on #FFFFFF  → all checks pass
 *  dark   #9B7FD6 #D8606E #B8891E #3E9C78 on #211C2B  → pass (slots 2–3 CVD 7.7, legends always shown)
 * Status colours (present/absent etc.) are kept separate from the categorical order.
 */
const PALETTES = {
  light: {
    series: ['#C94653', '#7A5CC0', '#2B9370', '#C08A12'],
    good: '#3E8E5F',
    critical: '#C23B4A',
    warning: '#C08A12',
    neutral: '#B7A79F',
    grid: '#F0E2D2',
    axis: '#75635F',
    surface: '#FFFFFF',
    cursor: 'rgba(81,65,63,0.06)',
  },
  dark: {
    series: ['#9B7FD6', '#D8606E', '#B8891E', '#3E9C78'],
    good: '#5DB487',
    critical: '#E0707C',
    warning: '#D3A43A',
    neutral: '#6B5E7D',
    grid: '#3A3146',
    axis: '#C2B7D0',
    surface: '#211C2B',
    cursor: 'rgba(216,201,232,0.08)',
  },
}

export function useChartTheme() {
  const { theme } = useTheme()
  const p = PALETTES[theme] || PALETTES.light
  return {
    ...p,
    theme,
    axisProps: {
      tick: { fontSize: 11, fill: p.axis, fontFamily: 'Inter, sans-serif' },
      axisLine: false,
      tickLine: false,
    },
    gridProps: { stroke: p.grid, strokeDasharray: '0', vertical: false },
  }
}

/** Themed tooltip body for Recharts (`content={<ChartTooltip />}`). */
export function ChartTooltip({ active, payload, label, formatter, labelFormatter }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-panel border border-line bg-surface shadow-pop px-3 py-2 text-sm">
      {label !== undefined && label !== '' && (
        <p className="font-semibold text-ink mb-1">{labelFormatter ? labelFormatter(label, payload) : label}</p>
      )}
      <ul className="space-y-0.5">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center gap-2 text-ink-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color || p.payload?.fill }} aria-hidden="true" />
            <span>{p.name}</span>
            <span className="ml-auto pl-3 font-semibold text-ink tabular">{formatter ? formatter(p.value, p.name, p) : p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Legend rendered as text tokens beside colour keys (never coloured text). */
export function ChartLegend({ items }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <span
            className={it.line ? 'w-4 h-0.5 rounded-full' : 'w-2.5 h-2.5 rounded-sm'}
            style={{ background: it.color }}
            aria-hidden="true"
          />
          {it.label}
        </li>
      ))}
    </ul>
  )
}
