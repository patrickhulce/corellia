import { useFloorplan } from '../context/FloorplanContext'

export function ScaleControl() {
  const { state, dispatch } = useFloorplan()
  const { unit } = state

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[var(--text)]">Unit</label>
        <div className="flex gap-2">
          {['ft', 'm'].map((u) => (
            <button
              key={u}
              onClick={() => dispatch({ type: 'SET_UNIT', unit: u })}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                unit === u
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--social-bg)] text-[var(--text-h)] hover:bg-[var(--accent-bg)]'
              }`}
            >
              {u === 'ft' ? 'Feet' : 'Meters'}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-[var(--text)] opacity-60">
        Scroll to zoom · Middle-drag to pan
      </p>
    </div>
  )
}
