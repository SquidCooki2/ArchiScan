/** Choices for a floor picker. Numbers alone once full names wouldn't fit. */
export const floorOptions = (floors, { all = false } = {}) => [
  ...(all ? [{ id: 'all', label: 'All' }] : []),
  ...Array.from({ length: floors }, (_, floor) => ({ id: floor, label: floors > 3 ? `${floor + 1}` : `Floor ${floor + 1}` })),
]
