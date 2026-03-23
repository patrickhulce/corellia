export const initialState = {
  rooms: [],
  selectedId: null,
  unit: 'ft',
  pixelsPerUnit: 40,
  gridCols: 200,
  gridRows: 200,
  defaultCeilingHeightFt: 9,
}

export function floorplanReducer(state, action) {
  switch (action.type) {
    case 'ADD_ROOM':
      return { ...state, rooms: [...state.rooms, action.room], selectedId: action.room.id }

    case 'MOVE_ROOM':
      return {
        ...state,
        rooms: state.rooms.map((r) =>
          r.id === action.id ? { ...r, x: action.x, y: action.y } : r
        ),
      }

    case 'SELECT_ROOM':
      return { ...state, selectedId: action.id }

    case 'DESELECT':
      return { ...state, selectedId: null }

    case 'DELETE_ROOM':
      return {
        ...state,
        rooms: state.rooms.filter((r) => r.id !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
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

    case 'LOAD_STATE':
      return { ...initialState, ...action.state }

    case 'CLEAR_STATE':
      return { ...initialState }

    default:
      return state
  }
}
