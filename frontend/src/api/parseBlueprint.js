import sampleWalls from '../samples/sampleWalls.json'

const API_URL = import.meta.env.VITE_API_URL
const TIMEOUT_MS = 150_000
const MOCK_DELAY_MS = 1500

/** Mock mode: `?mock=1` in the URL, or no backend URL configured. */
export function isMockMode() {
  const params = new URLSearchParams(window.location.search)
  return params.get('mock') === '1' || !API_URL
}

/** Reads a File into raw base64 (no `data:` prefix). */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      const comma = result.indexOf(',')
      resolve({ base64: result.slice(comma + 1), mediaType: file.type })
    }
    reader.onerror = () => reject(new Error('Could not read the image file. Try exporting it again.'))
    reader.readAsDataURL(file)
  })
}

export function getSampleWalls() {
  return sampleWalls.map((w) => ({ ...w }))
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(id)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

function isWall(w) {
  return (
    w &&
    typeof w === 'object' &&
    ['x', 'z', 'width', 'depth', 'rotation'].every((k) => Number.isFinite(w[k])) &&
    w.width > 0 &&
    w.depth > 0
  )
}

/**
 * Sends the floorplan to the backend and returns walls[].
 * Pass `signal` to let the user cancel; a cancelled call rejects with an AbortError.
 */
export async function parseBlueprint(file, { signal } = {}) {
  if (isMockMode()) {
    await wait(MOCK_DELAY_MS, signal)
    return getSampleWalls()
  }

  const { base64, mediaType } = await fileToBase64(file)

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

  let res
  try {
    res = await fetch(`${API_URL}/api/parse-blueprint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64, mediaType }),
      signal: controller.signal,
    })
  } catch (err) {
    if (timedOut) {
      throw new Error('The scan took longer than 150 seconds. Try a smaller or cleaner floorplan image.')
    }
    if (err.name === 'AbortError') throw err
    throw new Error(`Cannot reach the server at ${API_URL}. Check that the backend is running.`)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }

  let body = null
  try {
    body = await res.json()
  } catch {
    // Non-JSON body; handled below.
  }

  if (!res.ok) {
    throw new Error(body?.error?.message ?? `Request failed (${res.status}).`)
  }

  const walls = Array.isArray(body) ? body.filter(isWall) : []
  if (!walls.length) {
    throw new Error('No walls were found in this image. Try a clearer floorplan with visible wall lines.')
  }
  return walls
}
