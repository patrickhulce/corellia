import { useMemo } from 'react'
import { useFloorplan } from '../context/FloorplanContext'
import {
  MATERIAL_CATEGORIES,
  computeRoomMetrics,
  getPitchMultiplier,
  sumFloorVisible,
} from '../utils/areaMetrics'

const FT_TO_M = 0.3048

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
  const { rooms, unit, defaultCeilingHeightFt, roofPitch, exteriorWallFt, interiorWallFt } = state
  const isMetric = unit === 'm'
  const unitLabel = isMetric ? 'm²' : 'ft²'
  const conversionFactor = isMetric ? FT_TO_M * FT_TO_M : 1

  const metrics = useMemo(
    () => computeRoomMetrics(rooms, defaultCeilingHeightFt, { exteriorWallFt, interiorWallFt }),
    [rooms, defaultCeilingHeightFt, exteriorWallFt, interiorWallFt]
  )

  const {
    conditioned, wallMetrics, perRoom,
    aurGross, conditionedGross, footprintGross, roofFootprintGross,
  } = metrics

  const roofingGross = roofFootprintGross * getPitchMultiplier(roofPitch)

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-h)]">Structural</p>
      <OverviewRow label="Area Under Roof" area={aurGross} conversionFactor={conversionFactor} isMetric={isMetric} unitLabel={unitLabel} />
      <OverviewRow label="Conditioned" area={conditionedGross} conversionFactor={conversionFactor} isMetric={isMetric} unitLabel={unitLabel} />
      <OverviewRow label="Conditioned (Usable)" area={conditioned} conversionFactor={conversionFactor} isMetric={isMetric} unitLabel={unitLabel} />
      <OverviewRow label="Footprint" area={footprintGross} conversionFactor={conversionFactor} isMetric={isMetric} unitLabel={unitLabel} />
      <OverviewRow label="Roof Footprint" area={roofFootprintGross} conversionFactor={conversionFactor} isMetric={isMetric} unitLabel={unitLabel} />
      <OverviewRow label="Ext. Cladding" area={wallMetrics.exteriorArea} conversionFactor={conversionFactor} isMetric={isMetric} unitLabel={unitLabel} />
      <OverviewRow label="Framing" area={wallMetrics.framingArea} conversionFactor={conversionFactor} isMetric={isMetric} unitLabel={unitLabel} />
      <OverviewRow label="Drywall" area={wallMetrics.drywallArea} conversionFactor={conversionFactor} isMetric={isMetric} unitLabel={unitLabel} />

      <hr className="border-[var(--border)] my-1" />

      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-h)]">Materials</p>
      <OverviewRow label="Foundation" area={footprintGross} conversionFactor={conversionFactor} isMetric={isMetric} unitLabel={unitLabel} />
      <OverviewRow label="Roofing" area={roofingGross} conversionFactor={conversionFactor} isMetric={isMetric} unitLabel={unitLabel} />
      {MATERIAL_CATEGORIES.map(({ label, types }) => (
        <OverviewRow key={label} label={label} area={sumFloorVisible(perRoom, types)} conversionFactor={conversionFactor} isMetric={isMetric} unitLabel={unitLabel} />
      ))}
    </div>
  )
}
