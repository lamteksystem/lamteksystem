import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { customerLoginHref, CUSTOMER_ORDERING_PATH } from '@/lib/customerRoutes'
import type { MarketingCarouselProductRow, MarketingSiteSettingsRow } from '@/types/database'

function imageSrc(raw: string | null | undefined): string | null {
  const t = raw?.trim()
  if (!t) return null
  // Normalise common Dropbox share links so images render reliably.
  if (/dropbox\.com/i.test(t)) {
    try {
      const u = new URL(t)
      if (u.searchParams.has('dl')) u.searchParams.set('dl', '1')
      else u.searchParams.set('raw', '1')
      return u.toString()
    } catch {
      return t
    }
  }
  return t
}

function shuffled<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

function pickDiverseProducts(items: MarketingCarouselProductRow[], limit: number): MarketingCarouselProductRow[] {
  if (items.length <= limit) return items
  const byCategory = new Map<string, MarketingCarouselProductRow[]>()
  for (const p of items) {
    const key = String(p.category_id ?? '')
    const list = byCategory.get(key) ?? []
    list.push(p)
    byCategory.set(key, list)
  }
  const buckets = Array.from(byCategory.values()).map((list) => shuffled(list))
  const picked: MarketingCarouselProductRow[] = []
  while (picked.length < limit && buckets.some((b) => b.length > 0)) {
    for (const bucket of buckets) {
      const item = bucket.shift()
      if (item) picked.push(item)
      if (picked.length >= limit) break
    }
  }
  return picked
}

export default function MarketingPopularProductsCarousel() {
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<MarketingCarouselProductRow[]>([])
  const [index, setIndex] = useState(0)
  const [slideImageFailed, setSlideImageFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: row } = await supabase
        .from('marketing_site_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle()

      if (cancelled) return
      const s = row as MarketingSiteSettingsRow | null
      const limit = Math.min(24, Math.max(1, s?.carousel_limit ?? 6))
      const ids = (s?.carousel_product_ids ?? []).filter(Boolean)

      const { data: rpcData, error: rpcError } = await supabase.rpc('marketing_carousel_products', {
        p_ids: ids.length > 0 ? ids : [],
        p_limit: limit,
      })

      if (cancelled) return

      if (rpcError) {
        console.warn('marketing_carousel_products', rpcError)
        setProducts([])
      } else {
        const fetched = (rpcData ?? []) as MarketingCarouselProductRow[]
        const withImages = fetched.filter((p) => Boolean(imageSrc(p.image_url)))
        const ordered = pickDiverseProducts(shuffled(withImages), limit)
        setProducts(ordered)
      }

      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const n = products.length

  const go = useCallback(
    (delta: number) => {
      if (n <= 0) return
      setIndex((i) => (i + delta + n) % n)
    },
    [n]
  )

  useEffect(() => {
    if (index >= n) setIndex(0)
  }, [index, n])

  const current = products[index]
  const currentImageSrc = current ? imageSrc(current.image_url) : null

  useEffect(() => {
    setSlideImageFailed(false)
  }, [current?.id, currentImageSrc])

  useEffect(() => {
    if (n <= 1) return
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % n)
    }, 6500)
    return () => window.clearInterval(t)
  }, [n])

  if (loading) {
    return (
      <section className="card marketing-carousel marketing-carousel--loading" aria-busy>
        <h2>Popular products</h2>
        <p className="marketing-gallery-intro">Loading…</p>
      </section>
    )
  }

  if (n === 0) {
    return (
      <section className="card marketing-carousel-empty">
        <h2>Popular products</h2>
        <p className="marketing-gallery-intro">Catalogue products will appear here once available.</p>
        <Link to={customerLoginHref(CUSTOMER_ORDERING_PATH)} className="btn btn-outline">
          Login to browse
        </Link>
      </section>
    )
  }

  return (
    <section
      className="marketing-carousel card"
      aria-roledescription="carousel"
      aria-label="Popular products"
    >
      <div className="marketing-carousel-head">
        <h2>Popular products</h2>
        <p className="marketing-gallery-intro">Use the arrows or dots to browse — or wait for the slideshow.</p>
      </div>

      <div className="marketing-carousel-body">
        <button
          type="button"
          className="marketing-carousel-nav marketing-carousel-nav--prev"
          onClick={() => go(-1)}
          aria-label="Previous product"
        >
          ‹
        </button>

        <article className="marketing-carousel-slide">
          <div className="marketing-carousel-image-wrap">
            {currentImageSrc && !slideImageFailed ? (
              <img
                src={currentImageSrc}
                alt={current.image_alt ?? current.name ?? 'Product'}
                loading="lazy"
                referrerPolicy="no-referrer"
                decoding="async"
                onError={() => setSlideImageFailed(true)}
              />
            ) : (
              <div className="marketing-carousel-no-image">No product image</div>
            )}
          </div>
          <div className="marketing-carousel-caption">
            <h3 className="marketing-carousel-title">{current.name}</h3>
            {current.sku && <p className="marketing-carousel-sku">SKU: {current.sku}</p>}
            <div className="marketing-carousel-actions">
              <Link to={customerLoginHref(CUSTOMER_ORDERING_PATH)} className="btn btn-small">
                Login to order
              </Link>
              <Link to="/site/products" className="btn btn-outline btn-small">
                Product overview
              </Link>
            </div>
          </div>
        </article>

        <button
          type="button"
          className="marketing-carousel-nav marketing-carousel-nav--next"
          onClick={() => go(1)}
          aria-label="Next product"
        >
          ›
        </button>
      </div>

      <div className="marketing-carousel-dots" role="tablist" aria-label="Slide indicators">
        {products.map((p, i) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            className={`marketing-carousel-dot ${i === index ? 'active' : ''}`}
            onClick={() => setIndex(i)}
            aria-label={`Show ${p.name ?? 'product'}`}
          />
        ))}
      </div>
    </section>
  )
}
