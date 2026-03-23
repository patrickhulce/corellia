import { TYPE_COLORS } from '../constants/roomTypes'

const FT_TO_M = 0.3048

const EDGE_HANDLES = [
  { dir: 'n', cursor: 'n-resize' },
  { dir: 's', cursor: 's-resize' },
  { dir: 'w', cursor: 'w-resize' },
  { dir: 'e', cursor: 'e-resize' },
]

const CORNER_HANDLES = [
  { dir: 'nw', cursor: 'nw-resize' },
  { dir: 'ne', cursor: 'ne-resize' },
  { dir: 'sw', cursor: 'sw-resize' },
  { dir: 'se', cursor: 'se-resize' },
]

function edgeRect(dir, x, y, w, h) {
  switch (dir) {
    case 'n': return { x, y: y - 4, width: w, height: 8 }
    case 's': return { x, y: y + h - 4, width: w, height: 8 }
    case 'w': return { x: x - 4, y, width: 8, height: h }
    case 'e': return { x: x + w - 4, y, width: 8, height: h }
  }
}

function cornerPos(dir, x, y, w, h) {
  switch (dir) {
    case 'nw': return { x: x - 4, y: y - 4 }
    case 'ne': return { x: x + w - 4, y: y - 4 }
    case 'sw': return { x: x - 4, y: y + h - 4 }
    case 'se': return { x: x + w - 4, y: y + h - 4 }
  }
}

export function RoomRect({ room, isSelected, pixelsPerUnit, unit, onPointerDown, onResizeStart, onDoubleClick }) {
  const ppu = pixelsPerUnit
  const x = room.x * ppu
  const y = room.y * ppu
  const w = room.widthFt * ppu
  const h = room.heightFt * ppu

  const colors = TYPE_COLORS[room.type] ?? TYPE_COLORS.other

  const displayW = unit === 'm' ? (room.widthFt * FT_TO_M).toFixed(1) : room.widthFt
  const displayH = unit === 'm' ? (room.heightFt * FT_TO_M).toFixed(1) : room.heightFt
  const dimsLabel = `${displayW} × ${displayH} ${unit}`

  const cx = x + w / 2
  const cy = y + h / 2

  const showHandles = isSelected && onResizeStart

  return (
    <g
      className="select-none"
      style={{ cursor: 'grab' }}
      onPointerDown={(e) => onPointerDown(e, room)}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(room) }}
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={colors.fill}
        stroke={isSelected ? 'var(--accent)' : colors.stroke}
        strokeWidth={isSelected ? 2.5 : 1.5}
        rx={2}
      />
      {w > 30 && h > 20 && (() => {
        const nameFontSize = Math.min(11, (w / room.name.length) * 1.4)
        const dimsFontSize = 9
        const nameY = cy - (h > 40 ? 8 : 0)
        const padX = 4
        const padY = 2
        const nameW = room.name.length * nameFontSize * 0.6 + padX * 2
        const nameH = nameFontSize + padY * 2
        return (
          <>
            <rect
              x={cx - nameW / 2}
              y={nameY - nameH / 2}
              width={nameW}
              height={nameH}
              rx={3}
              fill={colors.stroke}
              opacity={0.85}
              style={{ pointerEvents: 'none' }}
            />
            <text
              x={cx}
              y={nameY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={nameFontSize}
              fontWeight="600"
              fill="white"
              style={{ pointerEvents: 'none' }}
            >
              {room.name}
            </text>
            {h > 40 && (() => {
              const dimsW = dimsLabel.length * dimsFontSize * 0.6 + padX * 2
              const dimsH = dimsFontSize + padY * 2
              return (
                <>
                  <rect
                    x={cx - dimsW / 2}
                    y={cy + 10 - dimsH / 2}
                    width={dimsW}
                    height={dimsH}
                    rx={3}
                    fill={colors.stroke}
                    opacity={0.85}
                    style={{ pointerEvents: 'none' }}
                  />
                  <text
                    x={cx}
                    y={cy + 10}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={dimsFontSize}
                    fill="white"
                    opacity={0.95}
                    style={{ pointerEvents: 'none' }}
                  >
                    {dimsLabel}
                  </text>
                </>
              )
            })()}
          </>
        )
      })()}

      {showHandles && (
        <>
          {/* Edge handles — rendered first so corners sit on top */}
          {EDGE_HANDLES.map(({ dir, cursor }) => {
            const r = edgeRect(dir, x, y, w, h)
            return (
              <rect
                key={dir}
                {...r}
                fill="transparent"
                style={{ cursor }}
                onPointerDown={(e) => { e.stopPropagation(); onResizeStart(e, room, dir) }}
              />
            )
          })}

          {/* Corner handles */}
          {CORNER_HANDLES.map(({ dir, cursor }) => {
            const pos = cornerPos(dir, x, y, w, h)
            return (
              <rect
                key={dir}
                x={pos.x}
                y={pos.y}
                width={8}
                height={8}
                fill="var(--accent)"
                stroke="white"
                strokeWidth={1}
                rx={1}
                style={{ cursor }}
                onPointerDown={(e) => { e.stopPropagation(); onResizeStart(e, room, dir) }}
              />
            )
          })}
        </>
      )}
    </g>
  )
}
