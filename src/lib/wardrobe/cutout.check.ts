/**
 * Where the cut-out gets cropped. The canvas path needs a browser;
 * what is checked here is the geometry the crop rests on — an
 * off-by-one clips a sleeve, and an empty mask must not silently
 * produce a zero-sized canvas.
 *
 *   node src/lib/wardrobe/cutout.check.ts
 */
import assert from 'node:assert/strict'

import { maskBounds, padBounds } from './cutout.ts'

/** A mask with a single rectangle set, for readable fixtures. */
function rect(width: number, height: number, x0: number, y0: number, x1: number, y1: number) {
  const mask = new Uint8Array(width * height)
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) mask[y * width + x] = 1
  }
  return mask
}

// Nothing set is not a box of zero size — it is no box at all, and the
// caller has to fall back to the whole frame rather than crop to a
// point.
assert.equal(maskBounds(new Uint8Array(64), 8, 8), null)

// The box is tight and its far edge is exclusive, so width is x1 - x0.
const single = maskBounds(rect(8, 8, 3, 4, 4, 5), 8, 8)
assert.deepEqual(single, { x0: 3, y0: 4, x1: 4, y1: 5 })
assert.equal(single!.x1 - single!.x0, 1)

assert.deepEqual(maskBounds(rect(8, 8, 2, 1, 6, 5), 8, 8), { x0: 2, y0: 1, x1: 6, y1: 5 })

// A mask touching every edge must return the frame itself, not the
// frame minus one: that is the case where a garment is cropped by the
// photographer and the cut-out has to keep it whole.
const full = new Uint8Array(8 * 8).fill(1)
assert.deepEqual(maskBounds(full, 8, 8), { x0: 0, y0: 0, x1: 8, y1: 8 })

// Two separate blobs — a jacket and its belt — share one box.
const two = rect(10, 10, 1, 1, 3, 3)
two[8 * 10 + 8] = 1
assert.deepEqual(maskBounds(two, 10, 10), { x0: 1, y0: 1, x1: 9, y1: 9 })

// Non-square frames index rows correctly. A width/height swap here
// reads the mask diagonally and the crop lands on nothing.
assert.deepEqual(maskBounds(rect(4, 9, 1, 6, 3, 8), 4, 9), { x0: 1, y0: 6, x1: 3, y1: 8 })

/* ── padding ─────────────────────────────────────────────────────── */

assert.deepEqual(padBounds({ x0: 4, y0: 4, x1: 6, y1: 6 }, 20, 20, 2), {
  x0: 2,
  y0: 2,
  x1: 8,
  y1: 8,
})

// Padding never leaves the frame, in either direction. Unclamped, the
// crop rectangle goes negative and drawImage samples transparency into
// the edge of the garment.
assert.deepEqual(padBounds({ x0: 0, y0: 0, x1: 8, y1: 8 }, 8, 8, 3), {
  x0: 0,
  y0: 0,
  x1: 8,
  y1: 8,
})

// A fractional pad still yields whole pixels, and outwards on both
// sides: floor the near edge, ceil the far one.
assert.deepEqual(padBounds({ x0: 5, y0: 5, x1: 6, y1: 6 }, 20, 20, 0.5), {
  x0: 4,
  y0: 4,
  x1: 7,
  y1: 7,
})

// Padding a real box keeps it non-empty, which is what stops the
// output canvas being sized zero.
const padded = padBounds({ x0: 3, y0: 3, x1: 4, y1: 4 }, 10, 10, 0)
assert.ok(padded.x1 > padded.x0 && padded.y1 > padded.y0)

// Reached only if every assertion above held.
console.log('cutout: ok')
