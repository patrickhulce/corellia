import { useFloorplan } from '../context/FloorplanContext'
import { AddRoomForm } from './AddRoomForm'
import { RoomListItem } from './RoomListItem'
import { ScaleControl } from './ScaleControl'
import { FileManagement } from './FileManagement'
import { AccordionPanel } from './AccordionPanel'
import { MaterialOverview } from './MaterialOverview'

const FT_TO_M = 0.3048

export function Sidebar() {
  const { state, dispatch } = useFloorplan()
  const { rooms, unit, defaultCeilingHeightFt, roofPitch } = state

  const displayCeiling = unit === 'm'
    ? (defaultCeilingHeightFt * FT_TO_M).toFixed(1)
    : defaultCeilingHeightFt

  const handleCeilingChange = (e) => {
    const val = parseFloat(e.target.value)
    if (!val || val <= 0) return
    const ft = unit === 'm' ? val / FT_TO_M : val
    dispatch({ type: 'SET_DEFAULT_CEILING_HEIGHT', value: Math.round(ft * 10) / 10 })
  }

  return (
    <aside className="w-72 shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--bg)] overflow-y-auto">
      <div className="p-4 border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-h)] tracking-tight">buildbubble</h1>
        <p className="text-xs text-[var(--text)] mt-0.5">Drag-and-drop floorplan builder</p>
      </div>

      <AccordionPanel title="Build" defaultOpen>
        <AddRoomForm />
      </AccordionPanel>

      <AccordionPanel title="Overview" defaultOpen>
        <MaterialOverview />
      </AccordionPanel>

      <AccordionPanel title="Space Details" badge={rooms.length > 0 ? rooms.length : null}>
        {rooms.length === 0 ? (
          <p className="text-xs text-[var(--text)] italic">No rooms yet. Add one above.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {rooms.map((room) => (
              <RoomListItem key={room.id} room={room} />
            ))}
          </div>
        )}
      </AccordionPanel>

      <AccordionPanel title="Settings">
        <FileManagement />
        <ScaleControl />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--text)]">Default Ceiling Height ({unit})</label>
          <input
            type="number"
            min="1"
            step="0.5"
            value={displayCeiling}
            onChange={handleCeilingChange}
            className="input"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--text)]">Roof Pitch</label>
          <select
            value={roofPitch}
            onChange={(e) => dispatch({ type: 'SET_ROOF_PITCH', value: e.target.value })}
            className="input"
          >
            {['4/12', '5/12', '6/12', '7/12', '8/12', '9/12', '10/12', '11/12', '12/12'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </AccordionPanel>
    </aside>
  )
}
