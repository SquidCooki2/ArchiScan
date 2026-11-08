import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { containRect, expandedRects, flipRadius, flipTransform } from '../lib/expandPlan'
import Icon from './Icon'
import { Button, focusRing } from './ui'

const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'
const GROW = { duration: 320, easing: EASING, fill: 'both' }
const SHRINK = { duration: 220, easing: EASING, fill: 'both' }
const FADE_IN = { duration: 200, easing: 'ease-out', fill: 'both' }
const FADE_OUT = { duration: 140, easing: 'ease-out', fill: 'both' }
// The caption and Close wait for the scrim, so they never sit on top of the header behind it.
const BAR_IN = { duration: 160, delay: 140, easing: 'ease-out', fill: 'both' }
const BAR_OUT = { duration: 80, easing: 'ease-out', fill: 'both' }
const THUMB_RADIUS = 8, CARD_RADIUS = 12
// A large upload can take a moment to decode. Don't let that hold up the response to the click.
const DECODE_WAIT = 120
const THUMB_SHAPE = { width: 160, height: 112 }

const reducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
const viewportSize = () => ({ width: window.innerWidth, height: window.innerHeight })
const naturalSize = img => img.naturalWidth && img.naturalHeight ? { width: img.naturalWidth, height: img.naturalHeight } : THUMB_SHAPE

/** The thumbnail's white box and the drawing inside it. Null when it's hidden, as on narrow screens. */
function measureThumb(img) {
  const box = img?.getBoundingClientRect()
  if (!box?.width) return null
  const pad = parseFloat(getComputedStyle(img).paddingLeft) || 0
  return { box, image: containRect(naturalSize(img), { left: box.left + pad, top: box.top + pad, width: box.width - 2 * pad, height: box.height - 2 * pad }) }
}

/** How the card and image look when sitting exactly over the thumbnail. */
const overThumb = (thumb, rects) => ({
  card: { transform: flipTransform(thumb.box, rects.card), borderRadius: flipRadius(THUMB_RADIUS, thumb.box, rects.card) },
  image: { transform: flipTransform(thumb.image, rects.image) },
})

/** Heads for a new look from wherever the element is now, so it can change direction mid-flight. */
function retarget(element, to, timing) {
  const style = getComputedStyle(element)
  const from = Object.fromEntries(Object.keys(to).map(key => [key, style[key]]))
  element.getAnimations().forEach(animation => animation.cancel())
  return element.animate([from, to], timing)
}

/** The original drawing as a thumbnail, which grows into a large view and shrinks back to the same spot. */
export default function PlanCard({ previewUrl, caption, hint, dismiss }) {
  const [open, setOpen] = useState(false)
  const [rects, setRects] = useState(null)
  // closed, opening, open, or closing. A ref, because the handlers run between renders.
  const phase = useRef('closed')
  const timer = useRef()
  const thumb = useRef()
  const dialog = useRef()
  const scrim = useRef()
  const bar = useRef()
  const card = useRef()
  const image = useRef()

  const finish = useCallback(() => {
    clearTimeout(timer.current)
    if (phase.current === 'closed') return
    phase.current = 'closed'
    // The thumbnail has to be back before the large view goes, or it flickers.
    flushSync(() => setOpen(false))
    if (dialog.current?.open) dialog.current.close()
    for (const ref of [scrim, bar, card, image]) ref.current?.getAnimations().forEach(animation => animation.cancel())
    thumb.current?.closest('button')?.focus({ preventScroll: true })
  }, [])

  const collapse = useCallback((instant = false) => {
    if (phase.current === 'opening') { phase.current = 'closed'; return }
    if (phase.current !== 'open') return
    phase.current = 'closing'
    const from = instant || reducedMotion() ? null : measureThumb(thumb.current)
    if (!from) { finish(); return }
    const target = overThumb(from, expandedRects(naturalSize(thumb.current), viewportSize()))
    const shrink = retarget(card.current, target.card, SHRINK)
    retarget(image.current, target.image, SHRINK)
    retarget(scrim.current, { opacity: 0 }, FADE_OUT)
    retarget(bar.current, { opacity: 0 }, BAR_OUT)
    shrink.onfinish = finish
    // Closing must not depend on the animation ending, as it may not in a background tab.
    timer.current = setTimeout(finish, SHRINK.duration + 120)
  }, [finish])

  async function expand() {
    if (phase.current !== 'closed') return
    const from = measureThumb(thumb.current)
    if (!from) return
    phase.current = 'opening'
    await Promise.race([image.current.decode().catch(() => {}), new Promise(resolve => { setTimeout(resolve, DECODE_WAIT) })])
    if (phase.current !== 'opening') return
    const next = expandedRects(naturalSize(thumb.current), viewportSize())
    flushSync(() => { setRects(next); setOpen(true) })
    dialog.current.showModal()
    phase.current = 'open'
    if (reducedMotion()) return
    const start = overThumb(from, next)
    const settle = animation => { animation.onfinish = () => animation.cancel() }
    settle(card.current.animate([start.card, { transform: 'none', borderRadius: `${CARD_RADIUS}px` }], GROW))
    settle(image.current.animate([start.image, { transform: 'none' }], GROW))
    settle(scrim.current.animate([{ opacity: 0 }, { opacity: 1 }], FADE_IN))
    settle(bar.current.animate([{ opacity: 0 }, { opacity: 1 }], BAR_IN))
  }

  useEffect(() => {
    if (!open) return undefined
    const onResize = () => setRects(expandedRects(naturalSize(thumb.current), viewportSize()))
    // Esc means close this, not also cancel whatever is behind it, wherever focus happens to be.
    const onKey = event => { if (event.key === 'Escape') event.stopPropagation() }
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  // Something needs the screen, like a file being dropped. It would otherwise happen behind the large view.
  useEffect(() => {
    if (dismiss) queueMicrotask(() => collapse(true))
  }, [dismiss, collapse])

  useEffect(() => () => clearTimeout(timer.current), [])

  const place = rect => rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : undefined

  return <>
    <div className="pointer-events-none fixed bottom-5 left-5 z-10 hidden items-end gap-4 lg:flex">
      {previewUrl && <figure>
        <button type="button" onClick={expand} aria-label={`Expand ${caption}`} aria-haspopup="dialog" className={`pointer-events-auto block cursor-zoom-in rounded-lg transition-[filter] duration-150 hover:brightness-95 active:brightness-90 motion-reduce:transition-none ${focusRing}`}>
          <img ref={thumb} src={previewUrl} alt="" className={`h-28 w-40 rounded-lg bg-white object-contain p-1.5 shadow-[0_8px_24px_rgb(0_0_0/0.3)] ${open ? 'opacity-0' : ''}`} />
        </button>
        <figcaption className="mt-1.5 text-[13px] text-slate-300">{caption}</figcaption>
      </figure>}
      <p className="pb-0.5 text-[13px] leading-5 text-slate-400">{hint}</p>
    </div>
    {/* Outside the wrapper above, which is hidden on narrow screens and ignores the pointer. */}
    {previewUrl && <dialog ref={dialog} aria-label={caption} onClick={() => collapse()} onCancel={event => { event.preventDefault(); collapse() }} onClose={() => { if (!dialog.current?.open) finish() }}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none cursor-zoom-out overflow-hidden bg-transparent p-0 text-slate-100 backdrop:bg-transparent">
      <div ref={scrim} className="absolute inset-0 bg-[#171c22]/97" />
      <div ref={card} className="absolute origin-top-left rounded-xl bg-white shadow-[0_24px_64px_rgb(0_0_0/0.5)] will-change-transform" style={place(rects?.card)} />
      <img ref={image} src={previewUrl} alt={caption} className="absolute max-w-none origin-top-left will-change-transform" style={place(rects?.image)} />
      <div ref={bar} className="absolute inset-x-0 top-0 flex h-16 items-center justify-between gap-4 px-6">
        <p className="truncate text-sm font-medium">{caption}</p>
        <Button className="shrink-0"><Icon name="close" className="size-4" />Close</Button>
      </div>
    </dialog>}
  </>
}
