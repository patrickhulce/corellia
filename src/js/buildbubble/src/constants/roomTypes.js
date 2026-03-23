export const ROOM_TYPE_OPTIONS = [
  { value: 'living',   label: 'Living Room' },
  { value: 'bedroom',  label: 'Bedroom' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'kitchen',  label: 'Kitchen' },
  { value: 'dining',   label: 'Dining Room' },
  { value: 'office',   label: 'Office' },
  { value: 'garage',   label: 'Garage' },
  { value: 'grass',    label: 'Grass' },
  { value: 'driveway', label: 'Driveway' },
  { value: 'patio',    label: 'Patio' },
  { value: 'other',    label: 'Other' },
]

export const TYPE_COLORS = {
  living:   { fill: '#dbeafe', stroke: '#3b82f6' }, // blue
  bedroom:  { fill: '#dcfce7', stroke: '#22c55e' }, // green
  bathroom: { fill: '#e0f2fe', stroke: '#0ea5e9' }, // sky
  kitchen:  { fill: '#fef9c3', stroke: '#eab308' }, // yellow
  dining:   { fill: '#fce7f3', stroke: '#ec4899' }, // pink
  office:   { fill: '#ede9fe', stroke: '#8b5cf6' }, // violet
  garage:   { fill: '#f3f4f6', stroke: '#6b7280' }, // gray
  grass:    { fill: '#ecfccb', stroke: '#65a30d' }, // lime
  driveway: { fill: '#e2e8f0', stroke: '#475569' }, // slate
  patio:    { fill: '#fed7aa', stroke: '#c2410c' }, // warm orange
  other:    { fill: '#ffedd5', stroke: '#f97316' }, // orange
}

export const DEFAULT_DIMENSIONS = {
  living:   { widthFt: 15, heightFt: 12 },
  bedroom:  { widthFt: 12, heightFt: 11 },
  bathroom: { widthFt: 8,  heightFt: 5 },
  kitchen:  { widthFt: 12, heightFt: 10 },
  dining:   { widthFt: 12, heightFt: 10 },
  office:   { widthFt: 10, heightFt: 10 },
  garage:   { widthFt: 20, heightFt: 20 },
  grass:    { widthFt: 20, heightFt: 20 },
  driveway: { widthFt: 20, heightFt: 10 },
  patio:    { widthFt: 12, heightFt: 10 },
  other:    { widthFt: 10, heightFt: 10 },
}
