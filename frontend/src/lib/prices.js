/*
 * Rough US retail prices in dollars, for materials only: no labor, tax, or delivery. Change them here.
 * Priced per meter, square meter, cubic meter, or piece, except for items sold by the sheet or liter.
 * Concrete, sheathing, drywall, and shingles were compared with published 2026 figures in November 2026.
 * The rest are general estimates. Local prices vary, so these are for a first budget, not a quote.
 */
export const CURRENCY = 'USD'
export const PRICE_BASIS = 'Rough US retail prices for the listed items, not a quote. No labor, tax, delivery, roof framing, wiring or HVAC.'

export const PRICES = {
  'Ground floor slab': 220,
  'Wall studs': 5,
  'Wall plates': 2,
  'Opening headers': 10,
  'Upper floor deck': 35,
  'Stair flights': 400,
  Treads: 35,
  Handrail: 25,
  'Stairwell guard': 80,
  'Exterior sheathing': 17,
  'Wall insulation': 8,
  'Weather barrier': 2,
  'Exterior siding': 22,
  'Roof shingles': 13,
  'Roof membrane': 20,
  'Roof underlayment': 3,
  'Ridge cap': 6,
  Gutters: 8,
  'Roof edge trim': 6,
  'Rake trim': 6,
  Soffit: 18,
  'Ceiling insulation': 12,
  'Wall board': 15,
  'Ceiling board': 18,
  'Wall paint': 10,
  'Ceiling paint': 8,
  'Floor finish': 32,
  Baseboard: 4,
  Refrigerator: 1000,
  Sofa: 900,
  Chair: 120,
  Table: 400,
  Bed: 800,
  Cabinet: 300,
  Wardrobe: 450,
  Toilet: 250,
  Bathtub: 500,
  'Kitchen sink': 300,
  'Bathroom basin': 180,
}

const LITERS_PER_GALLON = 3.785
const WINDOW_PER_SQUARE_METER = 300
const SMALLEST_WINDOW = 150

export const paintGallon = perLiter => perLiter * LITERS_PER_GALLON
export const doorPrice = exterior => exterior ? 700 : 180
/** Windows price by their glass, to the nearest $10. */
export const windowPrice = glass => Math.max(SMALLEST_WINDOW, Math.round(glass * WINDOW_PER_SQUARE_METER / 10) * 10)

/** Dollars with cents only where a small unit price needs them. */
export function money(value) {
  if (value >= 100 || Number.isInteger(value)) return `$${Math.round(value).toLocaleString('en-US')}`
  return `$${value.toFixed(2)}`
}

/** A total to the nearest $100, since the prices behind it can't support anything finer. */
export const roughMoney = value => money(Math.round(value / 100) * 100)
