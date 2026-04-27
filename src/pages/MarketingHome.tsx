import { Link } from 'react-router-dom'
import MarketingHeader from '@/components/MarketingHeader'
import MarketingPopularProductsCarousel from '@/components/MarketingPopularProductsCarousel'

export default function MarketingHome() {
  return (
    <div className="marketing-site">
      <MarketingHeader />

      <main className="marketing-main">
        <section className="marketing-hero card">
          <div className="marketing-hero-copy">
            <p className="marketing-kicker">Lamtek</p>
            <h1>Quality kitchens, bedrooms and components for the trade</h1>
            <p>
              Britain’s leading manufacturer of quality flat-pack kitchen and bedroom carcasses — with Rapid Cab, our
              pre-inserted cam, pin, and dowel system that cuts assembly time. Trade-only, British-made, and built for
              distributors, merchants, developers, and retailers across the UK and overseas.
            </p>
            <div className="marketing-hero-actions">
              <a href="/create-account" className="btn">Open an account</a>
              <a href="/login" className="btn btn-outline">Customer login</a>
            </div>
          </div>
          <div className="marketing-hero-panel" aria-label="Lamtek highlights">
            <h2>Why trade customers choose us</h2>
            <ul>
              <li>Founded 1989 — family-run, now three state-of-the-art plants</li>
              <li>125,000 sq ft in Nottinghamshire; 10,000+ cabinets a week</li>
              <li>FSC® certified board, local sourcing, and on-site energy recovery</li>
              <li>One place for products, online ordering, and downloads</li>
            </ul>
          </div>
        </section>

        <section className="marketing-stats">
          <Link to="/site/about" className="card marketing-stat-card">
            <h3>35+ years</h3>
            <p>Family-run KBB manufacturing with a skilled team of 80+ people.</p>
          </Link>
          <Link to="/site/manufacturing" className="card marketing-stat-card">
            <h3>125,000 sq ft</h3>
            <p>Three manufacturing plants in Nottinghamshire.</p>
          </Link>
          <Link to="/site/depots" className="card marketing-stat-card">
            <h3>Nottinghamshire HQ</h3>
            <p>Wolsey Drive, Kirkby-in-Ashfield — contact, hours, and loading times.</p>
          </Link>
        </section>

        <MarketingPopularProductsCarousel />

        <section className="marketing-grid">
          <article className="card marketing-feature-card">
            <div className="marketing-feature-icon" aria-hidden>
              <svg viewBox="0 0 24 24" focusable="false" aria-hidden>
                <path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7h-7v-7zm9 0h7v7h-7v-7z" />
              </svg>
            </div>
            <h2>Products</h2>
            <p>
              Kitchens, bedrooms, components, drawers, and fittings — flat-pack, eight carcass colours, 0.8mm ABS
              edging, and Rapid Cab assembly.
            </p>
            <Link to="/site/products" className="admin-link">Explore products</Link>
          </article>
          <article className="card marketing-feature-card">
            <div className="marketing-feature-icon" aria-hidden>
              <svg viewBox="0 0 24 24" focusable="false" aria-hidden>
                <path d="M4 5h16v10H4V5zm-2 12h20v2H2v-2z" />
              </svg>
            </div>
            <h2>Online ordering</h2>
            <p>Create quotes, place orders, and track progress from one customer account.</p>
            <Link to="/site/ordering" className="admin-link">Start ordering</Link>
          </article>
          <article className="card marketing-feature-card">
            <div className="marketing-feature-icon" aria-hidden>
              <svg viewBox="0 0 24 24" focusable="false" aria-hidden>
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18h14v2H5v-2z" />
              </svg>
            </div>
            <h2>Downloads</h2>
            <p>Brochures, literature, and links to the main Lamtek website resources.</p>
            <Link to="/site/downloads" className="admin-link">View downloads</Link>
          </article>
          <article className="card marketing-feature-card">
            <div className="marketing-feature-icon" aria-hidden>
              <svg viewBox="0 0 24 24" focusable="false" aria-hidden className="marketing-icon-warehouse">
                <path fill="currentColor" d="M1 7h22v3H1V7zm0 3h22v13H1V10z" />
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.65"
                  strokeLinecap="round"
                  d="M5.5 16v6M12 16v6M18.5 16v6M4.5 16.25h15"
                />
              </svg>
            </div>
            <h2>Contact</h2>
            <p>Head office address, phone, and opening or loading hours.</p>
            <Link to="/site/depots" className="admin-link">Contact &amp; hours</Link>
          </article>
        </section>

        <section className="marketing-process card">
          <h2>A simple path from enquiry to delivery</h2>
          <div className="marketing-process-grid marketing-process-grid--four">
            <div>
              <h3>1. Open your account</h3>
              <p>Get your trade account set up so you can see live stock, pricing, and place orders online.</p>
            </div>
            <div>
              <h3>2. Build your order</h3>
              <p>Quote and order through the portal — keep everything in one place for the workshop and fitters.</p>
            </div>
            <div>
              <h3>3. Track your order</h3>
              <p>Follow progress from confirmation through to despatch so you can plan installs without chasing.</p>
            </div>
            <div>
              <h3>4. Full support and aftercare</h3>
              <p>Our team is here to help with technical queries, lead times, and after-sales support.</p>
            </div>
          </div>
        </section>

        <section className="marketing-testimonials">
          <article className="card">
            <p className="marketing-quote">
              We have been using Lamtek kitchen and bedroom carcasses for around 10 years, and their quality and service
              have always been exceptional. Their carcasses are well-made, available in a wide range of colours, and
              consistently meet the highest standards.
            </p>
            <p className="marketing-quote-meta">Gregg Rice, G Rice Kitchens and Bedrooms</p>
          </article>
          <article className="card">
            <p className="marketing-quote">
              As a trade-only supplier, we partner with distributors, merchants, developers, and retailers across the UK and
              overseas, delivering high-quality, British-made products with precision and reliability.
            </p>
            <p className="marketing-quote-meta">Lamtek — kitchen and bedroom carcasses</p>
          </article>
          <article className="card">
            <p className="marketing-quote">
              We prioritise local sourcing where possible, with UK-manufactured melamine-faced chipboard — FSC® certified
              — and on-site use of offcuts to heat our factories.
            </p>
            <p className="marketing-quote-meta">Sustainability at Lamtek</p>
          </article>
        </section>

        <section className="marketing-proof card">
          <h2>Built for trade reliability</h2>
          <p>
            Rapid Cab, eight carcass colours, and the scale to support high-volume production — with the customer service
            you expect from a long-term supply partner.
          </p>
          <div className="marketing-proof-actions">
            <a href="/create-account" className="btn">Open an account</a>
            <a href="/login" className="btn btn-outline">Login</a>
          </div>
        </section>
      </main>

      <footer className="marketing-footer">
        <div className="marketing-footer-inner">
          <p>Lamtek Ltd</p>
          <div className="marketing-footer-links">
            <Link to="/site/products">Products</Link>
            <Link to="/site/ordering">Online ordering</Link>
            <Link to="/site/downloads">Downloads</Link>
            <Link to="/site/gallery">Gallery</Link>
            <Link to="/site/depots">Contact</Link>
            <Link to="/admin/login" className="marketing-staff-link">Staff login</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
