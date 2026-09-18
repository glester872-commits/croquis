import { FabricCurtain } from './FabricCurtain'
import { cn } from '@/lib/utils'

/**
 * The opening of the analysis: the look arrives behind two lengths of
 * cloth, and scroll draws them apart.
 *
 * This is not a scene of its own. The cloth lies over the analysis
 * that is already mounted behind it, driven by the properties
 * `writeReveal` puts on the surface, so when it is gone the photograph
 * left on screen is the one the reading is about to work on — no swap,
 * no second copy of the image, no cut.
 *
 * It sits above the chrome of the surface it covers: a header floating
 * over a closed curtain would give the opening away.
 */
export function AtelierReveal({
  title,
  tagline,
  simple = false,
  pinned = false,
}: {
  title: string
  tagline: string
  /** Touch: fewer layers, no 3D swing, same textile identity. */
  simple?: boolean
  /** The cloth is held by the viewport, not by an ancestor stage. */
  pinned?: boolean
}) {
  return (
    <div className={cn('z-[60]', pinned ? 'fixed inset-0' : 'absolute inset-0')}>
      <FabricCurtain title={title} tagline={tagline} simple={simple} lockupHidden />
    </div>
  )
}
