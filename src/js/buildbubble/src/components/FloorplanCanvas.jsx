import { useRef, useEffect, useCallback, useState, useLayoutEffect } from 'react'
import { useFloorplan } from '../context/FloorplanContext'
import { useDrag } from '../hooks/useDrag'
import { useResize } from '../hooks/useResize'
import { RoomRect } from './RoomRect'
import { RoomTypeModal } from './RoomTypeModal'
import { RoomEditModal } from './RoomEditModal'
import { Toolbar } from './Toolbar'
import { ROOM_TYPE_OPTIONS, TYPE_COLORS, DEFAULT_DIMENSIONS } from '../constants/roomTypes'

const FT_TO_M = 0.3048

export function FloorplanCanvas() {
  const { state, dispatch } = useFloorplan()
  const { rooms, selectedIds, pixelsPerUnit: ppu, gridCols, gridRows, unit } = state

  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const wrapperRef = useRef(null)
  const panState = useRef({ active: false, startX: 0, startY: 0, viewX: 0, viewY: 0 })
  const viewRef = useRef({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)

  // Drag-to-create state
  const drawStart = useRef(null)
  const drawRectRef = useRef(null)
  const [drawRect, setDrawRect] = useState(null)

  // Marquee selection state
  const marqueeStart = useRef(null)
  const [marqueeRect, setMarqueeRect] = useState(null)

  // Type cycling during drag
  const drawTypeIdx = useRef(ROOM_TYPE_OPTIONS.findIndex((o) => o.value === 'other'))
  const [drawType, setDrawType] = useState('other')

  // Double-click modal
  const [modalPos, setModalPos] = useState(null)

  // Room edit modal (double-click on existing room)
  const [editingRoom, setEditingRoom] = useState(null)

  // Snap guides
  const roomsRef = useRef(rooms)
  roomsRef.current = rooms
  const selectedIdsRef = useRef(selectedIds)
  selectedIdsRef.current = selectedIds
  const [snapGuides, setSnapGuides] = useState({ x: [], y: [] })
  const handleSnapGuidesChange = useCallback((guides) => setSnapGuides(guides), [])

  const { handlePointerDown } = useDrag(svgRef, dispatch, roomsRef, handleSnapGuidesChange, selectedIdsRef)
  const { handleResizeStart } = useResize(svgRef, dispatch, roomsRef, handleSnapGuidesChange)

  const svgW = gridCols * ppu
  const svgH = gridRows * ppu

  // Apply the current view transform to the wrapper div
  const applyView = useCallback(() => {
    const wrapper = wrapperRef.current
    if (wrapper) {
      wrapper.style.transform = `translate(${-viewRef.current.x}px, ${-viewRef.current.y}px)`
    }
  }, [])

  // Re-apply transform after React re-renders (e.g. after zoom changes ppu)
  useLayoutEffect(() => {
    applyView()
  })

  // Scroll-wheel zoom (or type cycling during drag), centered on cursor
  const handleWheel = useCallback((e) => {
    e.preventDefault()

    // If actively drawing, cycle room type instead of zooming
    if (drawStart.current) {
      const dir = e.deltaY < 0 ? -1 : 1
      const len = ROOM_TYPE_OPTIONS.length
      drawTypeIdx.current = (drawTypeIdx.current + dir + len) % len
      setDrawType(ROOM_TYPE_OPTIONS[drawTypeIdx.current].value)
      return
    }

    const container = containerRef.current
    if (!container) return

    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    const newPpu = Math.min(120, Math.max(4, ppu * factor))
    const ratio = newPpu / ppu

    const rect = container.getBoundingClientRect()
    const cursorX = e.clientX - rect.left
    const cursorY = e.clientY - rect.top

    // Adjust view so the world point under the cursor stays fixed
    viewRef.current.x = (viewRef.current.x + cursorX) * ratio - cursorX
    viewRef.current.y = (viewRef.current.y + cursorY) * ratio - cursorY

    dispatch({ type: 'SET_PIXELS_PER_UNIT', value: newPpu })
  }, [ppu, dispatch])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // Keyboard delete handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault()
        for (const id of selectedIds) {
          dispatch({ type: 'DELETE_ROOM', id })
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedIds, dispatch])

  // Center the view on the grid on first mount
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    viewRef.current.x = (svgW - container.clientWidth) / 2
    viewRef.current.y = (svgH - container.clientHeight) / 2
    applyView()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Middle-click pan
  const handleContainerPointerDown = useCallback((e) => {
    if (e.button !== 1) return
    e.preventDefault()
    panState.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      viewX: viewRef.current.x,
      viewY: viewRef.current.y,
    }
    containerRef.current.setPointerCapture(e.pointerId)
  }, [])

  const handleContainerPointerMove = useCallback((e) => {
    if (!panState.current.active) return
    const dx = e.clientX - panState.current.startX
    const dy = e.clientY - panState.current.startY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) setIsPanning(true)
    viewRef.current.x = panState.current.viewX - dx
    viewRef.current.y = panState.current.viewY - dy
    applyView()
  }, [applyView])

  const handleContainerPointerUp = useCallback((e) => {
    if (e.button !== 1) return
    panState.current.active = false
    setIsPanning(false)
  }, [])

  // SVG background: start drag-to-create or marquee select
  const handleSvgPointerDown = useCallback((e) => {
    if (e.button !== 0) return
    if (e.target !== svgRef.current && e.target.getAttribute('fill') !== 'url(#grid-major)') return

    const svg = svgRef.current
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const pos = pt.matrixTransform(svg.getScreenCTM().inverse())

    const gridX = Math.floor(pos.x / ppu)
    const gridY = Math.floor(pos.y / ppu)

    if (e.shiftKey) {
      // Start marquee selection
      marqueeStart.current = { gridX, gridY }
      setMarqueeRect(null)
      svg.setPointerCapture(e.pointerId)
      return
    }

    // Reset type cycling
    drawTypeIdx.current = ROOM_TYPE_OPTIONS.findIndex((o) => o.value === 'other')
    setDrawType('other')

    drawStart.current = { gridX, gridY }
    drawRectRef.current = null
    setDrawRect(null)

    svg.setPointerCapture(e.pointerId)
    dispatch({ type: 'DESELECT' })
  }, [ppu, dispatch])

  // SVG: update drag-to-create preview or marquee
  const handleSvgPointerMove = useCallback((e) => {
    const svg = svgRef.current
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const pos = pt.matrixTransform(svg.getScreenCTM().inverse())
    const curGridX = Math.floor(pos.x / ppu)
    const curGridY = Math.floor(pos.y / ppu)

    if (marqueeStart.current) {
      const x = Math.min(marqueeStart.current.gridX, curGridX)
      const y = Math.min(marqueeStart.current.gridY, curGridY)
      const w = Math.abs(curGridX - marqueeStart.current.gridX)
      const h = Math.abs(curGridY - marqueeStart.current.gridY)
      setMarqueeRect({ x, y, w, h })
      return
    }

    if (!drawStart.current) return

    const x = Math.min(drawStart.current.gridX, curGridX)
    const y = Math.min(drawStart.current.gridY, curGridY)
    const w = Math.abs(curGridX - drawStart.current.gridX)
    const h = Math.abs(curGridY - drawStart.current.gridY)

    const rect = { x, y, w, h }
    drawRectRef.current = rect
    setDrawRect(rect)
  }, [ppu])

  // Helper to generate auto-name from type
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

  // SVG: finish drag-to-create or marquee, require 2x2 minimum for rooms
  const handleSvgPointerUp = useCallback((e) => {
    if (e.button !== 0) return

    // Finish marquee selection
    if (marqueeStart.current) {
      const mq = marqueeRect
      marqueeStart.current = null
      setMarqueeRect(null)
      if (!mq || (mq.w === 0 && mq.h === 0)) {
        dispatch({ type: 'DESELECT' })
        return
      }
      const mqRight = mq.x + mq.w
      const mqBottom = mq.y + mq.h
      const hitIds = rooms
        .filter((r) => {
          const rRight = r.x + r.widthFt
          const rBottom = r.y + r.heightFt
          return !(rRight < mq.x || r.x > mqRight || rBottom < mq.y || r.y > mqBottom)
        })
        .map((r) => r.id)
      const merged = [...new Set([...selectedIds, ...hitIds])]
      dispatch({ type: merged.length > 0 ? 'SELECT_ROOMS' : 'DESELECT', ids: merged })
      return
    }

    if (!drawStart.current) return

    const rect = drawRectRef.current
    const selectedType = ROOM_TYPE_OPTIONS[drawTypeIdx.current].value
    drawStart.current = null
    drawRectRef.current = null
    setDrawRect(null)

    if (!rect || rect.w < 2 || rect.h < 2) return

    dispatch({
      type: 'ADD_ROOM',
      room: {
        id: crypto.randomUUID(),
        name: generateRoomName(selectedType),
        type: selectedType,
        widthFt: rect.w,
        heightFt: rect.h,
        x: Math.max(0, Math.min(rect.x, gridCols - rect.w)),
        y: Math.max(0, Math.min(rect.y, gridRows - rect.h)),
      },
    })
  }, [gridCols, gridRows, dispatch, generateRoomName, rooms, marqueeRect, selectedIds])

  // Double-click on SVG: open room type modal
  const handleSvgDoubleClick = useCallback((e) => {
    if (e.target !== svgRef.current && e.target.getAttribute('fill') !== 'url(#grid-major)') return

    const svg = svgRef.current
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const pos = pt.matrixTransform(svg.getScreenCTM().inverse())

    setModalPos({
      gridX: Math.floor(pos.x / ppu),
      gridY: Math.floor(pos.y / ppu),
    })
  }, [ppu])

  // Modal: create room with default dimensions
  const handleModalSelect = useCallback((typeValue) => {
    if (!modalPos) return
    const dims = DEFAULT_DIMENSIONS[typeValue] ?? DEFAULT_DIMENSIONS.other

    dispatch({
      type: 'ADD_ROOM',
      room: {
        id: crypto.randomUUID(),
        name: generateRoomName(typeValue),
        type: typeValue,
        widthFt: dims.widthFt,
        heightFt: dims.heightFt,
        x: Math.max(0, Math.min(modalPos.gridX, gridCols - dims.widthFt)),
        y: Math.max(0, Math.min(modalPos.gridY, gridRows - dims.heightFt)),
      },
    })
    setModalPos(null)
  }, [modalPos, gridCols, gridRows, dispatch, generateRoomName])

  // Room double-click: open edit modal
  const handleRoomDoubleClick = useCallback((room) => {
    setEditingRoom(room)
  }, [])

  const handleEditSave = useCallback((id, updates) => {
    dispatch({ type: 'UPDATE_ROOM', id, updates })
  }, [dispatch])

  // Draw preview colors
  const previewColors = TYPE_COLORS[drawType] ?? TYPE_COLORS.other
  const previewLabel = ROOM_TYPE_OPTIONS.find((o) => o.value === drawType)?.label ?? 'Room'

  return (
    <div
      ref={containerRef}
      className="flex-1"
      style={{ background: 'var(--bg)', overflow: 'hidden', position: 'relative', cursor: isPanning ? 'grabbing' : 'default' }}
      onPointerDown={handleContainerPointerDown}
      onPointerMove={handleContainerPointerMove}
      onPointerUp={handleContainerPointerUp}
    >
      <div ref={wrapperRef} style={{ position: 'absolute', willChange: 'transform' }}>
        <svg
          ref={svgRef}
          width={svgW}
          height={svgH}
          data-ppu={ppu}
          data-cols={gridCols}
          data-rows={gridRows}
          style={{ display: 'block', cursor: isPanning ? 'grabbing' : 'crosshair' }}
          onPointerDown={handleSvgPointerDown}
          onPointerMove={handleSvgPointerMove}
          onPointerUp={handleSvgPointerUp}
          onDoubleClick={handleSvgDoubleClick}
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

          {rooms.map((room) => {
            const isSelected = selectedIds.includes(room.id)
            return (
              <RoomRect
                key={room.id}
                room={room}
                isSelected={isSelected}
                pixelsPerUnit={ppu}
                unit={unit}
                onPointerDown={handlePointerDown}
                onResizeStart={isSelected && selectedIds.length === 1 ? handleResizeStart : null}
                onDoubleClick={handleRoomDoubleClick}
              />
            )
          })}

          {/* Snap guide lines */}
          {snapGuides.x.map((gx) => (
            <line
              key={`sx-${gx}`}
              x1={gx * ppu}
              y1={0}
              x2={gx * ppu}
              y2={svgH}
              stroke="var(--accent)"
              strokeWidth="1"
              strokeDasharray="6 4"
              pointerEvents="none"
              opacity="0.7"
            />
          ))}
          {snapGuides.y.map((gy) => (
            <line
              key={`sy-${gy}`}
              x1={0}
              y1={gy * ppu}
              x2={svgW}
              y2={gy * ppu}
              stroke="var(--accent)"
              strokeWidth="1"
              strokeDasharray="6 4"
              pointerEvents="none"
              opacity="0.7"
            />
          ))}

          {/* Marquee selection rect */}
          {marqueeRect && marqueeRect.w > 0 && marqueeRect.h > 0 && (
            <rect
              x={marqueeRect.x * ppu}
              y={marqueeRect.y * ppu}
              width={marqueeRect.w * ppu}
              height={marqueeRect.h * ppu}
              fill="var(--accent)"
              fillOpacity="0.08"
              stroke="var(--accent)"
              strokeWidth="1.5"
              strokeDasharray="6 3"
              pointerEvents="none"
              rx={2}
            />
          )}

          {drawRect && drawRect.w > 0 && drawRect.h > 0 && (() => {
            const valid = drawRect.w >= 2 && drawRect.h >= 2
            const strokeColor = valid ? previewColors.stroke : 'rgb(239,68,68)'
            const px = drawRect.x * ppu
            const py = drawRect.y * ppu
            const pw = drawRect.w * ppu
            const ph = drawRect.h * ppu
            const cx = px + pw / 2
            const cy = py + ph / 2
            const displayW = unit === 'm' ? (drawRect.w * FT_TO_M).toFixed(1) : drawRect.w
            const displayH = unit === 'm' ? (drawRect.h * FT_TO_M).toFixed(1) : drawRect.h
            return (
              <g pointerEvents="none">
                <rect
                  x={px}
                  y={py}
                  width={pw}
                  height={ph}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="2"
                  strokeDasharray="6 3"
                  rx={2}
                />
                {pw > 30 && ph > 20 && (
                  <>
                    <text
                      x={cx}
                      y={cy - (ph > 40 ? 8 : 0)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={Math.min(13, (pw / previewLabel.length) * 1.4)}
                      fontWeight="600"
                      fill={strokeColor}
                      stroke="white"
                      strokeWidth="3"
                      paintOrder="stroke"
                    >
                      {valid ? previewLabel : 'Too small'}
                    </text>
                    {ph > 40 && (
                      <text
                        x={cx}
                        y={cy + 10}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={10}
                        fill={strokeColor}
                        stroke="white"
                        strokeWidth="3"
                        paintOrder="stroke"
                        opacity={0.9}
                      >
                        {displayW} × {displayH} {unit}
                      </text>
                    )}
                  </>
                )}
              </g>
            )
          })()}
        </svg>
      </div>

      {modalPos && (
        <RoomTypeModal
          onSelect={handleModalSelect}
          onClose={() => setModalPos(null)}
        />
      )}

      {editingRoom && (
        <RoomEditModal
          room={editingRoom}
          onSave={handleEditSave}
          onClose={() => setEditingRoom(null)}
          defaultCeilingHeightFt={state.defaultCeilingHeightFt}
        />
      )}

      <Toolbar />
    </div>
  )
}
