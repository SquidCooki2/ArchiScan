import sampleWalls from '../samples/sampleWalls.json'
import { validateWalls } from '../lib/geometry'

export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const isMockMode = () => new URLSearchParams(window.location.search).get('mock') === '1' || !import.meta.env.VITE_API_URL?.trim()

export function validateFile(file) {
  if (!file || !ACCEPTED_TYPES.includes(file.type)) throw new Error('Choose a PNG, JPEG, WebP, or GIF image.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('This image is too large. Please choose a file of 5 MB or less.')
  if (!file.size) throw new Error('This image is empty. Please choose another file.')
}

export function fileToBase64(file, signal) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    const cleanup = () => signal?.removeEventListener('abort', abort)
    const abort = () => { reader.abort(); cleanup(); reject(new DOMException('Cancelled', 'AbortError')) }
    reader.onload = () => { cleanup(); resolve({ base64: String(reader.result).split(',')[1], mediaType: file.type }) }
    reader.onerror = () => { cleanup(); reject(new Error('Could not read this image. Please try another file.')) }
    if (signal?.aborted) return abort()
    signal?.addEventListener('abort', abort, { once: true })
    reader.readAsDataURL(file)
  })
}

export function loadSample(signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(sampleWalls.map(w => ({ ...w }))) }, 1500)
    if (signal?.aborted) return abort()
    signal?.addEventListener('abort', abort, { once: true })
  })
}

export async function parseBlueprint(file, { signal } = {}) {
  validateFile(file)
  if (isMockMode()) return loadSample(signal)
  const controller = new AbortController()
  let timedOut = false
  const abort = () => controller.abort()
  if (signal?.aborted) abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(() => { timedOut = true; controller.abort() }, 150_000)
  try {
    const { base64, mediaType } = await fileToBase64(file, controller.signal)
    let response
    try {
      response = await fetch(`${import.meta.env.VITE_API_URL.trim().replace(/\/+$/, '')}/api/parse-blueprint`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType }), signal: controller.signal,
      })
    } catch (error) {
      if (controller.signal.aborted) throw error
      throw new Error('Cannot reach the server. Check your connection and try again.')
    }
    let body
    try { body = await response.json() } catch {
      if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError')
      throw new Error(response.ok ? 'The server returned an unreadable response.' : `Request failed (${response.status}). Please try again.`)
    }
    if (!response.ok) throw new Error(body?.error?.message ?? 'Request failed. Please try again.')
    return validateWalls(body)
  } catch (error) {
    if (timedOut) throw new Error('Parsing took too long. Please try again with a smaller, clearer floorplan.')
    if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError')
    throw error
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}
