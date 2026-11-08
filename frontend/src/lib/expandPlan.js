/*
 * The geometry behind the expanding plan. The thumbnail and the large view are measured, and the large
 * view starts out transformed to sit exactly over the thumbnail, so one seems to grow out of the other.
 */

const BAR = 64
const MARGIN = 24
const CARD_PADDING = 12

/** The largest rectangle of this shape that fits in the box, centered. */
export function containRect({ width, height }, box) {
  const scale = Math.min(box.width / width, box.height / height)
  const fitWidth = width * scale, fitHeight = height * scale
  return { left: box.left + (box.width - fitWidth) / 2, top: box.top + (box.height - fitHeight) / 2, width: fitWidth, height: fitHeight }
}

/** Where the card and the image rest when expanded: as large as the window allows, below the bar. */
export function expandedRects(natural, viewport) {
  const area = {
    left: MARGIN + CARD_PADDING,
    top: BAR + CARD_PADDING,
    width: Math.max(1, viewport.width - 2 * (MARGIN + CARD_PADDING)),
    height: Math.max(1, viewport.height - BAR - MARGIN - 2 * CARD_PADDING),
  }
  const image = containRect(natural, area)
  const card = { left: image.left - CARD_PADDING, top: image.top - CARD_PADDING, width: image.width + 2 * CARD_PADDING, height: image.height + 2 * CARD_PADDING }
  return { card, image }
}

/** The transform that puts a rectangle resting at `rest` over `over`, with its origin at the top left. */
export function flipTransform(over, rest) {
  return `translate(${over.left - rest.left}px, ${over.top - rest.top}px) scale(${over.width / rest.width}, ${over.height / rest.height})`
}

/** A radius that still looks like `radius` once the element is scaled to sit over `over`. */
export function flipRadius(radius, over, rest) {
  return `${radius * rest.width / over.width}px / ${radius * rest.height / over.height}px`
}
