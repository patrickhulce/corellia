// Shared square-footage / material metric engine.
// Single source of truth so the sidebar Overview and the breakdown overlay agree.

const EPS = 1e-6

export const INDOOR_TYPES = ['living', 'bedroom', 'bathroom', 'kitchen', 'dining', 'office', 'garage', 'hallway', 'closet', 'other']

// Area Under Roof = all conditioned/indoor space plus covered lanai.
export const AUR_TYPES = [...INDOOR_TYPES, 'lanai']

// Conditioned space excludes the (typically unconditioned) garage.
export const CONDITIONED_TYPES = INDOOR_TYPES.filter((t) => t !== 'garage')

// Site/exterior types that are grouped under "Outdoor" regardless of level.
export const OUTDOOR_TYPES = ['grass', 'driveway', 'patio', 'pool']

export const MATERIAL_CATEGORIES = [
  { label: 'Sod', types: ['grass'] },
  { label: 'Driveway', types: ['driveway'] },
  { label: 'Tile', types: ['bathroom'] },
  { label: 'Patio', types: ['patio', 'lanai'] },
  { label: 'LVP', types: ['living', 'dining', 'kitchen', 'hallway', 'office', 'other'] },
  { label: 'Carpet', types: ['bedroom', 'closet'] },
]

// Map a room type to its floor-material label (undefined when the type has no floor, e.g. pool).
export const FLOOR_MATERIAL = MATERIAL_CATEGORIES.reduce((acc, { label, types }) => {
  for (const t of types) acc[t] = label
  return acc
}, {})

export const ROOF_PITCHES = [
  { label: '4/12', multiplier: Math.sqrt(4 * 4 + 144) / 12 },
  { label: '5/12', multiplier: Math.sqrt(5 * 5 + 144) / 12 },
  { label: '6/12', multiplier: Math.sqrt(6 * 6 + 144) / 12 },
  { label: '7/12', multiplier: Math.sqrt(7 * 7 + 144) / 12 },
  { label: '8/12', multiplier: Math.sqrt(8 * 8 + 144) / 12 },
  { label: '9/12', multiplier: Math.sqrt(9 * 9 + 144) / 12 },
  { label: '10/12', multiplier: Math.sqrt(10 * 10 + 144) / 12 },
  { label: '11/12', multiplier: Math.sqrt(11 * 11 + 144) / 12 },
  { label: '12/12', multiplier: Math.sqrt(12 * 12 + 144) / 12 },
]

export function getPitchMultiplier(roofPitch) {
  return (ROOF_PITCHES.find((p) => p.label === roofPitch) ?? ROOF_PITCHES[2]).multiplier
}

/** Returns the intersection of two axis-aligned rects, or null if they don't overlap. */
export function rectIntersection(a, b) {
  const x0 = Math.max(a.x, b.x)
  const y0 = Math.max(a.y, b.y)
  const x1 = Math.min(a.x + a.widthFt, b.x + b.widthFt)
  const y1 = Math.min(a.y + a.heightFt, b.y + b.heightFt)
  if (x1 <= x0 || y1 <= y0) return null
  return { x: x0, y: y0, widthFt: x1 - x0, heightFt: y1 - y0 }
}

/** Computes the union area of a set of axis-aligned rects via coordinate compression. */
export function unionArea(rects) {
  if (rects.length === 0) return 0
  const xs = [...new Set(rects.flatMap((r) => [r.x, r.x + r.widthFt]))].sort((a, b) => a - b)
  const ys = [...new Set(rects.flatMap((r) => [r.y, r.y + r.heightFt]))].sort((a, b) => a - b)
  let area = 0
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const cx = xs[i], cy = ys[j]
      const cw = xs[i + 1] - cx, ch = ys[j + 1] - cy
      if (rects.some((r) => cx >= r.x && cx + cw <= r.x + r.widthFt && cy >= r.y && cy + ch <= r.y + r.heightFt)) {
        area += cw * ch
      }
    }
  }
  return area
}

/**
 * Computes the outer (and any inner-hole) boundary length of a union of
 * axis-aligned rects via coordinate compression: for every cell inside the
 * union, each of its 4 sides whose neighbor is outside the union contributes
 * that side's length.
 */
export function unionPerimeter(rects) {
  if (rects.length === 0) return 0
  const xs = [...new Set(rects.flatMap((r) => [r.x, r.x + r.widthFt]))].sort((a, b) => a - b)
  const ys = [...new Set(rects.flatMap((r) => [r.y, r.y + r.heightFt]))].sort((a, b) => a - b)
  const nx = xs.length - 1
  const ny = ys.length - 1

  // cell[i][j] = is the cell [xs[i],xs[i+1]] x [ys[j],ys[j+1]] inside the union
  const cell = []
  for (let i = 0; i < nx; i++) {
    cell[i] = []
    for (let j = 0; j < ny; j++) {
      const cx = xs[i], cy = ys[j]
      const cw = xs[i + 1] - cx, ch = ys[j + 1] - cy
      cell[i][j] = rects.some((r) => cx >= r.x && cx + cw <= r.x + r.widthFt && cy >= r.y && cy + ch <= r.y + r.heightFt)
    }
  }

  const isInside = (i, j) => i >= 0 && i < nx && j >= 0 && j < ny && cell[i][j]

  let perimeter = 0
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      if (!cell[i][j]) continue
      const cw = xs[i + 1] - xs[i]
      const ch = ys[j + 1] - ys[j]
      if (!isInside(i - 1, j)) perimeter += ch
      if (!isInside(i + 1, j)) perimeter += ch
      if (!isInside(i, j - 1)) perimeter += cw
      if (!isInside(i, j + 1)) perimeter += cw
    }
  }
  return perimeter
}

/**
 * Total length of interior partition walls within a union of axis-aligned rects.
 *
 * A partition exists along an internal grid edge when both neighboring cells are
 * inside the union AND some room has an edge on that line spanning the segment.
 * Each shared wall line is matched once (deduped), and edges of overlapping or
 * nested rooms that fall inside the union are correctly included. Edges on the
 * outer boundary (one neighbor outside) are exterior, not interior partitions.
 */
export function unionInteriorWallLength(rects) {
  if (rects.length === 0) return 0
  const xs = [...new Set(rects.flatMap((r) => [r.x, r.x + r.widthFt]))].sort((a, b) => a - b)
  const ys = [...new Set(rects.flatMap((r) => [r.y, r.y + r.heightFt]))].sort((a, b) => a - b)
  const nx = xs.length - 1
  const ny = ys.length - 1

  const cell = []
  for (let i = 0; i < nx; i++) {
    cell[i] = []
    for (let j = 0; j < ny; j++) {
      const cx = xs[i], cy = ys[j]
      const cw = xs[i + 1] - cx, ch = ys[j + 1] - cy
      cell[i][j] = rects.some((r) => cx >= r.x && cx + cw <= r.x + r.widthFt && cy >= r.y && cy + ch <= r.y + r.heightFt)
    }
  }

  const near = (a, b) => Math.abs(a - b) < EPS
  const hasVerticalEdge = (x, y0, y1) =>
    rects.some((r) => (near(r.x, x) || near(r.x + r.widthFt, x)) && r.y <= y0 + EPS && r.y + r.heightFt >= y1 - EPS)
  const hasHorizontalEdge = (y, x0, x1) =>
    rects.some((r) => (near(r.y, y) || near(r.y + r.heightFt, y)) && r.x <= x0 + EPS && r.x + r.widthFt >= x1 - EPS)

  let length = 0
  // Internal vertical lines (x = xs[i], 0 < i < nx): partition between cells (i-1,j) and (i,j)
  for (let i = 1; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      if (!cell[i - 1][j] || !cell[i][j]) continue
      if (hasVerticalEdge(xs[i], ys[j], ys[j + 1])) length += ys[j + 1] - ys[j]
    }
  }
  // Internal horizontal lines (y = ys[j], 0 < j < ny): partition between cells (i,j-1) and (i,j)
  for (let j = 1; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!cell[i][j - 1] || !cell[i][j]) continue
      if (hasHorizontalEdge(ys[j], xs[i], xs[i + 1])) length += xs[i + 1] - xs[i]
    }
  }
  return length
}

export function roomLevel(room) {
  return room.level ?? 1
}

/**
 * Computes the visible (uncovered) area for each room, considering only rooms
 * that satisfy `predicate` as occluders. Rooms later in the array are higher in
 * the z-stack and occlude earlier rooms. Occlusion is computed per-level so that
 * rooms on different floors don't occlude each other.
 *
 * Returns a Map<roomId, visibleFt>. Only rooms satisfying `predicate` receive a
 * positive value; others map to 0. The sum over a level equals the union area of
 * that level's matching rooms, so per-room values are safe to total.
 */
export function computeCategoryVisible(rooms, predicate) {
  const result = new Map()
  for (const r of rooms) result.set(r.id, 0)

  const levels = new Map()
  rooms.forEach((r, idx) => {
    if (!predicate(r)) return
    const lvl = roomLevel(r)
    if (!levels.has(lvl)) levels.set(lvl, [])
    levels.get(lvl).push({ room: r, idx })
  })

  for (const entries of levels.values()) {
    // Preserve global z-order within the level.
    entries.sort((a, b) => a.idx - b.idx)
    for (let i = 0; i < entries.length; i++) {
      const room = entries[i].room
      const totalArea = room.widthFt * room.heightFt
      const overlaps = []
      for (let j = i + 1; j < entries.length; j++) {
        const clip = rectIntersection(room, entries[j].room)
        if (clip) overlaps.push(clip)
      }
      result.set(room.id, Math.max(0, totalArea - unionArea(overlaps)))
    }
  }

  return result
}

function lengthsTouch(a, b) {
  return Math.abs(a - b) < EPS
}

/**
 * Wall metrics (drywall, exterior cladding, framing) using epsilon-tolerant
 * adjacency so fractional coordinates from resize/snap still register shared walls.
 */
export function computeWallMetrics(rooms, defaultCeilingHeightFt) {
  const indoorRooms = rooms.filter((r) => INDOOR_TYPES.includes(r.type))
  const levels = new Map()
  for (const r of indoorRooms) {
    const lvl = roomLevel(r)
    if (!levels.has(lvl)) levels.set(lvl, [])
    levels.get(lvl).push(r)
  }

  let drywallArea = 0
  let sharedBothSides = 0
  let sharedOneSide = 0

  for (const levelRooms of levels.values()) {
    for (const r of levelRooms) {
      const ceiling = r.ceilingHeightFt ?? defaultCeilingHeightFt
      const perimeter = 2 * (r.widthFt + r.heightFt)
      drywallArea += perimeter * ceiling
    }

    for (let i = 0; i < levelRooms.length; i++) {
      for (let j = i + 1; j < levelRooms.length; j++) {
        const a = levelRooms[i]
        const b = levelRooms[j]
        const cA = a.ceilingHeightFt ?? defaultCeilingHeightFt
        const cB = b.ceilingHeightFt ?? defaultCeilingHeightFt

        let sharedLength = 0

        // Vertical shared edges (left/right faces touch)
        if (lengthsTouch(a.x + a.widthFt, b.x) || lengthsTouch(b.x + b.widthFt, a.x)) {
          const overlapStart = Math.max(a.y, b.y)
          const overlapEnd = Math.min(a.y + a.heightFt, b.y + b.heightFt)
          if (overlapEnd - overlapStart > EPS) sharedLength += overlapEnd - overlapStart
        }
        // Horizontal shared edges (top/bottom faces touch)
        if (lengthsTouch(a.y + a.heightFt, b.y) || lengthsTouch(b.y + b.heightFt, a.y)) {
          const overlapStart = Math.max(a.x, b.x)
          const overlapEnd = Math.min(a.x + a.widthFt, b.x + b.widthFt)
          if (overlapEnd - overlapStart > EPS) sharedLength += overlapEnd - overlapStart
        }

        if (sharedLength > 0) {
          sharedBothSides += sharedLength * cA + sharedLength * cB
          sharedOneSide += sharedLength * Math.min(cA, cB)
        }
      }
    }
  }

  return {
    drywallArea,
    exteriorArea: drywallArea - sharedBothSides,
    framingArea: drywallArea - sharedOneSide,
  }
}

/**
 * Computes the wall-inclusive (gross) area for a set of rooms, treating drawn
 * rectangles as interior faces:
 *
 *   gross = net + extThk * exteriorPerimeter + intThk * interiorPartitionLength
 *
 * Walls don't cross floors, so the envelope is computed per level and summed
 * (unless `acrossLevels`, used for the roof footprint). The exterior ring adds
 * `extThk * unionPerimeter`; interior partitions add `intThk * interiorLen`,
 * where `interiorLen` is the exact (deduped) interior partition length.
 */
export function computeGross(rooms, predicate, { extThk = 0, intThk = 0, includeInterior = true, acrossLevels = false } = {}) {
  const matching = rooms.filter(predicate)
  if (matching.length === 0) return 0

  const groups = new Map()
  if (acrossLevels) {
    groups.set('all', matching)
  } else {
    for (const r of matching) {
      const lvl = roomLevel(r)
      if (!groups.has(lvl)) groups.set(lvl, [])
      groups.get(lvl).push(r)
    }
  }

  let gross = 0
  for (const group of groups.values()) {
    const net = unionArea(group)
    const exteriorPerimeter = unionPerimeter(group)
    const interiorLen = includeInterior ? unionInteriorWallLength(group) : 0
    gross += net + extThk * exteriorPerimeter + intThk * interiorLen
  }
  return gross
}

/**
 * Computes per-room metrics plus building-wide aggregates.
 *
 * Per-room contributions are computed against their own category's union (so
 * unrelated overlapping geometry can never erase counted area), which means each
 * column sums exactly to its headline total.
 *
 * Floor-area aggregates are reported both net (interior faces, walls excluded)
 * and gross (walls included) via the configurable wall thicknesses.
 */
export function computeRoomMetrics(rooms, defaultCeilingHeightFt, { exteriorWallFt = 0, interiorWallFt = 0 } = {}) {
  const aurVisible = computeCategoryVisible(rooms, (r) => AUR_TYPES.includes(r.type))
  const conditionedVisible = computeCategoryVisible(rooms, (r) => CONDITIONED_TYPES.includes(r.type))
  const indoorVisible = computeCategoryVisible(rooms, (r) => INDOOR_TYPES.includes(r.type))
  // Flooring: only floored rooms occlude each other ("top room wins"), so a
  // floor-less room (e.g. pool) never erases the material beneath it.
  const floorVisible = computeCategoryVisible(rooms, (r) => FLOOR_MATERIAL[r.type] != null)

  const perRoom = rooms.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    level: roomLevel(r),
    totalSqft: r.widthFt * r.heightFt,
    ceilingHeightFt: r.ceilingHeightFt ?? defaultCeilingHeightFt,
    hasCeilingOverride: r.ceilingHeightFt != null,
    conditionedContribFt: conditionedVisible.get(r.id) || 0,
    aurContribFt: aurVisible.get(r.id) || 0,
    floorLabel: FLOOR_MATERIAL[r.type] ?? null,
    floorVisibleFt: floorVisible.get(r.id) || 0,
  }))

  const aur = perRoom.reduce((s, r) => s + r.aurContribFt, 0)
  const conditioned = perRoom.reduce((s, r) => s + r.conditionedContribFt, 0)
  const footprint = rooms
    .filter((r) => roomLevel(r) === 1 && INDOOR_TYPES.includes(r.type))
    .reduce((s, r) => s + (indoorVisible.get(r.id) || 0), 0)
  const roofFootprint = unionArea(rooms.filter((r) => AUR_TYPES.includes(r.type)))

  const wallMetrics = computeWallMetrics(rooms, defaultCeilingHeightFt)

  const grossOpts = { extThk: exteriorWallFt, intThk: interiorWallFt }
  const aurGross = computeGross(rooms, (r) => AUR_TYPES.includes(r.type), grossOpts)
  const conditionedGross = computeGross(rooms, (r) => CONDITIONED_TYPES.includes(r.type), grossOpts)
  const footprintGross = computeGross(
    rooms,
    (r) => roomLevel(r) === 1 && INDOOR_TYPES.includes(r.type),
    grossOpts
  )
  // Roof spans the whole structure to the exterior face; interior partitions don't apply.
  const roofFootprintGross = computeGross(
    rooms,
    (r) => AUR_TYPES.includes(r.type),
    { extThk: exteriorWallFt, includeInterior: false, acrossLevels: true }
  )

  return {
    perRoom,
    aur,
    conditioned,
    footprint,
    roofFootprint,
    wallMetrics,
    aurGross,
    conditionedGross,
    footprintGross,
    roofFootprintGross,
  }
}

/** Visible flooring area for a set of material types ("top room wins" semantics). */
export function sumFloorVisible(perRoom, types) {
  return perRoom
    .filter((r) => types.includes(r.type))
    .reduce((s, r) => s + r.floorVisibleFt, 0)
}
