import { useFloorplan } from '../context/FloorplanContext'

export function ScaleControl() {
  const { state, dispatch } = useFloorplan()
  const { pixelsPerUnit, unit } = state

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-center">
          <label className="text-xs font-medium text-[var(--text)]">Zoom</label>
          <span className="text-xs text-[var(--text)]">{pixelsPerUnit}px/{unit}</span>
        </div>
        <input
          type="range"
          min="20"
          max="80"
          step="5"
          value={pixelsPerUnit}
          onChange={(e) => dispatch({ type: 'SET_PIXELS_PER_UNIT', value: Number(e.target.value) })}
          className="w-full accent-[var(--accent)]"
        />
      </div>

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
    </div>
  )
}
