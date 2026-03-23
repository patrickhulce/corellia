import { useRef } from 'react'
import { useFloorplan } from '../context/FloorplanContext'

const STORAGE_KEY = 'buildbubble-floorplan'

export function FileManagement() {
  const { state, dispatch } = useFloorplan()
  const fileInputRef = useRef(null)

  const handleSave = () => {
    const json = JSON.stringify(state, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'floorplan.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleLoad = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result)
        dispatch({ type: 'LOAD_STATE', state: parsed })
      } catch {
        alert('Invalid floorplan file.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleClear = () => {
    if (state.rooms.length > 0 && !confirm('Clear all rooms and reset?')) return
    localStorage.removeItem(STORAGE_KEY)
    dispatch({ type: 'CLEAR_STATE' })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button type="button" onClick={handleSave} className="btn-secondary flex-1 text-xs">
          Save
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary flex-1 text-xs">
          Load
        </button>
      </div>
      <button type="button" onClick={handleClear} className="btn-secondary text-xs text-red-500 hover:text-red-600">
        Clear All
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleLoad}
        className="hidden"
      />
    </div>
  )
}
