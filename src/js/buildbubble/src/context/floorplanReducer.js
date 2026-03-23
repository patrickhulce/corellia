export const initialState = {
  rooms: [],
  selectedId: null,
  unit: 'ft',
  pixelsPerUnit: 40,
  gridCols: 50,
  gridRows: 40,
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

    case 'SET_PIXELS_PER_UNIT':
      return { ...state, pixelsPerUnit: action.value }

    case 'SET_UNIT':
      return { ...state, unit: action.unit }

    default:
      return state
  }
}
