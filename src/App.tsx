import { Suspense, lazy, useLayoutEffect } from 'react'
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  useNavigationType,
} from 'react-router-dom'

import { AskPanel, AskProvider } from '@/components/croquis/ask/AskCroquis'
import { SiteHeader } from '@/components/croquis/SiteHeader'
import { StudioRoom } from '@/components/croquis/StudioRoom'
import { Opening } from "@/components/croquis/RouteState"
import { Landing } from '@/routes/Landing'

/**
 * Home is the entrance, so it ships with the document. Everything else
 * is fetched when it is asked for: the analysis scene, the segmentation
 * and the garment cut-out are the bulk of the application, and none of
 * them is needed to open the front door.
 */
const Analysis = lazy(() => import('@/routes/Analysis').then((m) => ({ default: m.Analysis })))
const Analyze = lazy(() => import('@/routes/Analyze').then((m) => ({ default: m.Analyze })))
const NotFound = lazy(() => import('@/routes/NotFound').then((m) => ({ default: m.NotFound })))
const Outfits = lazy(() => import('@/routes/Outfits').then((m) => ({ default: m.Outfits })))
const Trend = lazy(() => import('@/routes/Trend').then((m) => ({ default: m.Trend })))
const Trends = lazy(() => import('@/routes/Trends').then((m) => ({ default: m.Trends })))
const Wardrobe = lazy(() => import('@/routes/Wardrobe').then((m) => ({ default: m.Wardrobe })))

/**
 * A new screen starts at its beginning.
 *
 * Two of these screens are scroll-driven scenes, so a client-side
 * navigation that kept the previous scroll position opened them
 * already halfway through: the analysis landed on its closing page and
 * home landed behind its own curtain. Going back is left alone, so the
 * browser can restore where the reader was.
 */
function ScrollToTop() {
  const { pathname } = useLocation()
  const navigation = useNavigationType()

  useLayoutEffect(() => {
    if (navigation !== 'POP') window.scrollTo(0, 0)
  }, [pathname, navigation])

  return null
}

/**
 * The table, while the screen laid on it is fetched.
 *
 * The ground is painted straight away, and nothing spins: a chunk on a
 * warm connection arrives faster than a spinner earns its appearance.
 *
 * It keeps the header. Without it, every single navigation blanked the
 * wordmark and the whole nav for the length of a fetch and left one
 * 11.5px word alone in the corner of an empty screen — the product
 * losing its own identity between one page and the next.
 */
function RouteFallback() {
  return (
    <StudioRoom className="min-h-dvh">
      <SiteHeader />
      <div className="u-page">
        <Opening what="la página" />
      </div>
    </StudioRoom>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AskProvider>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/analizar" element={<Analyze />} />
          <Route path="/analisis/:id" element={<Analysis />} />
          <Route path="/outfits" element={<Outfits />} />
          <Route path="/armario" element={<Wardrobe />} />
          <Route path="/tendencias" element={<Trends />} />
          <Route path="/tendencias/:slug" element={<Trend />} />
          {/* An unknown address says so, instead of quietly showing home
              and hiding the typo or the broken link that produced it. */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <AskPanel />
      </AskProvider>
    </BrowserRouter>
  )
}
