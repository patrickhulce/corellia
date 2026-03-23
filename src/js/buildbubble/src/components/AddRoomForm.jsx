import { useState } from 'react'
import { useFloorplan } from '../context/FloorplanContext'
import { ROOM_TYPE_OPTIONS } from '../constants/roomTypes'

const FT_TO_M = 0.3048

const defaultForm = { name: '', type: 'living', width: '', height: '' }

export function AddRoomForm() {
  const { state, dispatch } = useFloorplan()
  const { unit } = state
  const [form, setForm] = useState(defaultForm)
  const [error, setError] = useState('')

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const w = parseFloat(form.width)
    const h = parseFloat(form.height)
    if (!form.name.trim()) return setError('Name is required')
    if (!w || w <= 0) return setError('Width must be positive')
    if (!h || h <= 0) return setError('Height must be positive')

    // Always store in feet internally
    const widthFt = unit === 'm' ? w / FT_TO_M : w
    const heightFt = unit === 'm' ? h / FT_TO_M : h

    dispatch({
      type: 'ADD_ROOM',
      room: {
        id: crypto.randomUUID(),
        name: form.name.trim(),
        type: form.type,
        widthFt: Math.round(widthFt * 10) / 10,
        heightFt: Math.round(heightFt * 10) / 10,
        x: 0,
        y: 0,
      },
    })
    setForm(defaultForm)
    setError('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[var(--text)]">Name</label>
        <input
          type="text"
          placeholder="e.g. Master Bedroom"
          value={form.name}
          onChange={set('name')}
          className="input"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[var(--text)]">Type</label>
        <select value={form.type} onChange={set('type')} className="input">
          {ROOM_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs font-medium text-[var(--text)]">Width ({unit})</label>
          <input
            type="number"
            min="1"
            step="0.5"
            placeholder="12"
            value={form.width}
            onChange={set('width')}
            className="input"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs font-medium text-[var(--text)]">Depth ({unit})</label>
          <input
            type="number"
            min="1"
            step="0.5"
            placeholder="10"
            value={form.height}
            onChange={set('height')}
            className="input"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button type="submit" className="btn-primary">Add Room</button>
    </form>
  )
}
