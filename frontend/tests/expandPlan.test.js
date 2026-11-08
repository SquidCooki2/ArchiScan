import assert from 'node:assert/strict'
import { test } from 'node:test'
import { containRect, expandedRects, flipRadius, flipTransform } from '../src/lib/expandPlan.js'

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} is not ${expected}`)

test('a shape fits inside a box without stretching, centered', () => {
  const wide = containRect({ width: 200, height: 100 }, { left: 10, top: 20, width: 100, height: 100 })
  assert.deepEqual(wide, { left: 10, top: 45, width: 100, height: 50 })
  const tall = containRect({ width: 100, height: 200 }, { left: 0, top: 0, width: 100, height: 100 })
  assert.deepEqual(tall, { left: 25, top: 0, width: 50, height: 100 })
})

test('small images grow to use the window', () => {
  const { image } = expandedRects({ width: 100, height: 100 }, { width: 1440, height: 900 })
  assert.ok(image.height > 700)
})

test('the expanded card stays on screen, below the bar, at any image shape and window size', () => {
  for (const natural of [{ width: 3000, height: 200 }, { width: 200, height: 3000 }, { width: 1600, height: 1200 }]) {
    for (const viewport of [{ width: 1920, height: 1080 }, { width: 1024, height: 600 }, { width: 360, height: 740 }]) {
      const { card, image } = expandedRects(natural, viewport)
      assert.ok(card.left >= 0 && card.left + card.width <= viewport.width, 'fits across')
      assert.ok(card.top >= 64 && card.top + card.height <= viewport.height, 'fits down, below the bar')
      near(image.width / image.height, natural.width / natural.height)
      near(card.left + card.width / 2, image.left + image.width / 2)
      near(card.top + card.height / 2, image.top + image.height / 2)
    }
  }
})

test('a window too small for any image still gives a real size, rather than a broken one', () => {
  const { image } = expandedRects({ width: 100, height: 100 }, { width: 10, height: 10 })
  assert.ok(image.width > 0 && image.height > 0)
})

test('the transform lands a rectangle exactly over the thumbnail', () => {
  const rest = { left: 300, top: 100, width: 800, height: 600 }, over = { left: 20, top: 700, width: 160, height: 112 }
  const transform = flipTransform(over, rest)
  assert.equal(transform, `translate(-280px, 600px) scale(0.2, ${112 / 600})`)
  const [, x, y, sx, sy] = transform.match(/translate\((.+)px, (.+)px\) scale\((.+), (.+)\)/).map(Number)
  near(rest.left + x, over.left)
  near(rest.top + y, over.top)
  near(rest.width * sx, over.width)
  near(rest.height * sy, over.height)
})

test('the corners still look round when the card is squeezed unevenly', () => {
  const rest = { width: 800, height: 400 }, over = { width: 160, height: 160 }
  assert.equal(flipRadius(8, over, rest), '40px / 20px')
})
