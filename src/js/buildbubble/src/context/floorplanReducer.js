export const initialState = {
  rooms: [],
  selectedIds: [],
  activeLevel: 1,
  unit: 'ft',
  pixelsPerUnit: 40,
  gridCols: 200,
  gridRows: 200,
  defaultCeilingHeightFt: 9,
  roofPitch: '6/12',
}

export function floorplanReducer(state, action) {
  switch (action.type) {
    case 'SET_ACTIVE_LEVEL':
      return { ...state, activeLevel: action.level, selectedIds: [] }

    case 'ADD_ROOM':
      return { ...state, rooms: [...state.rooms, action.room], selectedIds: [action.room.id] }

    case 'MOVE_ROOM':
      return {
        ...state,
        rooms: state.rooms.map((r) =>
          r.id === action.id ? { ...r, x: action.x, y: action.y } : r
        ),
      }

    case 'MOVE_ROOMS':
      return {
        ...state,
        rooms: state.rooms.map((r) => {
          if (!action.ids.includes(r.id)) return r
          const gridCols = state.gridCols
          const gridRows = state.gridRows
          return {
            ...r,
            x: Math.max(0, Math.min(r.x + action.dx, gridCols - r.widthFt)),
            y: Math.max(0, Math.min(r.y + action.dy, gridRows - r.heightFt)),
          }
        }),
      }

    case 'SELECT_ROOM':
      return { ...state, selectedIds: [action.id] }

    case 'TOGGLE_ROOM_SELECTION':
      return {
        ...state,
        selectedIds: state.selectedIds.includes(action.id)
          ? state.selectedIds.filter((id) => id !== action.id)
          : [...state.selectedIds, action.id],
      }

    case 'SELECT_ROOMS':
      return { ...state, selectedIds: action.ids }

    case 'DESELECT':
      return { ...state, selectedIds: [] }

    case 'DELETE_ROOM':
      return {
        ...state,
        rooms: state.rooms.filter((r) => r.id !== action.id),
        selectedIds: state.selectedIds.filter((id) => id !== action.id),
      }

    case 'RESIZE_ROOM':
      return {
        ...state,
        rooms: state.rooms.map((r) =>
          r.id === action.id
            ? { ...r, x: action.x, y: action.y, widthFt: action.widthFt, heightFt: action.heightFt }
            : r
        ),
      }

    case 'UPDATE_ROOM':
      return {
        ...state,
        rooms: state.rooms.map((r) =>
          r.id === action.id ? { ...r, ...action.updates } : r
        ),
      }

    case 'SET_PIXELS_PER_UNIT':
      return { ...state, pixelsPerUnit: Math.min(120, Math.max(4, action.value)) }

    case 'SET_UNIT':
      return { ...state, unit: action.unit }

    case 'SET_DEFAULT_CEILING_HEIGHT':
      return { ...state, defaultCeilingHeightFt: action.value }

    case 'SET_ROOF_PITCH':
      return { ...state, roofPitch: action.value }

    case 'BRING_TO_FRONT':
      return {
        ...state,
        rooms: state.rooms.filter((r) => r.id !== action.id).concat(state.rooms.find((r) => r.id === action.id)),
      }

    case 'SEND_TO_BACK':
      return {
        ...state,
        rooms: [state.rooms.find((r) => r.id === action.id), ...state.rooms.filter((r) => r.id !== action.id)],
      }

    case 'BRING_FORWARD': {
      const idx = state.rooms.findIndex((r) => r.id === action.id)
      if (idx === -1 || idx === state.rooms.length - 1) return state
      const newRooms = [...state.rooms]
      ;[newRooms[idx], newRooms[idx + 1]] = [newRooms[idx + 1], newRooms[idx]]
      return { ...state, rooms: newRooms }
    }

    case 'SEND_BACKWARD': {
      const idx = state.rooms.findIndex((r) => r.id === action.id)
      if (idx === -1 || idx === 0) return state
      const newRooms = [...state.rooms]
      ;[newRooms[idx], newRooms[idx - 1]] = [newRooms[idx - 1], newRooms[idx]]
      return { ...state, rooms: newRooms }
    }

    case 'ROTATE_ROOM':
      return {
        ...state,
        rooms: state.rooms.map((r) =>
          r.id === action.id
            ? { ...r, widthFt: r.heightFt, heightFt: r.widthFt }
            : r
        ),
      }

    case 'LOAD_STATE': {
      const loaded = { ...initialState, ...action.state }
      // Migrate old selectedId → selectedIds
      if ('selectedId' in action.state && !('selectedIds' in action.state)) {
        loaded.selectedIds = action.state.selectedId ? [action.state.selectedId] : []
        delete loaded.selectedId
      }
      // Ensure activeLevel is set
      if (!('activeLevel' in action.state)) {
        loaded.activeLevel = 1
      }
      return loaded
    }

    case 'CLEAR_STATE':
      return { ...initialState }

    // Sentinel actions dispatched before drags/resizes begin (handled by undo wrapper)
    case 'DRAG_START':
    case 'RESIZE_START':
      return state

    // UNDO is handled by the undo wrapper, not here
    case 'UNDO':
      return state

    default:
      return state
  }
}

// Actions that should snapshot state for undo
export const SNAPSHOT_ACTIONS = new Set([
  'ADD_ROOM', 'DELETE_ROOM', 'UPDATE_ROOM', 'ROTATE_ROOM',
  'BRING_TO_FRONT', 'SEND_TO_BACK', 'BRING_FORWARD', 'SEND_BACKWARD',
  'CLEAR_STATE', 'SET_DEFAULT_CEILING_HEIGHT', 'SET_ROOF_PITCH', 'SET_UNIT',
  'DRAG_START', 'RESIZE_START', 'SET_ACTIVE_LEVEL',
])
