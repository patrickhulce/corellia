import { useCallback } from 'react'

export function useResize(svgRef, dispatch) {
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

        dispatch({ type: 'RESIZE_ROOM', id: room.id, x: newX, y: newY, widthFt: newW, heightFt: newH })
      }

      const onUp = () => {
        svg.removeEventListener('pointermove', onMove)
        svg.removeEventListener('pointerup', onUp)
      }

      svg.addEventListener('pointermove', onMove)
      svg.addEventListener('pointerup', onUp)
    },
    [svgRef, dispatch]
  )

  return { handleResizeStart }
}
