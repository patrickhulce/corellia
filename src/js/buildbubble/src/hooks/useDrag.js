import { useCallback } from 'react'

export function useDrag(svgRef, dispatch) {
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

      e.currentTarget.setPointerCapture(e.pointerId)

      const onMove = (moveE) => {
        const cur = toSVG(moveE.clientX, moveE.clientY)
        // Get current ppu from a data attribute we'll set on the SVG
        const ppu = Number(svg.dataset.ppu)
        const gridCols = Number(svg.dataset.cols)
        const gridRows = Number(svg.dataset.rows)

        const dx = Math.round((cur.x - origin.x) / ppu)
        const dy = Math.round((cur.y - origin.y) / ppu)

        const newX = Math.max(0, Math.min(startX + dx, gridCols - room.widthFt))
        const newY = Math.max(0, Math.min(startY + dy, gridRows - room.heightFt))

        dispatch({ type: 'MOVE_ROOM', id: room.id, x: newX, y: newY })
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

  return { handlePointerDown }
}
