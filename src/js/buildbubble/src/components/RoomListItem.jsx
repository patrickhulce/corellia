import { useFloorplan } from '../context/FloorplanContext'
import { TYPE_COLORS, ROOM_TYPE_OPTIONS } from '../constants/roomTypes'

const FT_TO_M = 0.3048

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

const OUTDOOR_TYPES = ['grass', 'driveway', 'patio', 'pool', 'pergola']

export function RoomListItem({ room }) {
  const { state, dispatch } = useFloorplan()
  const isSelected = state.selectedId === room.id
  const { unit } = state

  const colors = TYPE_COLORS[room.type] ?? TYPE_COLORS.other
  const label = ROOM_TYPE_OPTIONS.find((o) => o.value === room.type)?.label ?? 'Room'

  const displayW = unit === 'm' ? (room.widthFt * FT_TO_M).toFixed(1) : room.widthFt
  const displayH = unit === 'm' ? (room.heightFt * FT_TO_M).toFixed(1) : room.heightFt

  const isOutdoor = OUTDOOR_TYPES.includes(room.type)
  const ceilingFt = room.ceilingHeightFt ?? 9
  const displayCeiling = unit === 'm' ? (ceilingFt * FT_TO_M).toFixed(1) : ceilingFt

  const handleCeilingChange = (e) => {
    const val = parseFloat(e.target.value)
    if (!val || val <= 0) return
    const ft = unit === 'm' ? val / FT_TO_M : val
    dispatch({ type: 'UPDATE_ROOM', id: room.id, updates: { ceilingHeightFt: Math.round(ft * 10) / 10 } })
  }

  return (
    <div
      className={`flex flex-col px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isSelected ? 'bg-[var(--accent-bg)]' : 'hover:bg-[var(--social-bg)]'
      }`}
      onClick={() => dispatch({ type: 'SELECT_ROOM', id: room.id })}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-sm shrink-0"
          style={{ background: colors.fill, border: `1.5px solid ${colors.stroke}` }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--text-h)] truncate">{room.name}</div>
          <div className="text-xs text-[var(--text)] truncate">{label} · {displayW}×{displayH} {unit}</div>
        </div>
        <button
          className="text-[var(--text)] hover:text-red-500 transition-colors p-1 rounded cursor-pointer"
          onClick={(e) => {
            e.stopPropagation()
            dispatch({ type: 'DELETE_ROOM', id: room.id })
          }}
          title="Delete room"
        >
          <TrashIcon />
        </button>
      </div>
      {isSelected && !isOutdoor && (
        <div className="flex items-center gap-2 mt-2 ml-5">
          <label className="text-xs text-[var(--text)] whitespace-nowrap">Ceiling ({unit})</label>
          <input
            type="number"
            min="1"
            step="0.5"
            value={displayCeiling}
            onChange={handleCeilingChange}
            onClick={(e) => e.stopPropagation()}
            className="input text-xs py-1 px-2 w-20"
          />
        </div>
      )}
    </div>
  )
}
