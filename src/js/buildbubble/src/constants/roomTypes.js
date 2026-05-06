export const ROOM_TYPE_OPTIONS = [
  { value: 'living',   label: 'Living Room' },
  { value: 'bedroom',  label: 'Bedroom' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'kitchen',  label: 'Kitchen' },
  { value: 'dining',   label: 'Dining Room' },
  { value: 'office',   label: 'Office' },
  { value: 'garage',   label: 'Garage' },
  { value: 'hallway',  label: 'Hallway' },
  { value: 'grass',    label: 'Grass' },
  { value: 'driveway', label: 'Driveway' },
  { value: 'patio',    label: 'Patio' },
  { value: 'pool',     label: 'Pool' },
  { value: 'lanai',    label: 'Lanai' },
  { value: 'closet',   label: 'Closet' },
  { value: 'other',    label: 'Other' },
]

export const TYPE_COLORS = {
  living:   { fill: '#dbeafe', stroke: '#3b82f6', pillBg: '#60a5fa' }, // blue-400
  bedroom:  { fill: '#dcfce7', stroke: '#22c55e', pillBg: '#4ade80' }, // green-400
  bathroom: { fill: '#e0f2fe', stroke: '#0ea5e9', pillBg: '#38bdf8' }, // sky-400
  kitchen:  { fill: '#fef9c3', stroke: '#eab308', pillBg: '#facc15' }, // yellow-400
  dining:   { fill: '#fce7f3', stroke: '#ec4899', pillBg: '#f472b6' }, // pink-400
  office:   { fill: '#ede9fe', stroke: '#8b5cf6', pillBg: '#a78bfa' }, // violet-400
  garage:   { fill: '#f3f4f6', stroke: '#6b7280', pillBg: '#9ca3af' }, // gray-400
  hallway:  { fill: '#f5f5f4', stroke: '#78716c', pillBg: '#a8a29e' }, // stone-400
  grass:    { fill: '#ecfccb', stroke: '#65a30d', pillBg: '#a3e635' }, // lime-400
  driveway: { fill: '#e2e8f0', stroke: '#475569', pillBg: '#94a3b8' }, // slate-400
  patio:    { fill: '#fed7aa', stroke: '#c2410c', pillBg: '#fb923c' }, // orange-400
  pool:     { fill: '#cffafe', stroke: '#06b6d4', pillBg: '#22d3ee' }, // cyan-400
  lanai:    { fill: '#fef3c7', stroke: '#d97706', pillBg: '#fbbf24' }, // amber-400
  closet:   { fill: '#e0e7ff', stroke: '#6366f1', pillBg: '#818cf8' }, // indigo-400
  other:    { fill: '#ffedd5', stroke: '#f97316', pillBg: '#fb923c' }, // orange-400
}

export const DEFAULT_DIMENSIONS = {
  living:   { widthFt: 20, heightFt: 20 },
  bedroom:  { widthFt: 12, heightFt: 11 },
  bathroom: { widthFt: 10, heightFt: 6 },
  kitchen:  { widthFt: 20, heightFt: 20 },
  dining:   { widthFt: 12, heightFt: 10 },
  office:   { widthFt: 10, heightFt: 10 },
  garage:   { widthFt: 20, heightFt: 20 },
  hallway:  { widthFt: 12, heightFt: 4 },
  grass:    { widthFt: 20, heightFt: 20 },
  driveway: { widthFt: 20, heightFt: 10 },
  patio:    { widthFt: 12, heightFt: 10 },
  pool:     { widthFt: 16, heightFt: 10 },
  lanai:    { widthFt: 12, heightFt: 12 },
  closet:   { widthFt: 6,  heightFt: 4 },
  other:    { widthFt: 10, heightFt: 10 },
}
