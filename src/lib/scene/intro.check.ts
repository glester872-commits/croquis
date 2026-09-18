/**
 * The entrance schedule, checked against the table it is specified as.
 *
 *   node src/lib/scene/intro.check.ts
 */
import assert from 'node:assert/strict'

import { introFor } from './intro.ts'

// 0 %: photograph completely invisible, cloth practically closed.
const start = introFor(0)
assert.equal(start.veilOpacity, 0, 'la fotografía es visible al inicio')
assert.ok(start.open <= 0.005, 'el tejido no empieza cerrado')
assert.equal(start.cloth, 1)
assert.equal(start.settle, 0, 'la fotografía no empieza fuera de reposo')

// 0-15 %: immediate visual response. No dead screen of scrolling.
assert.ok(introFor(0.02).open > 0, 'no hay respuesta al primer scroll')
assert.ok(introFor(0.05).open >= 0.02, 'la apertura no arranca lo bastante pronto')

// 15-30 %: unrecognisable presence behind. Blur at least 24 px and
// opacity at most 0.15 across the whole band, not just at its edges.
for (let p = 0.15; p <= 0.3001; p += 0.005) {
  const state = introFor(p)
  assert.ok(state.veilBlur >= 24 - 1e-9, `blur ${state.veilBlur.toFixed(1)} < 24 en p=${p.toFixed(3)}`)
  assert.ok(
    state.veilOpacity <= 0.15 + 1e-9,
    `opacidad ${state.veilOpacity.toFixed(3)} > 0,15 en p=${p.toFixed(3)}`,
  )
}

// 30-50 %: blur 24 → 14, opacity 0.15 → 0.4.
assert.ok(Math.abs(introFor(0.3).veilBlur - 24) < 0.01)
assert.ok(Math.abs(introFor(0.5).veilBlur - 14) < 0.01)
assert.ok(Math.abs(introFor(0.3).veilOpacity - 0.15) < 0.001)
assert.ok(Math.abs(introFor(0.5).veilOpacity - 0.4) < 0.001)

// 50-70 %: blur 14 → 5, opacity 0.4 → 0.8.
assert.ok(Math.abs(introFor(0.7).veilBlur - 5) < 0.01)
assert.ok(Math.abs(introFor(0.7).veilOpacity - 0.8) < 0.001)

// 70-100 %: cloth to the sides, photograph completely sharp at the end.
assert.equal(introFor(1).veilBlur, 0, 'la fotografía no termina nítida')
assert.equal(introFor(1).veilOpacity, 1, 'la fotografía no termina opaca')
assert.equal(introFor(1).open, 1, 'el tejido no termina de abrirse')
assert.equal(introFor(1).cloth, 0, 'el tejido sigue en pantalla al final')
assert.equal(introFor(1).settle, 1, 'la fotografía no llega a reposo')
// Most of the settling happens where the gap is wide enough to read it.
assert.ok(introFor(0.5).settle < 0.5, 'la fotografía se asienta antes de poder verse')
assert.ok(introFor(0.85).open > introFor(0.7).open, 'el tejido no se retira en el último tramo')

// Monotonic throughout: cloth that stutters is cloth that snags, and a
// photograph that dims back down mid-reveal reads as a bug.
let lastOpen = -1
let lastOpacity = -1
let lastSettle = -1
let lastBlur = Number.POSITIVE_INFINITY
for (let p = 0; p <= 1.0001; p += 0.002) {
  const state = introFor(p)
  assert.ok(state.open >= lastOpen - 1e-9, `la apertura retrocede en p=${p.toFixed(3)}`)
  assert.ok(state.veilOpacity >= lastOpacity - 1e-9, `la foto se atenúa en p=${p.toFixed(3)}`)
  assert.ok(state.veilBlur <= lastBlur + 1e-9, `el desenfoque aumenta en p=${p.toFixed(3)}`)
  assert.ok(state.settle >= lastSettle - 1e-9, `la fotografía retrocede en p=${p.toFixed(3)}`)
  lastSettle = state.settle
  lastOpen = state.open
  lastOpacity = state.veilOpacity
  lastBlur = state.veilBlur
}

// The lockup leaves before the photograph is legible, so the two never
// compete for the same frame.
assert.equal(introFor(0).lockup, 1)
assert.ok(introFor(0.45).lockup < 0.05, 'el lockup sigue presente cuando la foto ya se lee')

console.log('intro: ok')
