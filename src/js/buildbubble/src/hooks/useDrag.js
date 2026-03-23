import { useCallback } from 'react'
import { computeSnap, classifyDirection } from '../utils/snapEdges'

const SNAP_THRESHOLD_PX = 30

export function useDrag(svgRef, dispatch, roomsRef, onSnapGuidesChange) {
  const handlePointerDown = useCallback(
    (e, room) => {
      e.stopPropagation()
      const svg = svgRef.current
      if (!svg) return

      dispatch({ type: 'SELECT_ROOM', id: room.id })

      const pt = svg.createSVGPoint()
      const toSVG = (clientX, clientY) => {
        pt.x = clientX
        pt.y = clientY
        return pt.matrixTransform(svg.getScreenCTM().inverse())
      }

      const origin = toSVG(e.clientX, e.clientY)
      const startX = room.x
      const startY = room.y
      let prevDirection = null
      let prevClientX = e.clientX
      let prevClientY = e.clientY

      e.currentTarget.setPointerCapture(e.pointerId)

      const onMove = (moveE) => {
        const cur = toSVG(moveE.clientX, moveE.clientY)
        const ppu = Number(svg.dataset.ppu)
        const gridCols = Number(svg.dataset.cols)
        const gridRows = Number(svg.dataset.rows)

        const dx = Math.round((cur.x - origin.x) / ppu)
        const dy = Math.round((cur.y - origin.y) / ppu)

        let newX = Math.max(0, Math.min(startX + dx, gridCols - room.widthFt))
        let newY = Math.max(0, Math.min(startY + dy, gridRows - room.heightFt))

        // Classify direction from screen-space mouse delta
        const mouseDx = moveE.clientX - prevClientX
        const mouseDy = moveE.clientY - prevClientY
        prevDirection = classifyDirection(mouseDx, mouseDy, prevDirection)
        prevClientX = moveE.clientX
        prevClientY = moveE.clientY

        // Snap
        const otherRooms = (roomsRef?.current ?? []).filter((r) => r.id !== room.id)
        const snapThreshold = SNAP_THRESHOLD_PX / ppu
        const candidate = { x: newX, y: newY, widthFt: room.widthFt, heightFt: room.heightFt }
        const snap = computeSnap(candidate, otherRooms, prevDirection, snapThreshold)

        newX = Math.max(0, Math.min(newX + snap.dx, gridCols - room.widthFt))
        newY = Math.max(0, Math.min(newY + snap.dy, gridRows - room.heightFt))

        onSnapGuidesChange?.(snap.guides)
        dispatch({ type: 'MOVE_ROOM', id: room.id, x: newX, y: newY })
      }

      const onUp = () => {
        svg.removeEventListener('pointermove', onMove)
        svg.removeEventListener('pointerup', onUp)
        onSnapGuidesChange?.({ x: [], y: [] })
      }

      svg.addEventListener('pointermove', onMove)
      svg.addEventListener('pointerup', onUp)
    },
    [svgRef, dispatch, roomsRef, onSnapGuidesChange]
  )

  return { handlePointerDown }
}
