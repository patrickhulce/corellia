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

export function RoomRect({ room, isSelected, pixelsPerUnit, unit, onPointerDown, onResizeStart }) {
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
      {w > 30 && h > 20 && (
        <>
          <text
            x={cx}
            y={cy - (h > 40 ? 8 : 0)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={Math.min(13, (w / room.name.length) * 1.4)}
            fontWeight="600"
            fill={colors.stroke}
            style={{ pointerEvents: 'none' }}
          >
            {room.name}
          </text>
          {h > 40 && (
            <text
              x={cx}
              y={cy + 10}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              fill={colors.stroke}
              opacity={0.8}
              style={{ pointerEvents: 'none' }}
            >
              {dimsLabel}
            </text>
          )}
        </>
      )}

      {showHandles && (
        <>
          {/* Edge handles — rendered first so corners sit on top */}
          {EDGE_HANDLES.map(({ dir, cursor }) => {
            const r = edgeRect(dir, x, y, w, h)
            // Skip edge if room is too narrow in that axis
            if ((dir === 'n' || dir === 's') && w < 24) return null
            if ((dir === 'w' || dir === 'e') && h < 24) return null
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
