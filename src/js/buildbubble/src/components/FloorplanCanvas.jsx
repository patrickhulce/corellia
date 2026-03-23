import { useRef } from 'react'
import { useFloorplan } from '../context/FloorplanContext'
import { useDrag } from '../hooks/useDrag'
import { RoomRect } from './RoomRect'

export function FloorplanCanvas() {
  const { state, dispatch } = useFloorplan()
  const { rooms, selectedId, pixelsPerUnit: ppu, gridCols, gridRows, unit } = state
  const svgRef = useRef(null)
  const { handlePointerDown } = useDrag(svgRef, dispatch)

  const svgW = gridCols * ppu
  const svgH = gridRows * ppu

  return (
    <div className="flex-1 overflow-auto bg-[var(--bg)]">
      <svg
        ref={svgRef}
        width={svgW}
        height={svgH}
        data-ppu={ppu}
        data-cols={gridCols}
        data-rows={gridRows}
        style={{ display: 'block' }}
        onPointerDown={(e) => {
          if (e.target === svgRef.current || e.target.tagName === 'rect' && e.target.getAttribute('fill') === 'url(#grid)') {
            dispatch({ type: 'DESELECT' })
          }
        }}
      >
        <defs>
          <pattern id="grid-minor" width={ppu} height={ppu} patternUnits="userSpaceOnUse">
            <path
              d={`M ${ppu} 0 L 0 0 0 ${ppu}`}
              fill="none"
              stroke="var(--border)"
              strokeWidth="0.5"
            />
          </pattern>
          <pattern id="grid-major" width={ppu * 5} height={ppu * 5} patternUnits="userSpaceOnUse">
            <rect width={ppu * 5} height={ppu * 5} fill="url(#grid-minor)" />
            <path
              d={`M ${ppu * 5} 0 L 0 0 0 ${ppu * 5}`}
              fill="none"
              stroke="var(--border)"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        {/* Background */}
        <rect width={svgW} height={svgH} fill="var(--bg)" />
        {/* Grid */}
        <rect
          width={svgW}
          height={svgH}
          fill="url(#grid-major)"
          onPointerDown={() => dispatch({ type: 'DESELECT' })}
        />

        {/* Rooms */}
        {rooms.map((room) => (
          <RoomRect
            key={room.id}
            room={room}
            isSelected={room.id === selectedId}
            pixelsPerUnit={ppu}
            unit={unit}
            onPointerDown={handlePointerDown}
          />
        ))}
      </svg>
    </div>
  )
}
