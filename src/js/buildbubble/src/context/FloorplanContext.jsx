import { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react'
import { floorplanReducer, initialState, SNAPSHOT_ACTIONS } from './floorplanReducer'

const STORAGE_KEY = 'buildbubble-floorplan'
const MAX_UNDO = 50

function getInitialState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { ...initialState, ...JSON.parse(saved) }
  } catch { /* ignore corrupt data */ }
  return initialState
}

const FloorplanContext = createContext(null)

export function FloorplanProvider({ children }) {
  const pastRef = useRef([])

  const undoReducer = useCallback((state, action) => {
    if (action.type === 'UNDO') {
      const past = pastRef.current
      if (past.length === 0) return state
      const prev = past.pop()
      return { ...prev, selectedIds: state.selectedIds }
    }

    // Snapshot before applying if this is a meaningful action
    if (SNAPSHOT_ACTIONS.has(action.type)) {
      pastRef.current.push(state)
      if (pastRef.current.length > MAX_UNDO) {
        pastRef.current = pastRef.current.slice(-MAX_UNDO)
      }
    }

    return floorplanReducer(state, action)
  }, [])

  const [state, dispatch] = useReducer(undoReducer, null, getInitialState)

  const debounceRef = useRef(null)
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch { /* quota exceeded */ }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [state])

  return (
    <FloorplanContext.Provider value={{ state, dispatch }}>
      {children}
    </FloorplanContext.Provider>
  )
}

export function useFloorplan() {
  const ctx = useContext(FloorplanContext)
  if (!ctx) throw new Error('useFloorplan must be used within FloorplanProvider')
  return ctx
}
