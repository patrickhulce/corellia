import { useState } from 'react'

export function AccordionPanel({ title, defaultOpen = false, badge, children }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-[var(--border)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-[var(--accent-bg)] transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text)]">{title}</span>
          {badge != null && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[var(--accent-bg)] text-[var(--text)]">
              {badge}
            </span>
          )}
        </span>
        <svg
          className="w-3.5 h-3.5 text-[var(--text)] transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 pt-1 pb-4 flex flex-col gap-3">{children}</div>}
    </div>
  )
}
