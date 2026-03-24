import { useMemo } from 'react'
import { useFloorplan } from '../context/FloorplanContext'

const FT_TO_M = 0.3048

const INDOOR_TYPES = ['living', 'bedroom', 'bathroom', 'kitchen', 'dining', 'office', 'garage', 'hallway', 'closet', 'other']

const MATERIAL_CATEGORIES = [
  { label: 'Sod', types: ['grass'] },
  { label: 'Driveway', types: ['driveway'] },
  { label: 'Tile', types: ['bathroom'] },
  { label: 'Patio', types: ['patio'] },
  { label: 'LVP', types: ['living', 'dining', 'kitchen', 'hallway', 'office', 'other'] },
  { label: 'Carpet', types: ['bedroom', 'closet'] },
]

const AUR_TYPES = [...INDOOR_TYPES, 'pergola']

const ROOF_PITCHES = [
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

/** Returns the intersection of two axis-aligned rects, or null if they don't overlap. */
function rectIntersection(a, b) {
  const x0 = Math.max(a.x, b.x)
  const y0 = Math.max(a.y, b.y)
  const x1 = Math.min(a.x + a.widthFt, b.x + b.widthFt)
  const y1 = Math.min(a.y + a.heightFt, b.y + b.heightFt)
  if (x1 <= x0 || y1 <= y0) return null
  return { x: x0, y: y0, widthFt: x1 - x0, heightFt: y1 - y0 }
}

/** Computes the union area of a set of axis-aligned rects via coordinate compression. */
function unionArea(rects) {
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
 * Computes the visible (uncovered) area for each room.
 * Rooms later in the array are higher in the layer stack and occlude earlier rooms.
 */
function computeVisibleAreas(rooms) {
  const areas = new Map()
  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i]
    const totalArea = room.widthFt * room.heightFt
    // Collect intersections with all higher-layer rooms
    const overlaps = []
    for (let j = i + 1; j < rooms.length; j++) {
      const clip = rectIntersection(room, rooms[j])
      if (clip) overlaps.push(clip)
    }
    areas.set(room.id, totalArea - unionArea(overlaps))
  }
  return areas
}

function computeWallMetrics(rooms, defaultCeilingHeightFt) {
  const indoorRooms = rooms.filter((r) => INDOOR_TYPES.includes(r.type))
  const levels = new Map()
  for (const r of indoorRooms) {
    const lvl = r.level ?? 1
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

        // A-right touches B-left
        if (a.x + a.widthFt === b.x) {
          const overlapStart = Math.max(a.y, b.y)
          const overlapEnd = Math.min(a.y + a.heightFt, b.y + b.heightFt)
          if (overlapEnd > overlapStart) sharedLength += overlapEnd - overlapStart
        }
        // B-right touches A-left
        if (b.x + b.widthFt === a.x) {
          const overlapStart = Math.max(a.y, b.y)
          const overlapEnd = Math.min(a.y + a.heightFt, b.y + b.heightFt)
          if (overlapEnd > overlapStart) sharedLength += overlapEnd - overlapStart
        }
        // A-bottom touches B-top
        if (a.y + a.heightFt === b.y) {
          const overlapStart = Math.max(a.x, b.x)
          const overlapEnd = Math.min(a.x + a.widthFt, b.x + b.widthFt)
          if (overlapEnd > overlapStart) sharedLength += overlapEnd - overlapStart
        }
        // B-bottom touches A-top
        if (b.y + b.heightFt === a.y) {
          const overlapStart = Math.max(a.x, b.x)
          const overlapEnd = Math.min(a.x + a.widthFt, b.x + b.widthFt)
          if (overlapEnd > overlapStart) sharedLength += overlapEnd - overlapStart
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

function sumVisibleArea(rooms, visibleAreas, types) {
  return rooms
    .filter((r) => types.includes(r.type))
    .reduce((sum, r) => sum + (visibleAreas.get(r.id) || 0), 0)
}

function OverviewRow({ label, area, conversionFactor, isMetric, unitLabel }) {
  const displayArea = (area * conversionFactor).toFixed(isMetric ? 1 : 0)
  return (
    <div className="flex items-center justify-between text-xs text-[var(--text)]">
      <span>{label}</span>
      <span className="font-medium tabular-nums">{displayArea} {unitLabel}</span>
    </div>
  )
}

export function MaterialOverview() {
  const { state } = useFloorplan()
  const { rooms, unit, defaultCeilingHeightFt, roofPitch } = state
  const isMetric = unit === 'm'
  const unitLabel = isMetric ? 'm²' : 'ft²'
  const conversionFactor = isMetric ? FT_TO_M * FT_TO_M : 1

  // Compute visible areas per-level so rooms on different floors don't occlude each other
  const visibleAreas = useMemo(() => {
    const levels = new Map()
    for (const r of rooms) {
      const lvl = r.level ?? 1
      if (!levels.has(lvl)) levels.set(lvl, [])
      levels.get(lvl).push(r)
    }
    const combined = new Map()
    for (const levelRooms of levels.values()) {
      const levelAreas = computeVisibleAreas(levelRooms)
      for (const [id, area] of levelAreas) combined.set(id, area)
    }
    return combined
  }, [rooms])

  const groundFloorRooms = rooms.filter((r) => (r.level ?? 1) === 1)

  const aurArea = sumVisibleArea(rooms, visibleAreas, AUR_TYPES)
  const garageArea = sumVisibleArea(rooms, visibleAreas, ['garage'])
  const footprintArea = sumVisibleArea(groundFloorRooms, visibleAreas, INDOOR_TYPES)

  const roofFootprintArea = useMemo(() => {
    const aurRooms = rooms.filter((r) => AUR_TYPES.includes(r.type))
    return unionArea(aurRooms)
  }, [rooms])

  const pitchMultiplier = (ROOF_PITCHES.find((p) => p.label === roofPitch) ?? ROOF_PITCHES[2]).multiplier
  const roofingArea = roofFootprintArea * pitchMultiplier

  const wallMetrics = useMemo(() => computeWallMetrics(rooms, defaultCeilingHeightFt), [rooms, defaultCeilingHeightFt])

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-h)]">Structural</p>
      <OverviewRow label="Area Under Roof" area={aurArea} conversionFactor={conversionFactor} isMetric={isMetric} unitLabel={unitLabel} />
      <OverviewRow label="Conditioned" area={aurArea - garageArea} conversionFactor={conversionFactor} isMetric={isMetric} unitLabel={unitLabel} />
      <OverviewRow label="Footprint" area={footprintArea} conversionFactor={conversionFactor} isMetric={isMetric} unitLabel={unitLabel} />
      <OverviewRow label="Roof Footprint" area={roofFootprintArea} conversionFactor={conversionFactor} isMetric={isMetric} unitLabel={unitLabel} />
      <OverviewRow label="Ext. Cladding" area={wallMetrics.exteriorArea} conversionFactor={conversionFactor} isMetric={isMetric} unitLabel={unitLabel} />
      <OverviewRow label="Framing" area={wallMetrics.framingArea} conversionFactor={conversionFactor} isMetric={isMetric} unitLabel={unitLabel} />
      <OverviewRow label="Drywall" area={wallMetrics.drywallArea} conversionFactor={conversionFactor} isMetric={isMetric} unitLabel={unitLabel} />

      <hr className="border-[var(--border)] my-1" />

      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-h)]">Materials</p>
      <OverviewRow label="Foundation" area={footprintArea} conversionFactor={conversionFactor} isMetric={isMetric} unitLabel={unitLabel} />
      <OverviewRow label="Roofing" area={roofingArea} conversionFactor={conversionFactor} isMetric={isMetric} unitLabel={unitLabel} />
      {MATERIAL_CATEGORIES.map(({ label, types }) => (
        <OverviewRow key={label} label={label} area={sumVisibleArea(rooms, visibleAreas, types)} conversionFactor={conversionFactor} isMetric={isMetric} unitLabel={unitLabel} />
      ))}
    </div>
  )
}
