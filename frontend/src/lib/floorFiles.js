import { MAX_FLOORS } from './geometry.js'

/** Floors are read in file-name order, ground floor first, however the browser listed them. */
export function orderFloorFiles(files) {
  const ordered = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
  if (ordered.length > MAX_FLOORS) throw new Error(`Choose up to ${MAX_FLOORS} images, one for each floor.`)
  return ordered
}

export function modelNameFor(files) {
  return files.length === 1 ? files[0].name : `${files[0].name} and ${files.length - 1} more`
}
