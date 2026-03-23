import { createContext, useContext, useReducer, useEffect, useRef } from 'react'
import { floorplanReducer, initialState } from './floorplanReducer'

const STORAGE_KEY = 'buildbubble-floorplan'

function getInitialState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { ...initialState, ...JSON.parse(saved) }
  } catch { /* ignore corrupt data */ }
  return initialState
}

const FloorplanContext = createContext(null)

export function FloorplanProvider({ children }) {
  const [state, dispatch] = useReducer(floorplanReducer, null, getInitialState)

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
