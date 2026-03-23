import { useCallback } from 'react'
import { computeSnap, classifyDirection } from '../utils/snapEdges'

const SNAP_THRESHOLD_PX = 30

export function useDrag(svgRef, dispatch, roomsRef, onSnapGuidesChange, selectedIdsRef) {
  const handlePointerDown = useCallback(
    (e, room) => {
      e.stopPropagation()
      const svg = svgRef.current
      if (!svg) return

      const selectedIds = selectedIdsRef?.current ?? []

      // Cmd+click (Mac) or Ctrl+click (Windows): toggle selection, no drag
      if (e.metaKey || e.ctrlKey) {
        dispatch({ type: 'TOGGLE_ROOM_SELECTION', id: room.id })
        return
      }

      // If room is not already selected, single-select it
      const alreadySelected = selectedIds.includes(room.id)
      if (!alreadySelected) {
        dispatch({ type: 'SELECT_ROOM', id: room.id })
      }

      // Determine which rooms will be dragged
      const dragIds = alreadySelected && selectedIds.length > 1 ? selectedIds : [room.id]
      const isGroupDrag = dragIds.length > 1

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

      // For group drag, track cumulative applied delta to compute incremental moves
      let appliedDx = 0
      let appliedDy = 0

      e.currentTarget.setPointerCapture(e.pointerId)
      dispatch({ type: 'DRAG_START' })

      const onMove = (moveE) => {
        const cur = toSVG(moveE.clientX, moveE.clientY)
        const ppu = Number(svg.dataset.ppu)
        const gridCols = Number(svg.dataset.cols)
        const gridRows = Number(svg.dataset.rows)

        const dx = Math.round((cur.x - origin.x) / ppu)
        const dy = Math.round((cur.y - origin.y) / ppu)

        // Classify direction from screen-space mouse delta
        const mouseDx = moveE.clientX - prevClientX
        const mouseDy = moveE.clientY - prevClientY
        prevDirection = classifyDirection(mouseDx, mouseDy, prevDirection)
        prevClientX = moveE.clientX
        prevClientY = moveE.clientY

        const allRooms = roomsRef?.current ?? []

        if (isGroupDrag) {
          // Compute group bounding box at the proposed new position
          const selected = allRooms.filter((r) => dragIds.includes(r.id))
          const bboxX = Math.min(...selected.map((r) => r.x))
          const bboxY = Math.min(...selected.map((r) => r.y))
          const bboxRight = Math.max(...selected.map((r) => r.x + r.widthFt))
          const bboxBottom = Math.max(...selected.map((r) => r.y + r.heightFt))

          let newBboxX = bboxX + dx - appliedDx
          let newBboxY = bboxY + dy - appliedDy
          const bboxW = bboxRight - bboxX
          const bboxH = bboxBottom - bboxY

          // Clamp to grid
          newBboxX = Math.max(0, Math.min(newBboxX, gridCols - bboxW))
          newBboxY = Math.max(0, Math.min(newBboxY, gridRows - bboxH))

          // Snap using group bbox (Cmd bypasses snap)
          if (!moveE.metaKey) {
            const otherRooms = allRooms.filter((r) => !dragIds.includes(r.id))
            const snapThreshold = SNAP_THRESHOLD_PX / ppu
            const candidate = { x: newBboxX, y: newBboxY, widthFt: bboxW, heightFt: bboxH }
            const snap = computeSnap(candidate, otherRooms, prevDirection, snapThreshold)

            newBboxX = Math.max(0, Math.min(newBboxX + snap.dx, gridCols - bboxW))
            newBboxY = Math.max(0, Math.min(newBboxY + snap.dy, gridRows - bboxH))
            onSnapGuidesChange?.(snap.guides)
          } else {
            onSnapGuidesChange?.({ x: [], y: [] })
          }

          const moveDx = newBboxX - bboxX
          const moveDy = newBboxY - bboxY

          if (moveDx !== 0 || moveDy !== 0) {
            dispatch({ type: 'MOVE_ROOMS', ids: dragIds, dx: moveDx, dy: moveDy })
            appliedDx += moveDx
            appliedDy += moveDy
          }
        } else {
          // Single room drag
          let newX = Math.max(0, Math.min(startX + dx, gridCols - room.widthFt))
          let newY = Math.max(0, Math.min(startY + dy, gridRows - room.heightFt))

          // Snap (Cmd bypasses snap)
          if (!moveE.metaKey) {
            const otherRooms = allRooms.filter((r) => r.id !== room.id)
            const snapThreshold = SNAP_THRESHOLD_PX / ppu
            const candidate = { x: newX, y: newY, widthFt: room.widthFt, heightFt: room.heightFt }
            const snap = computeSnap(candidate, otherRooms, prevDirection, snapThreshold)

            newX = Math.max(0, Math.min(newX + snap.dx, gridCols - room.widthFt))
            newY = Math.max(0, Math.min(newY + snap.dy, gridRows - room.heightFt))
            onSnapGuidesChange?.(snap.guides)
          } else {
            onSnapGuidesChange?.({ x: [], y: [] })
          }

          dispatch({ type: 'MOVE_ROOM', id: room.id, x: newX, y: newY })
        }
      }

      const onUp = () => {
        svg.removeEventListener('pointermove', onMove)
        svg.removeEventListener('pointerup', onUp)
        onSnapGuidesChange?.({ x: [], y: [] })
      }

      svg.addEventListener('pointermove', onMove)
      svg.addEventListener('pointerup', onUp)
    },
    [svgRef, dispatch, roomsRef, onSnapGuidesChange, selectedIdsRef]
  )

  return { handlePointerDown }
}
