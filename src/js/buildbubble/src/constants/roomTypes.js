export const ROOM_TYPE_OPTIONS = [
  { value: 'living',   label: 'Living Room' },
  { value: 'bedroom',  label: 'Bedroom' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'kitchen',  label: 'Kitchen' },
  { value: 'dining',   label: 'Dining Room' },
  { value: 'office',   label: 'Office' },
  { value: 'garage',   label: 'Garage' },
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
  other:    { fill: '#ffedd5', stroke: '#f97316' }, // orange
}
