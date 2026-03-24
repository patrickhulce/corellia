import { useFloorplan } from '../context/FloorplanContext'

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function ChevronUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  )
}

function ChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export function LevelSwitcher() {
  const { state, dispatch } = useFloorplan()
  const { rooms, activeLevel } = state

  const maxLevel = Math.max(1, ...rooms.map((r) => r.level ?? 1))
  const canGoUp = activeLevel <= maxLevel
  const canGoDown = activeLevel > 1

  return (
    <div className="absolute bottom-4 left-4 flex items-center gap-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg p-1.5 shadow-lg z-10">
      <button
        disabled={!canGoDown}
        onClick={() => dispatch({ type: 'SET_ACTIVE_LEVEL', level: activeLevel - 1 })}
        className="toolbar-btn"
        title="Go down one floor"
      >
        <ChevronDown />
      </button>
      <span className="text-xs font-medium text-[var(--text-h)] px-1.5 select-none whitespace-nowrap">
        {ordinal(activeLevel)} Floor
      </span>
      <button
        disabled={!canGoUp}
        onClick={() => dispatch({ type: 'SET_ACTIVE_LEVEL', level: activeLevel + 1 })}
        className="toolbar-btn"
        title="Go up one floor"
      >
        <ChevronUp />
      </button>
    </div>
  )
}
