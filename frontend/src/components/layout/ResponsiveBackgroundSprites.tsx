import { useIsDesktop } from '@/lib/hooks/useMediaQuery'
import { BackgroundSprites as BackgroundSpritesComponent } from '@/components/layout/BackgroundSprites'

/**
 * Responsive wrapper for BackgroundSprites
 * Only renders on desktop viewports (md breakpoint and above)
 * Fully unmounts component on mobile to optimize performance
 */
export function ResponsiveBackgroundSprites() {
  const isDesktop = useIsDesktop()

  // Don't render at all on mobile - fully unmount to prevent DOM bloat
  if (!isDesktop) return null

  return <BackgroundSpritesComponent />
}
