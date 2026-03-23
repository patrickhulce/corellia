import { useRef, useEffect, useCallback, useState } from 'react'
import { useFloorplan } from '../context/FloorplanContext'
import { useDrag } from '../hooks/useDrag'
import { useResize } from '../hooks/useResize'
import { RoomRect } from './RoomRect'
import { ROOM_TYPE_OPTIONS } from '../constants/roomTypes'

export function FloorplanCanvas() {
  const { state, dispatch } = useFloorplan()
  const { rooms, selectedId, pixelsPerUnit: ppu, gridCols, gridRows, unit } = state

  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const svgDownPos = useRef(null)
  const panState = useRef({ active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 })
  const [isPanning, setIsPanning] = useState(false)

  const { handlePointerDown } = useDrag(svgRef, dispatch)
  const { handleResizeStart } = useResize(svgRef, dispatch)

  const svgW = gridCols * ppu
  const svgH = gridRows * ppu

  // Scroll-wheel zoom, centered on cursor
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const container = containerRef.current
    if (!container) return

    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    const newPpu = Math.min(120, Math.max(4, ppu * factor))
    const ratio = newPpu / ppu

    const rect = container.getBoundingClientRect()
    const cursorX = e.clientX - rect.left
    const cursorY = e.clientY - rect.top

    const newScrollLeft = (container.scrollLeft + cursorX) * ratio - cursorX
    const newScrollTop = (container.scrollTop + cursorY) * ratio - cursorY

    dispatch({ type: 'SET_PIXELS_PER_UNIT', value: newPpu })

    requestAnimationFrame(() => {
      container.scrollLeft = newScrollLeft
      container.scrollTop = newScrollTop
    })
  }, [ppu, dispatch])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // Scroll to center of grid on first mount
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2
    container.scrollTop = (container.scrollHeight - container.clientHeight) / 2
  }, [])

  // Middle-click pan
  const handleContainerPointerDown = useCallback((e) => {
    if (e.button !== 1) return
    e.preventDefault()
    const container = containerRef.current
    panState.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    }
    container.setPointerCapture(e.pointerId)
  }, [])

  const handleContainerPointerMove = useCallback((e) => {
    if (!panState.current.active) return
    const dx = e.clientX - panState.current.startX
    const dy = e.clientY - panState.current.startY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) setIsPanning(true)
    const container = containerRef.current
    container.scrollLeft = panState.current.scrollLeft - dx
    container.scrollTop = panState.current.scrollTop - dy
  }, [])

  const handleContainerPointerUp = useCallback((e) => {
    if (e.button !== 1) return
    panState.current.active = false
    setIsPanning(false)
  }, [])

  // SVG background: record pointerDown position + deselect
  const handleSvgPointerDown = useCallback((e) => {
    if (e.target !== svgRef.current && e.target.getAttribute('fill') !== 'url(#grid-major)') return
    svgDownPos.current = { x: e.clientX, y: e.clientY }
    dispatch({ type: 'DESELECT' })
  }, [dispatch])

  // SVG background: click-to-create on pointerUp
  const handleSvgPointerUp = useCallback((e) => {
    if (e.button !== 0) return
    if (panState.current.active) return
    if (!svgDownPos.current) return

    const dist = Math.hypot(e.clientX - svgDownPos.current.x, e.clientY - svgDownPos.current.y)
    svgDownPos.current = null
    if (dist >= 3) return

    // Check this is a background click, not a room
    if (e.target !== svgRef.current && e.target.getAttribute('fill') !== 'url(#grid-major)') return

    const svg = svgRef.current
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const pos = pt.matrixTransform(svg.getScreenCTM().inverse())

    const gridX = Math.min(Math.floor(pos.x / ppu), gridCols - 10)
    const gridY = Math.min(Math.floor(pos.y / ppu), gridRows - 10)

    const usedNums = rooms
      .map((r) => r.name.match(/^Room (\d+)$/))
      .filter(Boolean)
      .map((m) => Number(m[1]))
    const nextNum = usedNums.length > 0 ? Math.max(...usedNums) + 1 : 1

    dispatch({
      type: 'ADD_ROOM',
      room: {
        id: crypto.randomUUID(),
        name: `Room ${nextNum}`,
        type: 'other',
        widthFt: 10,
        heightFt: 10,
        x: Math.max(0, gridX),
        y: Math.max(0, gridY),
      },
    })
  }, [ppu, gridCols, gridRows, rooms, dispatch])

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto"
      style={{ background: 'var(--bg)' }}
      onPointerDown={handleContainerPointerDown}
      onPointerMove={handleContainerPointerMove}
      onPointerUp={handleContainerPointerUp}
    >
      <svg
        ref={svgRef}
        width={svgW}
        height={svgH}
        data-ppu={ppu}
        data-cols={gridCols}
        data-rows={gridRows}
        style={{ display: 'block', cursor: isPanning ? 'grabbing' : 'crosshair' }}
        onPointerDown={handleSvgPointerDown}
        onPointerUp={handleSvgPointerUp}
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

        <rect width={svgW} height={svgH} fill="var(--bg)" />
        <rect width={svgW} height={svgH} fill="url(#grid-major)" />

        {rooms.map((room) => (
          <RoomRect
            key={room.id}
            room={room}
            isSelected={room.id === selectedId}
            pixelsPerUnit={ppu}
            unit={unit}
            onPointerDown={handlePointerDown}
            onResizeStart={room.id === selectedId ? handleResizeStart : null}
          />
        ))}
      </svg>
    </div>
  )
}
