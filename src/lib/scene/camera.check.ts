/**
 * Camera and act timeline.
 *
 *   node src/lib/scene/camera.check.ts
 *
 * Written against properties the sequence must hold rather than the
 * arithmetic producing them, so easing changes do not break the checks
 * while genuine drift still does.
 */
import assert from 'node:assert/strict'

import type { Region } from '../../types/index.ts'
import {
  type Act,
  actAt,
  actIndexAt,
  buildScene,
  cameraFor,
  materialAt,
  progressForAct,
  progressForStep,
  stepAt,
  zoomTo,
} from './camera.ts'

const FULL = buildScene({ palette: true, silhouette: true, garments: 6, materials: 2, styleDna: 4, trends: 1 })
const BARE = buildScene({ palette: true, silhouette: false, garments: 0, materials: 0, styleDna: 0, trends: 0 })

const region = (x: number, y: number, width: number, height: number): Region => ({
  x,
  y,
  width,
  height,
})
const centreOf = (r: Region) => [r.x + r.width / 2, r.y + r.height / 2] as const
const gap = (a: Region, b: Region) => {
  const [ax, ay] = centreOf(a)
  const [bx, by] = centreOf(b)
  return Math.hypot(ax - bx, ay - by)
}

/* ── the timeline ────────────────────────────────────────────────── */

for (const scene of [FULL, BARE]) {
  const { acts } = scene
  assert.equal(acts[0]?.start, 0)
  assert.equal(acts[acts.length - 1]?.end, 1)
  for (let i = 1; i < acts.length; i += 1) {
    assert.equal(acts[i]?.start, acts[i - 1]?.end, `gap before act ${i}`)
    assert.ok((acts[i] as Act).end > (acts[i] as Act).start, `act ${i} has no length`)
  }
  acts.forEach((act, i) => {
    assert.equal(actIndexAt(acts, act.start), i, `act ${act.id} unreachable at its start`)
    assert.equal(actIndexAt(acts, progressForAct(acts, i)), i, `rail click misses act ${act.id}`)
  })
  assert.equal(actIndexAt(acts, -1), 0)
  assert.equal(actIndexAt(acts, 2), acts.length - 1)
}

// A full reading has all seven acts.
assert.deepEqual(
  FULL.acts.map((act) => act.id),
  ['enter', 'silhouette', 'proportions', 'garments', 'material', 'style-dna', 'trend'],
)

// An analysis where only colour could be measured is not made to walk
// past six acts to be told six readings are missing. It gets the way
// in and the one reading it actually has.
assert.deepEqual(
  BARE.acts.map((act) => act.id),
  ['enter', 'material'],
)
// And that act does not call itself Materiales when no material was read.
assert.equal(actAt(BARE.acts, 'material')?.label, 'Paleta del outfit')
assert.equal(actAt(FULL.acts, 'material')?.label, 'Materiales')
assert.equal(actAt(BARE.acts, 'garments'), null, 'an act with nothing to show still exists')

// When the outfit could not be isolated there is no palette, and with
// no palette the colour act has nothing in it — so it does not happen.
const UNREAD = buildScene({
  palette: false,
  silhouette: false,
  garments: 0,
  materials: 0,
  styleDna: 0,
  trends: 0,
})
assert.deepEqual(
  UNREAD.acts.map((act) => act.id),
  ['enter'],
)
assert.equal(UNREAD.acts[0]?.end, 1, 'the only act has to cover the whole timeline')
assert.equal(actIndexAt(UNREAD.acts, 0.5), 0)
assert.ok(cameraFor(UNREAD.acts, 0.5, null).scale > 0, 'a one-act scene still has a camera')

// Nor is it padded out to the length of a full one.
assert.ok(BARE.screens < FULL.screens * 0.3, `bare scene is ${BARE.screens} of ${FULL.screens}`)
assert.ok(BARE.screens > 1.5, 'even a bare analysis needs somewhere to say so')

// Acts that walk a list grow with the list.
const longer = buildScene({ palette: true, silhouette: true, garments: 6, materials: 5, styleDna: 4, trends: 1 })
const spanOf = (acts: readonly Act[], id: 'material') => {
  const act = actAt(acts, id)
  return act ? act.end - act.start : 0
}
assert.ok(
  spanOf(longer.acts, 'material') > spanOf(FULL.acts, 'material'),
  'five materials get no more room than two',
)

/* ── framing ─────────────────────────────────────────────────────── */

const shot = zoomTo(region(0.3, 0.1, 0.25, 0.2))
assert.equal(shot.scale, 4)
assert.equal(shot.x, (0.5 - 0.425) * 100)
assert.equal(shot.y, (0.5 - 0.2) * 100)

// A sliver of a region must not magnify the photograph into pulp.
assert.ok(zoomTo(region(0, 0, 0.02, 0.02)).scale <= 4.2)

// Whatever the region, the framing fits the room it was given: this is
// what stops the photograph growing out over the rail and the reading.
const stage = { fitX: 2.4, fitY: 1.12, limit: 3.1 }
for (const r of [
  region(0.32, 0.33, 0.38, 0.24),
  region(0.34, 0.55, 0.33, 0.29),
  region(0.04, 0.33, 0.74, 0.15),
  region(0.4, 0.1, 0.05, 0.6),
]) {
  const s = zoomTo(r, stage).scale
  assert.ok(r.width * s <= stage.fitX + 1e-9, `framing overflows the stage sideways: ${r.width * s}`)
  assert.ok(r.height * s <= stage.fitY + 1e-9, `framing overflows the stage vertically`)
  assert.ok(s <= stage.limit + 1e-9, 'framing exceeds what the file has pixels for')
}

/* ── walking a list ──────────────────────────────────────────────── */

assert.equal(stepAt(0, 6), 0)
assert.equal(stepAt(0.5, 6), 3)
assert.equal(stepAt(1, 6), 5)
assert.equal(stepAt(1.5, 6), 5)
assert.equal(stepAt(0.9, 1), 0)

// Clicking a garment lands on that garment, not next to it.
for (let i = 0; i < 6; i += 1) {
  const p = progressForStep(FULL.acts, 'garments', i)
  const act = actAt(FULL.acts, 'garments') as Act
  assert.equal(actIndexAt(FULL.acts, p), FULL.acts.indexOf(act), 'garment jump left the act')
  assert.equal(stepAt((p - act.start) / (act.end - act.start), 6), i, `garment ${i} jump misses`)
}

/* ── progress, act and material agree ────────────────────────────── */

const MATERIALS = [region(0.32, 0.33, 0.38, 0.24), region(0.34, 0.55, 0.33, 0.29)]
const THREE = [...MATERIALS, region(0.41, 0.795, 0.23, 0.075)]

for (const regions of [MATERIALS, THREE, [MATERIALS[0] as Region]]) {
  const scene = buildScene({
    palette: true,
    silhouette: true,
    garments: 6,
    materials: regions.length,
    styleDna: 4,
    trends: 1,
  })
  const act = actAt(scene.acts, 'material') as Act
  const count = regions.length

  for (let i = 0; i < count; i += 1) {
    // The middle of a slice frames exactly that material. Nothing else
    
    const middle = act.start + ((i + 0.5) / count) * (act.end - act.start)
    const at = materialAt(scene.acts, middle, regions)
    assert.equal(at.index, i, `middle of slice ${i} selects ${at.index}`)
    assert.ok(gap(at.region as Region, regions[i] as Region) < 1e-9, `slice ${i} frames elsewhere`)

    // And across the whole slice, the frame stays nearer the material
    // the reading has highlighted than any other. This is the failure
    // the old code had: selection on one clock, framing on another.
    for (let k = 1; k < 40; k += 1) {
      const p = act.start + ((i + k / 40) / count) * (act.end - act.start)
      const here = materialAt(scene.acts, p, regions)
      assert.equal(here.index, i, `slice ${i} leaks into ${here.index} at k=${k}`)
      const mine = gap(here.region as Region, regions[i] as Region)
      regions.forEach((other, j) => {
        if (j === i) return
        assert.ok(
          mine <= gap(here.region as Region, other) + 1e-9,
          `frame at slice ${i} (k=${k}) is nearer material ${j}`,
        )
      })
    }
  }

  // The pan is continuous: no cut between one material and the next.
  let previous = materialAt(scene.acts, act.start, regions).region as Region
  for (let p = act.start; p <= act.end; p += (act.end - act.start) / 600) {
    const now = materialAt(scene.acts, p, regions).region as Region
    assert.ok(gap(now, previous) < 0.01, `the framing cuts inside the material act at p=${p}`)
    previous = now
  }
}

// Outside the act there is nothing to select, and with no materials at
// all there is no frame to invent.
assert.deepEqual(materialAt(FULL.acts, 0.5, []), { index: -1, region: null })

/* ── the camera ──────────────────────────────────────────────────── */

const macroAt = (p: number) => materialAt(FULL.acts, p, MATERIALS).region
const material = actAt(FULL.acts, 'material') as Act

// The editorial opening leaves and the apparatus arrives, without the
// two ever fighting over the columns they share.
assert.equal(cameraFor(FULL.acts, 0, null).editorial, 1)
assert.equal(cameraFor(FULL.acts, 0, null).apparatus, 0)
const opened = (actAt(FULL.acts, 'silhouette') as Act).start
assert.ok(cameraFor(FULL.acts, opened, null).editorial < 0.001, 'opening never cleared')
assert.ok(cameraFor(FULL.acts, opened, null).apparatus > 0.999, 'apparatus never arrived')

// The push belongs to the material act and to nothing else. On both
// boundaries the frame is exactly where it would be with no material
// at all — which is what makes Prendas → Materiales → ADN de estilo
// three continuous moves instead of two cuts.
for (const edge of [material.start, material.end]) {
  assert.equal(
    cameraFor(FULL.acts, edge, macroAt(edge)).scale,
    cameraFor(FULL.acts, edge, null).scale,
    `the zoom is still running at ${edge}`,
  )
}
const inside = (material.start + material.end) / 2
assert.ok(
  cameraFor(FULL.acts, inside, macroAt(inside)).scale >
    cameraFor(FULL.acts, inside, null).scale * 1.5,
  'no push into the cloth',
)

// An analysis with no materials gets no zoom anywhere, not a small one.
for (let p = 0; p <= 1.0001; p += 0.01) {
  assert.equal(
    cameraFor(BARE.acts, p, materialAt(BARE.acts, p, []).region).scale,
    cameraFor(BARE.acts, p, null).scale,
    `a look with no materials was zoomed at p=${p.toFixed(2)}`,
  )
}

// The look steps back for the trend.
assert.ok(cameraFor(FULL.acts, 1, null).z < -100, 'the look never receded')

// The camera is continuous: fast is allowed, a cut is not. Sampled
// fine enough to approximate the derivative, so the bound sits well
// under the whole unit a hard switch between two framings would move.
for (const [scene, regions] of [
  [FULL, MATERIALS],
  [BARE, []],
] as const) {
  let previous = cameraFor(scene.acts, 0, materialAt(scene.acts, 0, regions).region)
  for (let p = 0.0005; p <= 1.0001; p += 0.0005) {
    const now = cameraFor(scene.acts, p, materialAt(scene.acts, p, regions).region)
    assert.ok(
      Math.abs(now.scale - previous.scale) < 0.05,
      `scale jumps at p=${p.toFixed(4)}: ${previous.scale} to ${now.scale}`,
    )
    assert.ok(
      Math.abs(now.x - previous.x) < 1,
      `pan jumps at p=${p.toFixed(4)}: ${previous.x} to ${now.x}`,
    )
    previous = now
  }
}

// Reached only if every assertion above held.
console.log('camera: ok')
