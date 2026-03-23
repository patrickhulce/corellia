import { createContext, useContext, useReducer } from 'react'
import { floorplanReducer, initialState } from './floorplanReducer'

const FloorplanContext = createContext(null)

export function FloorplanProvider({ children }) {
  const [state, dispatch] = useReducer(floorplanReducer, initialState)
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
