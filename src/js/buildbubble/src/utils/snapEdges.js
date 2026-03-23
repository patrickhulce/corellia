/**
 * Compute snap offsets for a candidate rect against other rooms.
 *
 * @param {{ x: number, y: number, widthFt: number, heightFt: number }} candidate
 * @param {Array<{ x: number, y: number, widthFt: number, heightFt: number, id: string }>} otherRooms
 * @param {'left'|'right'|'up'|'down'|null} direction - movement direction (null = no snap)
 * @param {number} snapThreshold - snap distance in grid units
 * @returns {{ dx: number, dy: number, guides: { x: number[], y: number[] } }}
 */
export function computeSnap(candidate, otherRooms, direction, snapThreshold) {
  const result = { dx: 0, dy: 0, guides: { x: [], y: [] } }
  if (!direction || otherRooms.length === 0) return result

  const cLeft = candidate.x
  const cRight = candidate.x + candidate.widthFt
  const cTop = candidate.y
  const cBottom = candidate.y + candidate.heightFt
  const cx = (cLeft + cRight) / 2
  const cy = (cTop + cBottom) / 2

  // Collect all target edges
  const xEdges = []
  const yEdges = []
  for (const room of otherRooms) {
    const rLeft = room.x
    const rRight = room.x + room.widthFt
    const rTop = room.y
    const rBottom = room.y + room.heightFt
    xEdges.push(rLeft, rRight)
    yEdges.push(rTop, rBottom)
  }

  if (direction === 'right') {
    // Snap candidate's right edge to target X edges that are to the right of center
    let best = Infinity
    for (const ex of xEdges) {
      if (ex <= cx) continue
      const dist = Math.abs(cRight - ex)
      if (dist < best && dist <= snapThreshold) {
        best = dist
        result.dx = ex - cRight
        result.guides.x = [ex]
      }
    }
  } else if (direction === 'left') {
    // Snap candidate's left edge to target X edges that are to the left of center
    let best = Infinity
    for (const ex of xEdges) {
      if (ex >= cx) continue
      const dist = Math.abs(cLeft - ex)
      if (dist < best && dist <= snapThreshold) {
        best = dist
        result.dx = ex - cLeft
        result.guides.x = [ex]
      }
    }
  } else if (direction === 'down') {
    // Snap candidate's bottom edge to target Y edges below center
    let best = Infinity
    for (const ey of yEdges) {
      if (ey <= cy) continue
      const dist = Math.abs(cBottom - ey)
      if (dist < best && dist <= snapThreshold) {
        best = dist
        result.dy = ey - cBottom
        result.guides.y = [ey]
      }
    }
  } else if (direction === 'up') {
    // Snap candidate's top edge to target Y edges above center
    let best = Infinity
    for (const ey of yEdges) {
      if (ey >= cy) continue
      const dist = Math.abs(cTop - ey)
      if (dist < best && dist <= snapThreshold) {
        best = dist
        result.dy = ey - cTop
        result.guides.y = [ey]
      }
    }
  }

  return result
}

/**
 * Compute snap for a resize operation. Direction is implicit from the handle.
 *
 * @param {{ x: number, y: number, widthFt: number, heightFt: number }} candidate
 * @param {Array<{ x: number, y: number, widthFt: number, heightFt: number, id: string }>} otherRooms
 * @param {string} edge - resize handle: 'n','s','e','w','ne','nw','se','sw'
 * @param {number} snapThreshold
 * @returns {{ dx: number, dy: number, guides: { x: number[], y: number[] } }}
 */
export function computeResizeSnap(candidate, otherRooms, edge, snapThreshold) {
  const result = { dx: 0, dy: 0, guides: { x: [], y: [] } }
  if (otherRooms.length === 0) return result

  const cLeft = candidate.x
  const cRight = candidate.x + candidate.widthFt
  const cTop = candidate.y
  const cBottom = candidate.y + candidate.heightFt

  const xEdges = []
  const yEdges = []
  for (const room of otherRooms) {
    xEdges.push(room.x, room.x + room.widthFt)
    yEdges.push(room.y, room.y + room.heightFt)
  }

  // East handle → snap right edge
  if (edge.includes('e')) {
    let best = Infinity
    for (const ex of xEdges) {
      const dist = Math.abs(cRight - ex)
      if (dist < best && dist <= snapThreshold) {
        best = dist
        result.dx = ex - cRight
        result.guides.x = [ex]
      }
    }
  }
  // West handle → snap left edge
  if (edge.includes('w')) {
    let best = Infinity
    for (const ex of xEdges) {
      const dist = Math.abs(cLeft - ex)
      if (dist < best && dist <= snapThreshold) {
        best = dist
        result.dx = ex - cLeft
        result.guides.x = [ex]
      }
    }
  }
  // South handle → snap bottom edge
  if (edge === 's' || edge === 'se' || edge === 'sw') {
    let best = Infinity
    for (const ey of yEdges) {
      const dist = Math.abs(cBottom - ey)
      if (dist < best && dist <= snapThreshold) {
        best = dist
        result.dy = ey - cBottom
        result.guides.y = [ey]
      }
    }
  }
  // North handle → snap top edge
  if (edge === 'n' || edge === 'ne' || edge === 'nw') {
    let best = Infinity
    for (const ey of yEdges) {
      const dist = Math.abs(cTop - ey)
      if (dist < best && dist <= snapThreshold) {
        best = dist
        result.dy = ey - cTop
        result.guides.y = [ey]
      }
    }
  }

  return result
}

/**
 * Classify movement direction from mouse delta.
 * @param {number} dx
 * @param {number} dy
 * @param {string|null} prevDirection
 * @returns {'left'|'right'|'up'|'down'|null}
 */
export function classifyDirection(dx, dy, prevDirection) {
  if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return prevDirection
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left'
  }
  return dy > 0 ? 'down' : 'up'
}
