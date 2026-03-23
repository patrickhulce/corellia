import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

export function RoomEditModal({ room, onSave, onClose, defaultCeilingHeightFt }) {
  const [name, setName] = useState(room.name)
  const [ceilingHeight, setCeilingHeight] = useState(room.ceilingHeightFt != null ? room.ceilingHeightFt : '')

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleSubmit = (e) => {
    e.preventDefault()
    const updates = { name: name.trim() || room.name }
    if (ceilingHeight === '' || ceilingHeight === null) {
      updates.ceilingHeightFt = null
    } else {
      const val = parseFloat(ceilingHeight)
      if (val > 0) updates.ceilingHeightFt = Math.round(val * 10) / 10
    }
    onSave(room.id, updates)
    onClose()
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.35)',
      }}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 20,
          maxWidth: 340,
          width: '90%',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text-h)',
            letterSpacing: '0.02em',
          }}
        >
          Edit Room
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>Name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>Ceiling Height (ft)</label>
          <input
            className="input"
            type="number"
            min="1"
            step="0.5"
            value={ceilingHeight}
            placeholder={defaultCeilingHeightFt}
            onChange={(e) => setCeilingHeight(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            className="toolbar-btn"
            style={{ padding: '6px 14px', fontSize: 13 }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            style={{ width: 'auto', padding: '6px 18px', fontSize: 13 }}
          >
            Save
          </button>
        </div>
      </form>
    </div>,
    document.body
  )
}
