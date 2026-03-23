import { useCallback } from 'react'
import { computeResizeSnap } from '../utils/snapEdges'

const SNAP_THRESHOLD_PX = 30

export function useResize(svgRef, dispatch, roomsRef, onSnapGuidesChange) {
  const handleResizeStart = useCallback(
    (e, room, edge) => {
      e.stopPropagation()
      const svg = svgRef.current
      if (!svg) return

      const pt = svg.createSVGPoint()
      const toSVG = (clientX, clientY) => {
        pt.x = clientX
        pt.y = clientY
        return pt.matrixTransform(svg.getScreenCTM().inverse())
      }

      const origin = toSVG(e.clientX, e.clientY)
      const { x: startX, y: startY, widthFt: startW, heightFt: startH } = room

      e.currentTarget.setPointerCapture(e.pointerId)
      dispatch({ type: 'RESIZE_START' })

      const onMove = (moveE) => {
        const ppu = Number(svg.dataset.ppu)
        const gridCols = Number(svg.dataset.cols)
        const gridRows = Number(svg.dataset.rows)
        const cur = toSVG(moveE.clientX, moveE.clientY)

        const dx = Math.round((cur.x - origin.x) / ppu)
        const dy = Math.round((cur.y - origin.y) / ppu)

        let newX = startX
        let newY = startY
        let newW = startW
        let newH = startH

        // Horizontal axis
        if (edge === 'w' || edge === 'nw' || edge === 'sw') {
          newX = Math.max(0, Math.min(startX + dx, startX + startW - 1))
          newW = Math.max(1, startW - (newX - startX))
        } else if (edge === 'e' || edge === 'ne' || edge === 'se') {
          newW = Math.max(1, Math.min(startW + dx, gridCols - startX))
        }

        // Vertical axis
        if (edge === 'n' || edge === 'nw' || edge === 'ne') {
          newY = Math.max(0, Math.min(startY + dy, startY + startH - 1))
          newH = Math.max(1, startH - (newY - startY))
        } else if (edge === 's' || edge === 'sw' || edge === 'se') {
          newH = Math.max(1, Math.min(startH + dy, gridRows - startY))
        }

        // Snap (Cmd bypasses snap)
        if (!moveE.metaKey) {
          const otherRooms = (roomsRef?.current ?? []).filter((r) => r.id !== room.id)
          const snapThreshold = SNAP_THRESHOLD_PX / ppu
          const candidate = { x: newX, y: newY, widthFt: newW, heightFt: newH }
          const snap = computeResizeSnap(candidate, otherRooms, edge, snapThreshold)

          // Apply snap offset to the correct dimension
          if (snap.dx !== 0) {
            if (edge.includes('e')) {
              newW = Math.max(1, newW + snap.dx)
            } else if (edge.includes('w')) {
              newX = newX + snap.dx
              newW = Math.max(1, newW - snap.dx)
            }
          }
          if (snap.dy !== 0) {
            if (edge === 's' || edge === 'se' || edge === 'sw') {
              newH = Math.max(1, newH + snap.dy)
            } else if (edge === 'n' || edge === 'ne' || edge === 'nw') {
              newY = newY + snap.dy
              newH = Math.max(1, newH - snap.dy)
            }
          }

          onSnapGuidesChange?.(snap.guides)
        } else {
          onSnapGuidesChange?.({ x: [], y: [] })
        }

        dispatch({ type: 'RESIZE_ROOM', id: room.id, x: newX, y: newY, widthFt: newW, heightFt: newH })
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

  return { handleResizeStart }
}
