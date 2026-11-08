import { computeBounds, elementFloor, isEnclosure, MAX_FLOORS, validElement } from './geometry.js'
import { ROOF_TYPES } from './roof.js'

/*
 * A plan that's already been read, opened from a JSON file. It never goes near the server: it's checked
 * here and goes straight to the viewer. The file can come from anywhere, so nothing in it is trusted.
 */

export const PLAN_FILE_TYPES = ['application/json', '.json']
const MAX_BYTES = 5 * 1024 * 1024
// As many as the server allows for a building: 500 elements on each floor.
const MAX_ELEMENTS = 500 * MAX_FLOORS
// Meters. Far past any real building, and keeps a stray value from stalling the route and walk grids.
const MAX_SIZE = 500

export const isPlanFile = file => file.type === 'application/json' || /\.json$/i.test(file.name)

/** Size and count checks that don't need the file's contents. */
export function validatePlanFiles(files) {
  if (files.length > 1) throw new Error('Choose one JSON file by itself. It already holds every floor.')
  const [file] = files
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is over 5 MB. Choose a smaller file.`)
  if (!file.size) throw new Error(`${file.name} is empty. Choose another file.`)
}

/** The backend's list of elements, a `{ walls }` wrapper, or a file from the Export menu. */
const elementsIn = data => {
  if (Array.isArray(data)) return data
  return [data?.elements, data?.walls].find(Array.isArray)
}

// A file can carry the furniture sizes an export saved, which the viewer uses as they are.
const validFit = fit => fit === undefined || (Number.isFinite(fit) && fit > 0)
const usable = element => validElement(element) && validFit(element.fitWidth) && validFit(element.fitDepth)

/** Turns the file's text into a plan, or throws a message that says what to fix. */
export function parsePlanFile(text, fileName) {
  let data
  try { data = JSON.parse(text) } catch { throw new Error(`${fileName} isn’t valid JSON. Check the file and try again.`) }
  const elements = elementsIn(data)
  if (!elements) throw new Error(`${fileName} doesn’t hold a floor plan. Use a list of elements, or a JSON file exported from ArchiTech.`)
  if (elements.length > MAX_ELEMENTS) throw new Error(`${fileName} has over ${MAX_ELEMENTS} elements. Choose a smaller plan.`)
  const invalid = elements.findIndex(element => !usable(element))
  if (invalid >= 0) throw new Error(`Element ${invalid + 1} in ${fileName} can’t be used. Check its type, position, size, and rotation.`)
  if (!elements.some(isEnclosure)) throw new Error(`${fileName} has no walls, doors, or windows, so there’s nothing to build.`)
  if (elements.some(element => elementFloor(element) >= MAX_FLOORS)) throw new Error(`${fileName} has more than ${MAX_FLOORS} floors. Choose a plan with ${MAX_FLOORS} or fewer.`)
  if (computeBounds(elements).size > MAX_SIZE) throw new Error(`${fileName} is over ${MAX_SIZE} meters across. Plan lengths need to be in meters.`)
  const name = typeof data.model === 'string' && data.model.trim() ? data.model.trim() : fileName
  // An export's furniture is already placed, and settling it again would nudge it away from what was saved.
  return { walls: elements, name, roofType: ROOF_TYPES.some(({ id }) => id === data.roof) ? data.roof : null, settled: data.project === 'ArchiTech' }
}

export async function readPlanFile(file) {
  return parsePlanFile(await file.text(), file.name)
}
