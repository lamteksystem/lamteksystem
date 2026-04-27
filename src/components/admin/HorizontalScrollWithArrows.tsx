import { useRef, useState, useEffect, useCallback } from 'react'

const ARROW_SCROLL_AMOUNT = 280
const AUTOSCROLL_SPEED_PX_PER_MS = 0.2

type ScrollDirection = 'left' | 'right' | null

interface HorizontalScrollWithArrowsProps {
  children: React.ReactNode
  className?: string
}

export function HorizontalScrollWithArrows({ children, className = '' }: HorizontalScrollWithArrowsProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollDirection, setScrollDirection] = useState<ScrollDirection>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [arrowsVisible, setArrowsVisible] = useState(false)
  const rafRef = useRef<number | null>(null)
  const lastTickRef = useRef<number>(0)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanScrollLeft(scrollLeft > 2)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2)
  }, [])

  const updateArrowsVisible = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const vh = window.innerHeight
    setArrowsVisible(rect.top < vh && rect.bottom > 0 && rect.width > 0 && rect.height > 0)
  }, [])

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
  }, [updateScrollState, children])

  useEffect(() => {
    updateArrowsVisible()
    const wrap = wrapRef.current
    if (!wrap) return
    const obs = new ResizeObserver(updateArrowsVisible)
    obs.observe(wrap)
    window.addEventListener('scroll', updateArrowsVisible, true)
    window.addEventListener('resize', updateArrowsVisible)
    const interval = setInterval(updateArrowsVisible, 150)
    return () => {
      obs.disconnect()
      window.removeEventListener('scroll', updateArrowsVisible, true)
      window.removeEventListener('resize', updateArrowsVisible)
      clearInterval(interval)
    }
  }, [updateArrowsVisible])

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
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [scrollDirection])

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

  return (
    <div ref={wrapRef} className={`admin-horizontal-scroll-wrap ${className}`}>
      <div ref={scrollRef} className="admin-horizontal-scroll-inner">
        <div className="admin-horizontal-scroll-content">
          {children}
        </div>
      </div>
      {/* Fixed to viewport (always same position on screen); visible only when table is in view */}
      <button
        type="button"
        className="admin-scroll-arrow admin-scroll-arrow--left admin-scroll-arrow--fixed"
        style={{ visibility: arrowsVisible ? 'visible' : 'hidden' }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); scrollLeftFn(); }}
        onMouseEnter={() => setScrollDirection('left')}
        onMouseLeave={() => setScrollDirection(null)}
        disabled={!canScrollLeft}
        title="Scroll left (or hover to auto-scroll)"
        aria-label="Scroll left"
      >
        <ChevronLeftIcon />
      </button>
      <button
        type="button"
        className="admin-scroll-arrow admin-scroll-arrow--right admin-scroll-arrow--fixed"
        style={{ visibility: arrowsVisible ? 'visible' : 'hidden' }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); scrollRightFn(); }}
        onMouseEnter={() => setScrollDirection('right')}
        onMouseLeave={() => setScrollDirection(null)}
        disabled={!canScrollRight}
        title="Scroll right (or hover to auto-scroll)"
        aria-label="Scroll right"
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
