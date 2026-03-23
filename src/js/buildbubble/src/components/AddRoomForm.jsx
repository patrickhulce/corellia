import { useState, useCallback } from 'react'
import { useFloorplan } from '../context/FloorplanContext'
import { ROOM_TYPE_OPTIONS, DEFAULT_DIMENSIONS, TYPE_COLORS } from '../constants/roomTypes'

export function AddRoomForm() {
  const { state, dispatch } = useFloorplan()
  const { rooms, gridCols } = state
  const [batch, setBatch] = useState({}) // { type: count }

  const handleTypeClick = (typeValue) => {
    setBatch((prev) => ({
      ...prev,
      [typeValue]: (prev[typeValue] || 0) + 1,
    }))
  }

  const handleRemoveType = (typeValue) => {
    setBatch((prev) => {
      const newBatch = { ...prev }
      delete newBatch[typeValue]
      return newBatch
    })
  }

  const generateRoomName = useCallback((typeValue) => {
    const typeLabel = ROOM_TYPE_OPTIONS.find((o) => o.value === typeValue)?.label ?? 'Room'
    const usedNums = rooms
      .filter((r) => r.type === typeValue)
      .map((r) => r.name.match(new RegExp(`^${typeLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)$`)))
      .filter(Boolean)
      .map((m) => Number(m[1]))
    const nextNum = usedNums.length > 0 ? Math.max(...usedNums) + 1 : 1
    return `${typeLabel} ${nextNum}`
  }, [rooms])

  const handleAddAll = () => {
    let currentX = 5
    let currentY = 5
    let rowMaxHeight = 0
    let currentNum = {}

    Object.entries(batch).forEach(([typeValue, count]) => {
      const dims = DEFAULT_DIMENSIONS[typeValue] ?? DEFAULT_DIMENSIONS.other

      for (let i = 0; i < count; i++) {
        // Wrap to next row if room would exceed canvas width
        if (currentX + dims.widthFt > gridCols - 5) {
          currentX = 5
          currentY += rowMaxHeight + 1
          rowMaxHeight = 0
        }

        // Track sequential numbering within this batch
        currentNum[typeValue] = (currentNum[typeValue] || 0) + 1

        const typeLabel = ROOM_TYPE_OPTIONS.find((o) => o.value === typeValue)?.label ?? 'Room'
        const usedNums = rooms
          .filter((r) => r.type === typeValue)
          .map((r) => r.name.match(new RegExp(`^${typeLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)$`)))
          .filter(Boolean)
          .map((m) => Number(m[1]))
        const baseNum = usedNums.length > 0 ? Math.max(...usedNums) : 0
        const roomNum = baseNum + currentNum[typeValue]

        dispatch({
          type: 'ADD_ROOM',
          room: {
            id: crypto.randomUUID(),
            name: `${typeLabel} ${roomNum}`,
            type: typeValue,
            widthFt: dims.widthFt,
            heightFt: dims.heightFt,
            x: Math.max(0, Math.min(currentX, gridCols - dims.widthFt)),
            y: currentY,
            ceilingHeightFt: state.defaultCeilingHeightFt ?? 9,
          },
        })

        rowMaxHeight = Math.max(rowMaxHeight, dims.heightFt)
        currentX += dims.widthFt + 1
      }
    })

    setBatch({})
  }

  const totalCount = Object.values(batch).reduce((sum, count) => sum + count, 0)
  const hasItems = totalCount > 0

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-1.5">
        {ROOM_TYPE_OPTIONS.map((option) => {
          const colors = TYPE_COLORS[option.value] ?? TYPE_COLORS.other
          const dims = DEFAULT_DIMENSIONS[option.value] ?? DEFAULT_DIMENSIONS.other
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleTypeClick(option.value)}
              className="px-2 py-1.5 rounded-md text-xs font-bold text-center cursor-pointer transition-all hover:brightness-90 active:scale-95"
              style={{ backgroundColor: colors.pillBg, color: '#fff' }}
              title={`${option.label} (${dims.widthFt}×${dims.heightFt} ft)`}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {hasItems && (
        <>
          <div className="border-t border-[var(--border)] pt-3">
            <div className="text-xs font-medium text-[var(--text)] mb-2">Selected ({totalCount})</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(batch).map(([typeValue, count]) => {
                const label = ROOM_TYPE_OPTIONS.find((o) => o.value === typeValue)?.label ?? 'Room'
                const colors = TYPE_COLORS[typeValue] ?? TYPE_COLORS.other
                return (
                  <div
                    key={typeValue}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs"
                    style={{ background: colors.fill, color: colors.stroke, border: `1px solid ${colors.stroke}` }}
                  >
                    <span className="font-medium">
                      {label} ({count})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveType(typeValue)}
                      className="text-current hover:opacity-70 transition-opacity"
                      title="Remove from batch"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          <button type="button" onClick={handleAddAll} className="btn-primary">
            Add All ({totalCount})
          </button>
        </>
      )}
    </div>
  )
}
