import { cn } from '@/lib/utils'
import type { Anchor, OutfitImage, Region } from '@/types'

/**
 * The photograph and the technical marks laid over it.
 *
 * The image is never darkened, tinted or filtered. Marks appear only
 * over the active region and every stroke is hairline.
 */

export type MarkTone = 'inference' | 'interpretation'

export interface PlateMark {
  readonly id: string
  readonly anchor: Anchor
  readonly label: string
  readonly side: 'left' | 'right'
  readonly tone?: MarkTone
}

export interface ProportionBracket {
  /** Normalised y where the upper section starts. */
  readonly top: number
  /** Normalised y of the division between upper and lower. */
  readonly split: number
  /** Normalised y where the lower section ends. */
  readonly bottom: number
  readonly upperLabel: string
  readonly lowerLabel: string
}

/**
 * A horizontal measure across the figure: shoulder width, hip width, a
 * proportion reference. Both ends come from a Region in the data.
 */
export interface PlateRule {
  readonly id: string
  /** Normalised y of the measure. */
  readonly y: number
  /** Normalised x of each end. */
  readonly x1: number
  readonly x2: number
  readonly label?: string
}

interface OutfitPlateProps {
  readonly image: OutfitImage
  readonly focus?: Region | null
  readonly marks?: readonly PlateMark[]
  readonly bracket?: ProportionBracket | null
  readonly rules?: readonly PlateRule[]
  /** Normalised x of the vertical axis of the figure, if shown. */
  readonly axis?: number | null
  /** The hero image on first paint. Everything else lazy-loads. */
  readonly priority?: boolean
  readonly className?: string
}

const STROKE = {
  inference: 'var(--color-inference)',
  interpretation: 'var(--color-interpretation)',
} as const

/** Whole plate minus the focus rectangle, as one evenodd path. Cheap. */
function cutout(focus: Region): string {
  const x = focus.x * 100
  const y = focus.y * 100
  const w = focus.width * 100
  const h = focus.height * 100
  return `M0,0 H100 V100 H0 Z M${x},${y} H${x + w} V${y + h} H${x} Z`
}

export function OutfitPlate({
  image,
  focus = null,
  marks = [],
  bracket = null,
  rules = [],
  axis = null,
  priority = false,
  className,
}: OutfitPlateProps) {
  /* The frame is the photograph's, not a house ratio.

     Every mark on this plate is a normalised coordinate against the
     whole image. Forcing a 2:3 box and covering it cropped the look
     and, worse, moved every leader line and bracket off the thing it
     was pointing at: a hem measured at y=0.82 of the file landed
     somewhere else once the top and bottom of that file were gone. */
  const ratio = image.width > 0 && image.height > 0 ? image.width / image.height : 2 / 3

  return (
    <div
      className={cn('relative overflow-hidden bg-studio-700', className)}
      style={{ aspectRatio: ratio }}
    >
      <img
        src={image.src}
        alt={image.alt}
        width={image.width || undefined}
        height={image.height || undefined}
        loading={priority ? 'eager' : 'lazy'}
        // eslint-disable-next-line react/no-unknown-property
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        draggable={false}
        className="size-full object-contain select-none"
      />

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full"
      >
        {focus ? (
          <>
            {/* Isolation, not concealment: enough to say "look here",
                not enough to stop you reading the rest of the look. */}
            <path
              d={cutout(focus)}
              fillRule="evenodd"
              fill="var(--color-studio-900)"
              opacity="0.42"
              style={{ transition: 'opacity var(--duration-slow) var(--ease-settle)' }}
            />
            <rect
              x={focus.x * 100}
              y={focus.y * 100}
              width={focus.width * 100}
              height={focus.height * 100}
              fill="none"
              stroke="var(--color-bone)"
              strokeOpacity="0.55"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : null}

        {axis !== null ? (
          <line
            className="u-mark-in"
            x1={axis * 100}
            y1="2"
            x2={axis * 100}
            y2="98"
            stroke={STROKE.inference}
            strokeWidth="1"
            strokeOpacity="0.45"
            strokeDasharray="2 5"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        {rules.map((rule) => (
          <g
            key={rule.id}
            className="u-mark-in"
            stroke={STROKE.inference}
            strokeWidth="1"
            strokeOpacity="0.8"
            vectorEffect="non-scaling-stroke"
          >
            <line x1={rule.x1 * 100} y1={rule.y * 100} x2={rule.x2 * 100} y2={rule.y * 100} />
            {/* End ticks, so a measure reads as a measure and not as a
                decorative line lying across the photograph. */}
            <line
              x1={rule.x1 * 100}
              y1={rule.y * 100 - 1.4}
              x2={rule.x1 * 100}
              y2={rule.y * 100 + 1.4}
            />
            <line
              x1={rule.x2 * 100}
              y1={rule.y * 100 - 1.4}
              x2={rule.x2 * 100}
              y2={rule.y * 100 + 1.4}
            />
          </g>
        ))}

        {bracket ? (
          <g
            className="u-mark-in"
            stroke={STROKE.inference}
            strokeWidth="1"
            fill="none"
            vectorEffect="non-scaling-stroke"
          >
            <path
              d={`M91,${bracket.top * 100} H95 V${bracket.split * 100} H91`}
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={`M91,${bracket.split * 100} H95 V${bracket.bottom * 100} H91`}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1="6"
              y1={bracket.split * 100}
              x2="95"
              y2={bracket.split * 100}
              strokeDasharray="4 4"
              strokeOpacity="0.7"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ) : null}

        {marks.map((mark) => {
          const tone = mark.tone ?? 'inference'
          const endX = mark.side === 'left' ? 4 : 96
          return (
            <g key={mark.id} className="u-mark-in">
              <line
                x1={mark.anchor.x * 100}
                y1={mark.anchor.y * 100}
                x2={endX}
                y2={mark.anchor.y * 100}
                stroke={STROKE[tone]}
                strokeWidth="1"
                strokeOpacity="0.85"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={mark.anchor.x * 100}
                cy={mark.anchor.y * 100}
                r="1"
                fill={STROKE[tone]}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )
        })}
      </svg>

      {/* Labels live in HTML so the squashed viewBox cannot distort
          type, and carry the camera's inverse scale so they stay at
          reading size through a zoom. The scale is written after the
          translate and anchored to the pinned edge, so counter-scaling
          does not move them: that edge is the transform origin and the
          percentage translate resolves against the unscaled box. */}
      {marks.map((mark) => (
        <span
          key={mark.id}
          className={cn(
            'u-meta-sm u-mark-in pointer-events-none absolute whitespace-nowrap',
            mark.side === 'left' ? 'left-1.5' : 'right-1.5',
            (mark.tone ?? 'inference') === 'inference' ? 'text-inference' : 'text-interpretation',
          )}
          style={{
            top: `${mark.anchor.y * 100}%`,
            transform: 'translateY(calc(-100% - 3px)) scale(var(--cam-inv, 1))',
            transformOrigin: mark.side === 'left' ? 'left bottom' : 'right bottom',
          }}
        >
          {mark.label}
        </span>
      ))}

      {rules.map((rule) =>
        rule.label ? (
          <span
            key={rule.id}
            className="u-meta-sm u-mark-in pointer-events-none absolute whitespace-nowrap text-inference"
            style={{
              top: `${rule.y * 100}%`,
              left: `${((rule.x1 + rule.x2) / 2) * 100}%`,
              transform: 'translate(-50%, calc(-100% - 4px)) scale(var(--cam-inv, 1))',
              transformOrigin: 'center bottom',
            }}
          >
            {rule.label}
          </span>
        ) : null,
      )}

      {bracket ? (
        <>
          <span
            className="u-num u-mark-in pointer-events-none absolute right-1 text-inference"
            style={{
              top: `${((bracket.top + bracket.split) / 2) * 100}%`,
              transform: 'translateY(-50%) scale(var(--cam-inv, 1))',
              transformOrigin: 'right center',
            }}
          >
            {bracket.upperLabel}
          </span>
          <span
            className="u-num u-mark-in pointer-events-none absolute right-1 text-inference"
            style={{
              top: `${((bracket.split + bracket.bottom) / 2) * 100}%`,
              transform: 'translateY(-50%) scale(var(--cam-inv, 1))',
              transformOrigin: 'right center',
            }}
          >
            {bracket.lowerLabel}
          </span>
        </>
      ) : null}
    </div>
  )
}
