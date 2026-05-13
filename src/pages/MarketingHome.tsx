import { Link } from 'react-router-dom'
import MarketingHeader from '@/components/MarketingHeader'
import MarketingPopularProductsCarousel from '@/components/MarketingPopularProductsCarousel'
import MarketingHeroBackdrop from '@/components/marketing/MarketingHeroBackdrop'
import MarketingHeroExtraCard from '@/components/marketing/MarketingHeroExtraCard'
import MarketingVisualMosaic from '@/components/marketing/MarketingVisualMosaic'
import { publicAsset } from '@/lib/basePath'
import {
  ProcessFlowRibbon,
  StatFootprintGlyph,
  StatLocationGlyph,
  StatYearsGlyph,
} from '@/components/marketing/MarketingDecorSvgs'
import { IconDownloads, IconOrdering, IconProducts, IconWarehouse } from '@/components/marketing/marketingIcons'

const PROCESS_STEPS = [
  {
    n: 1,
    title: 'Open your account',
    body: 'Get your trade account set up so you can see live stock, pricing, and place orders online.',
  },
  {
    n: 2,
    title: 'Build your order',
    body: 'Quote and order through the portal — keep everything in one place for the workshop and fitters.',
  },
  {
    n: 3,
    title: 'Track your order',
    body: 'Follow progress from confirmation through to despatch so you can plan installs without chasing.',
  },
  {
    n: 4,
    title: 'Full support and aftercare',
    body: 'Our team is here to help with technical queries, lead times, and after-sales support.',
  },
] as const

export default function MarketingHome() {
  return (
    <div className="marketing-site">
      <MarketingHeader />

      <main className="marketing-main">
        <section className="marketing-hero marketing-home-hero card">
          <MarketingHeroBackdrop variant="split" />
          <div className="marketing-home-hero-top">
            <div className="marketing-hero-copy">
              <p className="marketing-kicker">Lamtek</p>
              <h1>Quality kitchens, bedrooms and components for the trade</h1>
              <p>
                Britain’s leading manufacturer of quality flat-pack kitchen and bedroom carcasses — with Rapid Cab, our
                pre-inserted cam, pin, and dowel system that cuts assembly time. Trade-only, British-made, and built for
                distributors, merchants, developers, and retailers across the UK and overseas.
              </p>
              <p>
                From first enquiry to repeat supply, we support trade customers with dependable manufacturing scale,
                practical lead-time planning, and account-based online ordering designed for busy workshops and installation
                teams.
              </p>
              <div className="marketing-hero-actions">
                <Link to="/create-account" className="btn">
                  Open an account
                </Link>
                <Link to="/login" className="btn btn-outline">
                  Customer login
                </Link>
              </div>
            </div>
            <figure className="marketing-home-hero-image">
              <img
                src={publicAsset('marketing/kitchen-hadfield.png')}
                alt="Styled Lamtek kitchen with bright cabinetry and fitted island"
                loading="eager"
                decoding="async"
              />
            </figure>
          </div>
          <div className="marketing-home-hero-bottom">
            <div className="marketing-mini-cards" aria-label="Lamtek service routes">
              <div className="marketing-mini-card">
                <strong className="marketing-mini-card-title">
                  <a
                    href="https://www.lamtek.co.uk/"
                    className="marketing-mini-card-title-link"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Lamtek
                  </a>
                </strong>
                <div className="marketing-mini-card-copy">
                  <p>
                    Flat-pack kitchen and bedroom carcasses and components from Nottinghamshire, with Rapid Cab
                    pre-inserted fittings and eight carcass colours.
                  </p>
                  <p>
                    Trade-only supply for distributors, merchants, and developers, with account-based ordering and
                    dependable lead-time planning for repeat fit-out schedules.
                  </p>
                </div>
                <div className="marketing-mini-card-media">
                  <img
                    src={publicAsset('marketing/kitchen-navy.png')}
                    alt="Lamtek fitted kitchen with navy island and painted units"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
              <div className="marketing-mini-card">
                <strong className="marketing-mini-card-title">
                  <a
                    href="https://lamtekcomplete.co.uk/"
                    className="marketing-mini-card-title-link"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Lamtek Complete
                  </a>
                </strong>
                <div className="marketing-mini-card-copy">
                  <p>
                    Complete kitchen programmes for the trade, with curated door ranges, traditional and modern styles,
                    and specification support.
                  </p>
                  <p>
                    Built for showrooms and installers pairing Lamtek carcasses with Lamtek Complete fronts and
                    accessories, from design choice through practical delivery and smoother handover to installation.
                  </p>
                </div>
                <div className="marketing-mini-card-media">
                  <img
                    src={publicAsset('marketing/bedroom-harrington.png')}
                    alt="Lamtek Complete fitted bedroom with painted wardrobes"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
            </div>
            <div className="marketing-hero-rail">
              <div className="marketing-hero-panel" aria-label="Lamtek highlights">
                <h2>Why trade customers choose us</h2>
                <ul>
                  <li>Founded 1989 — family-run, now three state-of-the-art plants</li>
                  <li>125,000 sq ft in Nottinghamshire; 10,000+ cabinets a week</li>
                  <li>FSC® certified board, local sourcing, and on-site energy recovery</li>
                  <li>One place for products, online ordering, and downloads</li>
                </ul>
              </div>
              <MarketingHeroExtraCard
                title="Your trade workspace"
                items={[
                  'Live catalogue pricing once your account is approved',
                  'Rapid Cab flat-pack — cams, pins & dowels pre-inserted for faster fitting',
                  'Quotes, orders, and documentation behind one secure login',
                ]}
                footer={
                  <Link to="/site/ordering" className="marketing-hero-extra-link">
                    How ordering works →
                  </Link>
                }
              />
            </div>
          </div>
        </section>

        <section className="marketing-stats">
          <Link to="/site/about" className="card marketing-stat-card">
            <div className="marketing-stat-card-art" aria-hidden>
              <StatYearsGlyph />
            </div>
            <h3>35+ years</h3>
            <p>Family-run KBB manufacturing with a skilled team of 80+ people.</p>
          </Link>
          <Link to="/site/manufacturing" className="card marketing-stat-card">
            <div className="marketing-stat-card-art" aria-hidden>
              <StatFootprintGlyph />
            </div>
            <h3>125,000 sq ft</h3>
            <p>Three manufacturing plants in Nottinghamshire.</p>
          </Link>
          <Link to="/site/depots" className="card marketing-stat-card">
            <div className="marketing-stat-card-art" aria-hidden>
              <StatLocationGlyph />
            </div>
            <h3>Nottinghamshire HQ</h3>
            <p>Wolsey Drive, Kirkby-in-Ashfield — contact, hours, and loading times.</p>
          </Link>
        </section>

        <MarketingVisualMosaic />

        <MarketingPopularProductsCarousel />

        <section className="marketing-grid">
          <article className="card marketing-feature-card">
            <div className="marketing-feature-icon" aria-hidden>
              <IconProducts />
            </div>
            <h2>Products</h2>
            <p>
              Kitchens, bedrooms, components, drawers, and fittings — flat-pack, eight carcass colours, 0.8mm ABS
              edging, and Rapid Cab assembly.
            </p>
            <Link to="/site/products" className="admin-link">
              Explore products
            </Link>
          </article>
          <article className="card marketing-feature-card">
            <div className="marketing-feature-icon" aria-hidden>
              <IconOrdering />
            </div>
            <h2>Online ordering</h2>
            <p>Create quotes, place orders, and track progress from one customer account.</p>
            <Link to="/site/ordering" className="admin-link">
              Start ordering
            </Link>
          </article>
          <article className="card marketing-feature-card">
            <div className="marketing-feature-icon" aria-hidden>
              <IconDownloads />
            </div>
            <h2>Downloads</h2>
            <p>Brochures, literature, and links to the main Lamtek website resources.</p>
            <Link to="/site/downloads" className="admin-link">
              View downloads
            </Link>
          </article>
          <article className="card marketing-feature-card">
            <div className="marketing-feature-icon" aria-hidden>
              <IconWarehouse />
            </div>
            <h2>Contact</h2>
            <p>Head office address, phone, and opening or loading hours.</p>
            <Link to="/site/depots" className="admin-link">
              Contact &amp; hours
            </Link>
          </article>
        </section>

        <section className="marketing-process card marketing-process--steps">
          <h2>A simple path from enquiry to delivery</h2>
          <ProcessFlowRibbon className="marketing-process-ribbon" />
          <div className="marketing-process-steps">
            {PROCESS_STEPS.map((step) => (
              <div key={step.title} className="marketing-process-step">
                <div className="marketing-process-step-num" aria-hidden>
                  {step.n}
                </div>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="marketing-testimonials">
          <article className="card marketing-testimonial-card">
            <span className="marketing-testimonial-mark" aria-hidden>
              “
            </span>
            <p className="marketing-quote">
              We have been using Lamtek kitchen and bedroom carcasses for around 10 years, and their quality and service
              have always been exceptional. Their carcasses are well-made, available in a wide range of colours, and
              consistently meet the highest standards.
            </p>
            <p className="marketing-quote-meta">Gregg Rice, G Rice Kitchens and Bedrooms</p>
          </article>
          <article className="card marketing-testimonial-card">
            <span className="marketing-testimonial-mark" aria-hidden>
              “
            </span>
            <p className="marketing-quote">
              As a trade-only supplier, we partner with distributors, merchants, developers, and retailers across the UK
              and overseas, delivering high-quality, British-made products with precision and reliability.
            </p>
            <p className="marketing-quote-meta">Lamtek — kitchen and bedroom carcasses</p>
          </article>
          <article className="card marketing-testimonial-card">
            <span className="marketing-testimonial-mark" aria-hidden>
              “
            </span>
            <p className="marketing-quote">
              We prioritise local sourcing where possible, with UK-manufactured melamine-faced chipboard — FSC® certified —
              and on-site use of offcuts to heat our factories.
            </p>
            <p className="marketing-quote-meta">Sustainability at Lamtek</p>
          </article>
        </section>

        <section className="marketing-proof card marketing-proof--split">
          <div className="marketing-proof-copy">
            <h2>Built for trade reliability</h2>
            <p>
              Rapid Cab, eight carcass colours, and the scale to support high-volume production — with the customer
              service you expect from a long-term supply partner.
            </p>
            <div className="marketing-proof-actions">
              <Link to="/create-account" className="btn">
                Open an account
              </Link>
              <Link to="/login" className="btn btn-outline">
                Login
              </Link>
            </div>
          </div>
          <figure className="marketing-proof-figure">
            <img
              src={publicAsset('marketing/manufacturing-factory.png')}
              alt="Lamtek factory floor with stacked panels and production equipment"
              loading="lazy"
              decoding="async"
            />
          </figure>
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
            <Link to="/site/lamtek-uk">lamtek.co.uk hub</Link>
            <Link to="/site/lamtek-complete-uk">lamtekcomplete.co.uk hub</Link>
            <Link to="/site/tealbury-uk">tealbury.co.uk hub</Link>
            <Link to="/admin/login" className="marketing-staff-link">
              Staff login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
