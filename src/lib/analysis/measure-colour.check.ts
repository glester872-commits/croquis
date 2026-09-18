/**
 * Colour arithmetic. The pixel path needs a browser; what is checked
 * here is the maths every measurement rests on.
 *
 *   node src/lib/analysis/measure-colour.check.ts
 */
import assert from 'node:assert/strict'

import { contrastRatio, describeColour, relativeLuminance, rgbToHsl } from './measure-colour.ts'

// Luminance against the values WCAG defines, which is the whole point
// of using the real formula rather than a brightness average.
assert.equal(relativeLuminance(0, 0, 0), 0)
assert.equal(relativeLuminance(255, 255, 255), 1)
assert.ok(Math.abs(relativeLuminance(255, 0, 0) - 0.2126) < 1e-9)
assert.ok(Math.abs(relativeLuminance(0, 255, 0) - 0.7152) < 1e-9)

// Black on white is 21:1. If this drifts, every contrast claim drifts.
assert.equal(Math.round(contrastRatio(1, 0) * 100) / 100, 21)
assert.equal(contrastRatio(0.5, 0.5), 1)
// Order must not matter — the caller should not have to sort first.
assert.equal(contrastRatio(0.2, 0.8), contrastRatio(0.8, 0.2))

// HSL, including the wrap at red where an off-by-one is invisible
// until a colour is named "magenta" instead of "rojo".
assert.deepEqual(rgbToHsl(255, 0, 0), [0, 1, 0.5])
assert.deepEqual(rgbToHsl(0, 0, 0), [0, 0, 0])
assert.deepEqual(rgbToHsl(128, 128, 128).slice(0, 2), [0, 0])
const [greenHue] = rgbToHsl(0, 255, 0)
assert.equal(Math.round(greenHue), 120)
const [blueHue] = rgbToHsl(0, 0, 255)
assert.equal(Math.round(blueHue), 240)

// Names are descriptions of where a colour sits, so the textile range
// has to land in the textile words and not in "marrón".
assert.equal(describeColour(0, 0, 0), 'Negro')
assert.equal(describeColour(255, 255, 255), 'Blanco')
assert.equal(describeColour(189, 181, 166), 'Greige') 
assert.equal(describeColour(233, 227, 216), 'Hueso')
assert.equal(describeColour(128, 128, 128), 'Gris medio')
assert.equal(describeColour(255, 0, 0), 'Rojo')
assert.equal(describeColour(90, 55, 25), 'Marrón')
// Every colour gets a name — a swatch with no label is a broken cell.
for (let r = 0; r <= 255; r += 51) {
  for (let g = 0; g <= 255; g += 51) {
    for (let b = 0; b <= 255; b += 51) {
      const name = describeColour(r, g, b)
      assert.ok(name.length > 0, `no name for ${r},${g},${b}`)
    }
  }
}

// Reached only if every assertion above held.
console.log('measure-colour: ok')
