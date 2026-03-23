import { useFloorplan } from '../context/FloorplanContext'

export function Toolbar() {
  const { state, dispatch } = useFloorplan()
  const { selectedId } = state
  const disabled = !selectedId

  const handleAction = (actionType) => {
    if (!selectedId) return
    dispatch({ type: actionType, id: selectedId })
  }

  return (
    <div className="absolute top-4 right-4 flex flex-col gap-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2 shadow-lg z-10">
      <button
        disabled={disabled}
        onClick={() => handleAction('BRING_TO_FRONT')}
        className="toolbar-btn"
        title="Bring to Front"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="7 17 2 12 7 7" />
          <polyline points="12 17 7 12 12 7" />
          <path d="M22 18V6" />
        </svg>
      </button>
      <button
        disabled={disabled}
        onClick={() => handleAction('BRING_FORWARD')}
        className="toolbar-btn"
        title="Bring Forward"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="13 17 18 12 13 7" />
          <polyline points="6 17 11 12 6 7" />
        </svg>
      </button>
      <button
        disabled={disabled}
        onClick={() => handleAction('SEND_BACKWARD')}
        className="toolbar-btn"
        title="Send Backward"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="11 7 6 12 11 17" />
          <polyline points="18 7 13 12 18 17" />
        </svg>
      </button>
      <button
        disabled={disabled}
        onClick={() => handleAction('SEND_TO_BACK')}
        className="toolbar-btn"
        title="Send to Back"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 7 22 12 17 17" />
          <polyline points="12 7 17 12 12 17" />
          <path d="M2 6v12" />
        </svg>
      </button>
      <div className="h-px bg-[var(--border)] my-1" />
      <button
        disabled={disabled}
        onClick={() => handleAction('ROTATE_ROOM')}
        className="toolbar-btn"
        title="Rotate 90°"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
      </button>
    </div>
  )
}
