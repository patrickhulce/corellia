import { useFloorplan } from '../context/FloorplanContext'
import { AddRoomForm } from './AddRoomForm'
import { RoomListItem } from './RoomListItem'
import { ScaleControl } from './ScaleControl'

export function Sidebar() {
  const { state } = useFloorplan()
  const { rooms } = state

  return (
    <aside className="w-72 shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--bg)] overflow-y-auto">
      <div className="p-4 border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-h)] tracking-tight">buildbubble</h1>
        <p className="text-xs text-[var(--text)] mt-0.5">Drag-and-drop floorplan builder</p>
      </div>

      <div className="p-4 border-b border-[var(--border)] flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text)]">Add Room</h2>
        <AddRoomForm />
      </div>

      <div className="p-4 border-b border-[var(--border)] flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text)] mb-1">
          Rooms {rooms.length > 0 && <span className="normal-case font-normal">({rooms.length})</span>}
        </h2>
        {rooms.length === 0 ? (
          <p className="text-xs text-[var(--text)] italic">No rooms yet. Add one above.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {rooms.map((room) => (
              <RoomListItem key={room.id} room={room} />
            ))}
          </div>
        )}
      </div>

      <div className="p-4 mt-auto">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text)] mb-3">View</h2>
        <ScaleControl />
      </div>
    </aside>
  )
}
