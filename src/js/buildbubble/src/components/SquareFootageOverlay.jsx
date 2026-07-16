import { useMemo, useEffect, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFloorplan } from '../context/FloorplanContext'
import { computeRoomMetrics, computeGross, OUTDOOR_TYPES, AUR_TYPES, CONDITIONED_TYPES } from '../utils/areaMetrics'
import { ROOM_TYPE_OPTIONS } from '../constants/roomTypes'

const FT_TO_M = 0.3048

const OUTDOOR_KEY = 'outdoor'

function categoryLabel(type) {
  return ROOM_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? 'Room'
}

function groupKeyFor(room) {
  return OUTDOOR_TYPES.includes(room.type) ? OUTDOOR_KEY : room.level
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function groupTitle(key) {
  return key === OUTDOOR_KEY ? 'Outdoor' : `${ordinal(key)} Floor`
}

export function SquareFootageOverlay({ onClose }) {
  const { state } = useFloorplan()
  const { rooms, unit, defaultCeilingHeightFt, exteriorWallFt, interiorWallFt } = state
  const isMetric = unit === 'm'
  const areaUnit = isMetric ? 'm²' : 'ft²'
  const lenUnit = isMetric ? 'm' : 'ft'
  const areaFactor = isMetric ? FT_TO_M * FT_TO_M : 1

  const fmtArea = useCallback(
    (ft) => `${(ft * areaFactor).toFixed(isMetric ? 1 : 0)} ${areaUnit}`,
    [areaFactor, isMetric, areaUnit]
  )
  const fmtLen = useCallback(
    (ft) => (ft == null ? '—' : `${(ft * (isMetric ? FT_TO_M : 1)).toFixed(1)} ${lenUnit}`),
    [isMetric, lenUnit]
  )

  // Plain-number formatters (no unit suffix) so Excel parses cells as numbers.
  const numArea = useCallback(
    (ft) => (ft * areaFactor).toFixed(isMetric ? 1 : 0),
    [areaFactor, isMetric]
  )
  const numLen = useCallback(
    (ft) => (ft == null ? '' : (ft * (isMetric ? FT_TO_M : 1)).toFixed(1)),
    [isMetric]
  )

  const [copied, setCopied] = useState(false)

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' || e.key === '`') {
        e.preventDefault()
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const { groups, grand } = useMemo(() => {
    const grossOpts = { extThk: exteriorWallFt, intThk: interiorWallFt }
    const { perRoom, aurGross, conditionedGross, footprintGross } = computeRoomMetrics(
      rooms,
      defaultCeilingHeightFt,
      { exteriorWallFt, interiorWallFt }
    )

    // Aggregate by (groupKey, name), and keep the raw rooms per group for gross math.
    const byGroup = new Map()
    const roomsByGroup = new Map()
    for (const room of rooms) {
      const m = perRoom.find((p) => p.id === room.id)
      if (!m) continue
      const gKey = groupKeyFor(m)
      if (!byGroup.has(gKey)) byGroup.set(gKey, new Map())
      if (!roomsByGroup.has(gKey)) roomsByGroup.set(gKey, [])
      roomsByGroup.get(gKey).push(room)
      const rowMap = byGroup.get(gKey)
      const rowKey = m.name
      if (!rowMap.has(rowKey)) {
        rowMap.set(rowKey, {
          name: m.name,
          type: m.type,
          count: 0,
          totalSqft: 0,
          conditionedContribFt: 0,
          aurContribFt: 0,
          floorLabel: m.floorLabel,
          ceilings: new Set(),
        })
      }
      const row = rowMap.get(rowKey)
      row.count += 1
      row.totalSqft += m.totalSqft
      row.conditionedContribFt += m.conditionedContribFt
      row.aurContribFt += m.aurContribFt
      row.ceilings.add(m.ceilingHeightFt)
    }

    // Order groups: numeric levels ascending, then Outdoor.
    const keys = [...byGroup.keys()].sort((a, b) => {
      if (a === OUTDOOR_KEY) return 1
      if (b === OUTDOOR_KEY) return -1
      return a - b
    })

    const groups = keys.map((key) => {
      const rows = [...byGroup.get(key).values()]
        .map((r) => ({
          ...r,
          ceiling: r.ceilings.size === 1 ? [...r.ceilings][0] : null,
        }))
        .sort((a, b) => b.totalSqft - a.totalSqft)
      const subtotal = rows.reduce(
        (acc, r) => ({
          totalSqft: acc.totalSqft + r.totalSqft,
          conditionedContribFt: acc.conditionedContribFt + r.conditionedContribFt,
          aurContribFt: acc.aurContribFt + r.aurContribFt,
        }),
        { totalSqft: 0, conditionedContribFt: 0, aurContribFt: 0 }
      )
      const groupRooms = roomsByGroup.get(key) ?? []
      const isOutdoor = key === OUTDOOR_KEY
      const gross = {
        conditionedFt: isOutdoor ? 0 : computeGross(groupRooms, (r) => CONDITIONED_TYPES.includes(r.type), grossOpts),
        aurFt: isOutdoor ? 0 : computeGross(groupRooms, (r) => AUR_TYPES.includes(r.type), grossOpts),
      }
      return { key, title: groupTitle(key), rows, subtotal, gross, isOutdoor }
    })

    const grand = groups.reduce(
      (acc, g) => ({
        totalSqft: acc.totalSqft + g.subtotal.totalSqft,
        conditionedContribFt: acc.conditionedContribFt + g.subtotal.conditionedContribFt,
        aurContribFt: acc.aurContribFt + g.subtotal.aurContribFt,
      }),
      { totalSqft: 0, conditionedContribFt: 0, aurContribFt: 0 }
    )
    grand.conditionedGrossFt = conditionedGross
    grand.aurGrossFt = aurGross
    grand.footprintGrossFt = footprintGross

    return { groups, grand }
  }, [rooms, defaultCeilingHeightFt, exteriorWallFt, interiorWallFt])

  const buildTsv = useCallback(() => {
    const header = [
      'Floor',
      'Name',
      'Category',
      'Count',
      `Total (${areaUnit})`,
      `Ceiling (${lenUnit})`,
      `Conditioned (${areaUnit})`,
      `AUR (${areaUnit})`,
      'Floor Material',
    ]
    const lines = [header]
    for (const group of groups) {
      for (const row of group.rows) {
        lines.push([
          group.title,
          row.name,
          categoryLabel(row.type),
          String(row.count),
          numArea(row.totalSqft),
          numLen(row.ceiling),
          numArea(row.conditionedContribFt),
          numArea(row.aurContribFt),
          row.floorLabel ?? '',
        ])
      }
      lines.push([
        `${group.title} Subtotal`,
        '', '', '',
        numArea(group.subtotal.totalSqft),
        '',
        numArea(group.isOutdoor ? group.subtotal.conditionedContribFt : group.gross.conditionedFt),
        numArea(group.isOutdoor ? group.subtotal.aurContribFt : group.gross.aurFt),
        '',
      ])
      if (!group.isOutdoor) {
        lines.push([
          `${group.title} Usable (net)`,
          '', '', '', '', '',
          numArea(group.subtotal.conditionedContribFt),
          numArea(group.subtotal.aurContribFt),
          '',
        ])
      }
    }
    lines.push([
      'Grand Total',
      '', '', '',
      numArea(grand.totalSqft),
      '',
      numArea(grand.conditionedGrossFt),
      numArea(grand.aurGrossFt),
      '',
    ])
    lines.push([
      'Grand Total (Usable, net)',
      '', '', '', '', '',
      numArea(grand.conditionedContribFt),
      numArea(grand.aurContribFt),
      '',
    ])
    lines.push([
      'Footprint (gross)',
      '', '', '',
      numArea(grand.footprintGrossFt),
      '', '', '', '',
    ])
    return lines.map((cols) => cols.join('\t')).join('\n')
  }, [groups, grand, areaUnit, lenUnit, numArea, numLen])

  const handleCopy = useCallback(async () => {
    const tsv = buildTsv()
    try {
      await navigator.clipboard.writeText(tsv)
    } catch {
      // Fallback for environments without async clipboard access.
      const ta = document.createElement('textarea')
      ta.value = tsv
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* ignore */ }
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [buildTsv])

  const numColClass = 'px-3 py-1.5 text-right tabular-nums whitespace-nowrap'
  const headColClass = 'px-3 py-2 text-right font-semibold uppercase tracking-wider text-[10px] sticky top-0 bg-[var(--bg)] z-10'

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          width: 'min(1000px, 96vw)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-h)' }}>
              Per-Room Square Footage Breakdown
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text)' }}>
              Grouped by floor &amp; name · sequenced by level then descending area · press ` or Esc to close
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCopy} className="btn-primary" style={{ width: 'auto', padding: '6px 14px', fontSize: 13 }}>
              {copied ? 'Copied!' : 'Copy for Excel'}
            </button>
            <button onClick={onClose} className="toolbar-btn" style={{ padding: '6px 14px', fontSize: 13 }}>
              Close
            </button>
          </div>
        </div>

        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: 'var(--text)' }}>
            <thead>
              <tr style={{ color: 'var(--text-h)' }}>
                <th className={headColClass} style={{ textAlign: 'left' }}>Name</th>
                <th className={headColClass} style={{ textAlign: 'left' }}>Category</th>
                <th className={headColClass}>Total {areaUnit}</th>
                <th className={headColClass}>Ceiling</th>
                <th className={headColClass}>Conditioned</th>
                <th className={headColClass}>AUR</th>
                <th className={headColClass} style={{ textAlign: 'left' }}>Floor</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <GroupRows
                  key={String(group.key)}
                  group={group}
                  fmtArea={fmtArea}
                  fmtLen={fmtLen}
                  numColClass={numColClass}
                />
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', color: 'var(--text-h)', fontWeight: 600 }}>
                <td className="px-3 py-2" colSpan={2}>Grand Total</td>
                <td className={numColClass}>{fmtArea(grand.totalSqft)}</td>
                <td className={numColClass}>—</td>
                <td className={numColClass}>{fmtArea(grand.conditionedGrossFt)}</td>
                <td className={numColClass}>{fmtArea(grand.aurGrossFt)}</td>
                <td className="px-3 py-2" />
              </tr>
              <tr style={{ color: 'var(--text)', fontWeight: 500, fontStyle: 'italic' }}>
                <td className="px-3 py-1.5" colSpan={4}>Grand Total (Usable, net)</td>
                <td className={numColClass}>{fmtArea(grand.conditionedContribFt)}</td>
                <td className={numColClass}>{fmtArea(grand.aurContribFt)}</td>
                <td className="px-3 py-1.5" />
              </tr>
              <tr style={{ color: 'var(--text-h)', fontWeight: 600 }}>
                <td className="px-3 py-1.5" colSpan={2}>Footprint (gross)</td>
                <td className={numColClass}>{fmtArea(grand.footprintGrossFt)}</td>
                <td className={numColClass} colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>,
    document.body
  )
}

function GroupRows({ group, fmtArea, fmtLen, numColClass }) {
  return (
    <>
      <tr style={{ background: 'var(--social-bg, rgba(127,127,127,0.08))' }}>
        <td
          colSpan={7}
          className="px-3 py-1.5"
          style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}
        >
          {group.title}
        </td>
      </tr>
      {group.rows.map((row) => (
        <tr key={`${group.key}-${row.name}`} style={{ borderTop: '1px solid var(--border)' }}>
          <td className="px-3 py-1.5" style={{ color: 'var(--text-h)' }}>
            {row.name}
            {row.count > 1 && (
              <span style={{ color: 'var(--text)', fontWeight: 400 }}> ×{row.count}</span>
            )}
          </td>
          <td className="px-3 py-1.5">{categoryLabel(row.type)}</td>
          <td className={numColClass}>{fmtArea(row.totalSqft)}</td>
          <td className={numColClass}>{fmtLen(row.ceiling)}</td>
          <td className={numColClass}>{fmtArea(row.conditionedContribFt)}</td>
          <td className={numColClass}>{fmtArea(row.aurContribFt)}</td>
          <td className="px-3 py-1.5">{row.floorLabel ?? '—'}</td>
        </tr>
      ))}
      <tr style={{ borderTop: '1px solid var(--border)', color: 'var(--text-h)', fontWeight: 600 }}>
        <td className="px-3 py-1.5" colSpan={2}>{group.title} Subtotal</td>
        <td className={numColClass}>{fmtArea(group.subtotal.totalSqft)}</td>
        <td className={numColClass}>—</td>
        <td className={numColClass}>{fmtArea(group.isOutdoor ? group.subtotal.conditionedContribFt : group.gross.conditionedFt)}</td>
        <td className={numColClass}>{fmtArea(group.isOutdoor ? group.subtotal.aurContribFt : group.gross.aurFt)}</td>
        <td className="px-3 py-1.5" />
      </tr>
      {!group.isOutdoor && (
        <tr style={{ color: 'var(--text)', fontWeight: 500, fontStyle: 'italic' }}>
          <td className="px-3 py-1" colSpan={4}>{group.title} Usable (net)</td>
          <td className={numColClass}>{fmtArea(group.subtotal.conditionedContribFt)}</td>
          <td className={numColClass}>{fmtArea(group.subtotal.aurContribFt)}</td>
          <td className="px-3 py-1" />
        </tr>
      )}
    </>
  )
}
