import { TYPE_COLORS } from '../constants/roomTypes'

const FT_TO_M = 0.3048

export function RoomRect({ room, isSelected, pixelsPerUnit, unit, onPointerDown }) {
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

  return (
    <g
      className="cursor-grab active:cursor-grabbing select-none"
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
            fontSize={Math.min(13, w / room.name.length * 1.4)}
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
    </g>
  )
}
