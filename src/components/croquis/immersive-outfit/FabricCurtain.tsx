/**
 * Two panels of cloth and the opening between them.
 *
 * Folds come from displacing a band gradient through fractal
 * turbulence rather than from drawing bands: displacement varies fold
 * width and lets edges wander down the panel.
 */

/** The filters live once, hidden, and are referenced by CSS. */
function DrapeFilters() {
  return (
    <svg aria-hidden focusable="false" className="pointer-events-none absolute size-0">
      <defs>
        {/* The vertical frequency has to stay an order of magnitude
            below the horizontal. Raise it and the displacement ripples
            down the panel, which reads as water or crumpled foil — the
            fold loses the long vertical continuity that is the whole
            signature of cloth hanging under its own weight. */}
        <filter id="croquis-drape" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.009 0.0015"
            numOctaves="2"
            seed="11"
            result="warp"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="warp"
            scale="128"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* The layer behind, warped on another seed and harder, so the
            two never fold in the same places. */}
        <filter id="croquis-drape-deep" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.006 0.0011"
            numOctaves="2"
            seed="29"
            result="warp"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="warp"
            scale="176"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  )
}

function Panel({ side, simple }: { side: 'left' | 'right'; simple: boolean }) {
  const isLeft = side === 'left'
  const outward = isLeft ? -1 : 1
  return (
    <div
      aria-hidden
      className="absolute inset-y-0 w-[50.4%] overflow-hidden"
      style={{
        left: isLeft ? 0 : undefined,
        right: isLeft ? undefined : 0,
        // Hinged at the outer edge, so opening swings the cloth away
        // from the room rather than sliding it flat across a plane.
        transformOrigin: isLeft ? 'left center' : 'right center',
        transform: simple
          ? `translateX(calc(var(--open, 0) * ${outward * 104}%))`
          : `translateX(calc(var(--open, 0) * ${outward * 104}%))
             rotateY(calc(var(--open, 0) * ${outward * 12}deg))`,
        willChange: 'transform',
      }}
    >
      {/* The layers are inset beyond the panel because displacement
          pulls pixels in from outside the source; without the margin
          the filter would eat the edges. */}

      {/* Cloth drawn back gathers: it does not slide away at the width
          it hung at. Compressing the fold layers horizontally towards
          the edge they hang from is what separates a length of fabric
          being pulled aside from a panel sliding on a rail — and the
          two layers gather at different rates, so the folds part.

          The gather goes on a wrapper and never on the filtered layer
          itself. Transform the element the displacement map is on and
          the turbulence is recomputed over the whole surface on every
          frame of the scroll; transform its parent and the browser
          scales the filtered raster it already has. */}
      {!simple ? (
        <div
          className="absolute -inset-[14%]"
          style={{
            transformOrigin: isLeft ? 'left center' : 'right center',
            transform: `scaleX(calc(1 - var(--open, 0) * 0.34))
                        translateX(calc(var(--open, 0) * ${outward * -4}%))`,
          }}
        >
          <div className="fabric-bolt absolute inset-0 opacity-80" />
        </div>
      ) : null}

      <div
        className="absolute -inset-[14%]"
        style={{
          transformOrigin: isLeft ? 'left center' : 'right center',
          // Capped by the margin the layer has: this face is the only
          // thing covering the panel, and 14% of overhang buys exactly
          // 11% of gather before the far edge starts pulling inside it.
          transform: 'scaleX(calc(1 - var(--open, 0) * 0.1))',
        }}
      >
        <div
          className="fabric-face absolute inset-0"
          style={isLeft ? undefined : ({ '--fold-angle': '268deg' } as React.CSSProperties)}
        />
      </div>

      {/* Side light: the room is lit through the opening, so the cloth
          is brightest along its inner edge and falls away outward.
          This is what makes the gap read as a physical opening. */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to ${isLeft ? 'left' : 'right'},
            rgba(222, 217, 208, 0.4) 0%, rgba(222, 217, 208, 0.12) 26%,
            rgba(129, 123, 116, 0.3) 68%, rgba(16, 16, 16, 0.42) 100%)`,
          // The wider the gap, the more light comes through it and the
          // further the far side of the cloth falls into shadow.
          opacity: 'calc(0.74 + var(--open, 0) * 0.26)',
        }}
      />

      {/* Where the two panels meet they turn back on themselves into a
          hollow nothing lights. Without it the pair reads as one sheet. */}
      <div
        className="absolute inset-y-0 w-20"
        style={{
          left: isLeft ? undefined : 0,
          right: isLeft ? 0 : undefined,
          background: `linear-gradient(to ${isLeft ? 'right' : 'left'}, transparent, rgba(16, 16, 16, 0.6) 60%, rgba(16, 16, 16, 0.94))`,
          borderRight: isLeft ? '1px solid rgba(241, 236, 228, 0.2)' : undefined,
          borderLeft: isLeft ? undefined : '1px solid rgba(241, 236, 228, 0.2)',
        }}
      />
    </div>
  )
}

export function FabricCurtain({
  title,
  tagline,
  simple = false,
  bare = false,
  lockupHidden = false,
}: {
  title: string
  tagline: string
  /** Mobile: fewer layers, no 3D swing, same textile identity. */
  simple?: boolean
  /**
   * Cloth only. Used when the curtain is covering a change of state
   * rather than opening the product, where a wordmark would be wrong.
   */
  bare?: boolean
  /**
   * The surface behind the cloth already carries this title as its own
   * heading, so the lockup is a second copy of it and reads as one.
   */
  lockupHidden?: boolean
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
      style={{ opacity: 'var(--cloth, 1)', perspective: '1500px' }}
    >
      <DrapeFilters />

      {/* Nothing opaque goes behind the panels. A dark fill here would
          sit above the photograph and the gap could never reveal it —
          the room already provides the dark, and the veil already
          guarantees the photograph is invisible at rest. */}

      <Panel side="left" simple={simple} />
      <Panel side="right" simple={simple} />

      {bare ? null : (
        <div
          aria-hidden={lockupHidden || undefined}
          className="absolute inset-0 grid place-items-center px-6 text-center"
          style={{ opacity: 'var(--lockup, 1)' }}
        >
          {/* Bone type on light cloth needs a ground, and it gets the one
            the material already provides: the hollow where the panels
            meet. A vertical shaft, because that is the shape a seam
            makes — an ellipse behind the type would read as a stain. */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to right,
              transparent 14%, rgba(16, 16, 16, 0.3) 30%,
              rgba(16, 16, 16, 0.66) 46%, rgba(16, 16, 16, 0.68) 54%,
              rgba(16, 16, 16, 0.3) 70%, transparent 86%)`,
            }}
          />
          <div className="relative">
            <p
              className="u-d1 text-plate uppercase"
              style={{ textShadow: '0 2px 30px rgba(16, 16, 16, 0.85)' }}
            >
              {title}
            </p>
            {/* Plate, not ink: the cloth is the one dark surface left on the
              light table, so type on it takes the plate cut — the same
              exception a caption over a photograph takes. */}
            <p
              className="u-meta text-plate-dim mt-6"
              style={{ textShadow: '0 1px 18px rgba(16, 16, 16, 0.9)' }}
            >
              {tagline}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
