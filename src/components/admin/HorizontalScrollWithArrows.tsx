import { forwardRef, useRef, useState, useEffect, useCallback, useImperativeHandle } from 'react'

const ARROW_SCROLL_AMOUNT = 280
const AUTOSCROLL_SPEED_PX_PER_MS = 0.2
const ARROW_INSET_PX = 10

type ScrollDirection = 'left' | 'right' | null

type OverlayArrowLayout = {
  visible: boolean
  top: number
  left: number
  right: number
}

export type HorizontalScrollState = {
  canScrollLeft: boolean
  canScrollRight: boolean
}

export type HorizontalScrollHandle = {
  scrollLeft: () => void
  scrollRight: () => void
  getScrollState: () => HorizontalScrollState
}

interface HorizontalScrollWithArrowsProps {
  children: React.ReactNode
  className?: string
  /** Extra classes on the element that actually scrolls horizontally */
  innerClassName?: string
  /** Applied to the content wrapper (e.g. minWidth matching table column sum) */
  contentStyle?: React.CSSProperties
  /** Overlay arrows tracked to this scroll region (default true). */
  overlayArrows?: boolean
  /** Called when horizontal scroll limits change (for optional toolbar buttons). */
  onScrollStateChange?: (state: HorizontalScrollState) => void
}

export const HorizontalScrollWithArrows = forwardRef<HorizontalScrollHandle, HorizontalScrollWithArrowsProps>(
  function HorizontalScrollWithArrows(
    {
      children,
      className = '',
      innerClassName = '',
      contentStyle,
      overlayArrows = true,
      onScrollStateChange,
    },
    ref
  ) {
    const wrapRef = useRef<HTMLDivElement>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const [scrollDirection, setScrollDirection] = useState<ScrollDirection>(null)
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(false)
    const [arrowLayout, setArrowLayout] = useState<OverlayArrowLayout>({
      visible: false,
      top: 0,
      left: 0,
      right: 0,
    })
    const rafRef = useRef<number | null>(null)
    const lastTickRef = useRef<number>(0)

    const updateScrollState = useCallback(() => {
      const el = scrollRef.current
      if (!el) return
      const { scrollLeft, scrollWidth, clientWidth } = el
      const left = scrollLeft > 2
      const right = scrollLeft < scrollWidth - clientWidth - 2
      setCanScrollLeft(left)
      setCanScrollRight(right)
      onScrollStateChange?.({ canScrollLeft: left, canScrollRight: right })
    }, [onScrollStateChange])

    const updateArrowLayout = useCallback(() => {
      const base = scrollRef.current ?? wrapRef.current
      if (!base) return
      const rect = base.getBoundingClientRect()
      const vh = window.innerHeight
      const visible =
        overlayArrows &&
        rect.top < vh - 24 &&
        rect.bottom > 24 &&
        rect.width > 48 &&
        rect.height > 24
      const visibleTop = Math.max(24, rect.top)
      const visibleBottom = Math.min(vh - 24, rect.bottom)
      const centerY = visibleTop < visibleBottom
        ? Math.min(visibleBottom - 24, visibleTop + Math.max(96, (visibleBottom - visibleTop) * 0.72))
        : vh / 2
      setArrowLayout({
        visible,
        top: centerY,
        left: Math.max(ARROW_INSET_PX, rect.left + ARROW_INSET_PX),
        right: Math.max(ARROW_INSET_PX, window.innerWidth - rect.right + ARROW_INSET_PX),
      })
    }, [overlayArrows])

    const scrollLeftFn = useCallback(() => {
      const el = scrollRef.current
      if (el) {
        el.scrollLeft = Math.max(0, el.scrollLeft - ARROW_SCROLL_AMOUNT)
        updateScrollState()
      }
    }, [updateScrollState])

    const scrollRightFn = useCallback(() => {
      const el = scrollRef.current
      if (el) {
        const max = el.scrollWidth - el.clientWidth
        el.scrollLeft = Math.min(max, el.scrollLeft + ARROW_SCROLL_AMOUNT)
        updateScrollState()
      }
    }, [updateScrollState])

    useImperativeHandle(
      ref,
      () => ({
        scrollLeft: scrollLeftFn,
        scrollRight: scrollRightFn,
        getScrollState: () => ({ canScrollLeft, canScrollRight }),
      }),
      [scrollLeftFn, scrollRightFn, canScrollLeft, canScrollRight]
    )

    useEffect(() => {
      const el = scrollRef.current
      if (!el) return
      updateScrollState()
      const obs = new ResizeObserver(updateScrollState)
      obs.observe(el)
      el.addEventListener('scroll', updateScrollState)
      return () => {
        obs.disconnect()
        el.removeEventListener('scroll', updateScrollState)
      }
    }, [updateScrollState])

    useEffect(() => {
      if (!overlayArrows) return
      updateArrowLayout()
      const wrap = wrapRef.current
      if (!wrap) return
      const obs = new ResizeObserver(updateArrowLayout)
      obs.observe(wrap)
      window.addEventListener('scroll', updateArrowLayout, true)
      window.addEventListener('resize', updateArrowLayout)
      return () => {
        obs.disconnect()
        window.removeEventListener('scroll', updateArrowLayout, true)
        window.removeEventListener('resize', updateArrowLayout)
      }
    }, [updateArrowLayout, overlayArrows])

    useEffect(() => {
      if (scrollDirection === null) return
      const el = scrollRef.current
      if (!el) return

      lastTickRef.current = performance.now()

      function tick(now: number) {
        const scrollEl = scrollRef.current
        if (!scrollEl || scrollEl !== el) return
        const dt = Math.min(now - lastTickRef.current, 50)
        lastTickRef.current = now

        const max = el.scrollWidth - el.clientWidth
        if (scrollDirection === 'left') {
          const move = -AUTOSCROLL_SPEED_PX_PER_MS * dt
          el.scrollLeft = Math.max(0, el.scrollLeft + move)
          if (el.scrollLeft <= 0) setScrollDirection(null)
        } else if (scrollDirection === 'right') {
          const move = AUTOSCROLL_SPEED_PX_PER_MS * dt
          el.scrollLeft = Math.min(max, el.scrollLeft + move)
          if (el.scrollLeft >= max - 1) setScrollDirection(null)
        }
        updateScrollState()
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
      return () => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      }
    }, [scrollDirection, updateScrollState])

    const arrowVisibility = arrowLayout.visible ? 'visible' : 'hidden'

    return (
      <div className={`admin-horizontal-scroll-wrap ${className}`} ref={wrapRef}>
        <div
          ref={scrollRef}
          className={`admin-horizontal-scroll-inner${innerClassName ? ` ${innerClassName}` : ''}`}
        >
          <div className="admin-horizontal-scroll-content" style={contentStyle}>
            {children}
          </div>
        </div>
        {overlayArrows ? (
          <>
            <button
              type="button"
              className="admin-scroll-arrow admin-scroll-arrow--left admin-scroll-arrow--overlay"
              style={{
                visibility: arrowVisibility,
                top: arrowLayout.top,
                left: arrowLayout.left,
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                scrollLeftFn()
              }}
              onMouseEnter={() => setScrollDirection('left')}
              onMouseLeave={() => setScrollDirection(null)}
              disabled={!canScrollLeft}
              title="Scroll left (hover to auto-scroll)"
              aria-label="Scroll left"
            >
              <ChevronLeftIcon />
            </button>
            <button
              type="button"
              className="admin-scroll-arrow admin-scroll-arrow--right admin-scroll-arrow--overlay"
              style={{
                visibility: arrowVisibility,
                top: arrowLayout.top,
                right: arrowLayout.right,
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                scrollRightFn()
              }}
              onMouseEnter={() => setScrollDirection('right')}
              onMouseLeave={() => setScrollDirection(null)}
              disabled={!canScrollRight}
              title="Scroll right (hover to auto-scroll)"
              aria-label="Scroll right"
            >
              <ChevronRightIcon />
            </button>
          </>
        ) : null}
      </div>
    )
  }
)

/** Toolbar left/right buttons matching catalogue column-settings styling. */
export function HorizontalScrollToolbarArrows({
  canScrollLeft,
  canScrollRight,
  onScrollLeft,
  onScrollRight,
  className = '',
}: {
  canScrollLeft: boolean
  canScrollRight: boolean
  onScrollLeft: () => void
  onScrollRight: () => void
  className?: string
}) {
  return (
    <div className={`admin-catalogue-scroll-arrows ${className}`.trim()} role="group" aria-label="Scroll table horizontally">
      <button
        type="button"
        className="admin-scroll-arrow admin-scroll-arrow--toolbar"
        onClick={(e) => {
          e.preventDefault()
          onScrollLeft()
        }}
        disabled={!canScrollLeft}
        title="Scroll table left"
        aria-label="Scroll table left"
      >
        <ChevronLeftIcon />
      </button>
      <button
        type="button"
        className="admin-scroll-arrow admin-scroll-arrow--toolbar"
        onClick={(e) => {
          e.preventDefault()
          onScrollRight()
        }}
        disabled={!canScrollRight}
        title="Scroll table right"
        aria-label="Scroll table right"
      >
        <ChevronRightIcon />
      </button>
    </div>
  )
}

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}
