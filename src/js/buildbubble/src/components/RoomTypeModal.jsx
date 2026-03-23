import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ROOM_TYPE_OPTIONS, TYPE_COLORS } from '../constants/roomTypes'

export function RoomTypeModal({ onSelect, onClose }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

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
      <div
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 20,
          maxWidth: 400,
          width: '90%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          style={{
            margin: '0 0 12px',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text-h)',
            letterSpacing: '0.02em',
          }}
        >
          Choose Room Type
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ROOM_TYPE_OPTIONS.map((opt) => {
            const colors = TYPE_COLORS[opt.value] ?? TYPE_COLORS.other
            return (
              <button
                key={opt.value}
                onClick={() => onSelect(opt.value)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: `2px solid ${colors.stroke}`,
                  background: colors.fill,
                  color: colors.stroke,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'transform 0.1s, box-shadow 0.1s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)'
                  e.currentTarget.style.boxShadow = `0 2px 8px ${colors.stroke}44`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}
