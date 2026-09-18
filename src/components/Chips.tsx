import type { ChipValue } from '../lib/games'
import { CHIP_VALUES } from '../lib/games'

const CHIP_STYLE: Record<number, { bg: string; edge: string }> = {
  10: { bg: '#3b82f6', edge: '#93c5fd' },
  25: { bg: '#22c55e', edge: '#86efac' },
  50: { bg: '#ef4444', edge: '#fca5a5' },
  100: { bg: '#111827', edge: '#f9a8d4' },
  250: { bg: '#a855f7', edge: '#e9d5ff' },
  500: { bg: '#ec4899', edge: '#fbcfe8' },
  1000: { bg: '#f59e0b', edge: '#fde68a' },
  10000: { bg: '#f0abfc', edge: '#ffffff' },
}

export function Chip({
  value,
  selected,
  onClick,
  size = 44,
  stacked,
}: {
  value: ChipValue | number
  selected?: boolean
  onClick?: () => void
  size?: number
  stacked?: number
}) {
  const style = CHIP_STYLE[value] ?? CHIP_STYLE[100]!
  const label = value >= 1000 ? `${value / 1000}k` : String(value)
  return (
    <button
      type="button"
      className={`chip-token ${selected ? 'selected' : ''}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 30%, ${style.edge}, ${style.bg} 55%, #0a0a0c 120%)`,
        boxShadow: selected
          ? `0 0 0 2px #fff, 0 0 18px ${style.edge}`
          : `0 4px 10px rgba(0,0,0,.45), inset 0 0 0 3px ${style.edge}55`,
      }}
      onClick={onClick}
      title={`${value} LC`}
    >
      <span>{label}</span>
      {stacked && stacked > 1 && <em className="chip-stack-count">×{stacked}</em>}
    </button>
  )
}

export function ChipTray({
  selected,
  onSelect,
  disabled,
}: {
  selected: ChipValue
  onSelect: (v: ChipValue) => void
  disabled?: boolean
}) {
  return (
    <div className={`chip-tray ${disabled ? 'disabled' : ''}`}>
      {CHIP_VALUES.map((v) => (
        <Chip key={v} value={v} selected={selected === v} onClick={() => !disabled && onSelect(v)} />
      ))}
    </div>
  )
}

export function StackedChips({ amount, size = 28 }: { amount: number; size?: number }) {
  if (amount <= 0) return null
  const chips: number[] = []
  let left = amount
  for (const v of [...CHIP_VALUES].reverse()) {
    while (left >= v && chips.length < 5) {
      chips.push(v)
      left -= v
    }
  }
  if (chips.length === 0) chips.push(CHIP_VALUES[0]!)
  return (
    <div className="chip-stack" style={{ width: size, height: size + (chips.length - 1) * 4 }}>
      {chips.map((v, i) => (
        <div
          key={`${v}-${i}`}
          className="chip-stack-item"
          style={{
            width: size,
            height: size,
            bottom: i * 4,
            background: CHIP_STYLE[v]?.bg ?? '#111',
            borderColor: CHIP_STYLE[v]?.edge ?? '#fff',
            zIndex: i + 1,
          }}
        >
          {v >= 1000 ? `${v / 1000}k` : v}
        </div>
      ))}
      <span className="chip-stack-total">{amount}</span>
    </div>
  )
}
