import { Link } from 'react-router-dom'
import MarketingHeader from '@/components/MarketingHeader'

export default function MarketingAboutPage() {
  return (
    <div className="marketing-site">
      <MarketingHeader />
      <main className="marketing-main marketing-main--wide">
        <section className="marketing-hero marketing-hero--image card">
          <div className="marketing-hero-copy">
            <p className="marketing-kicker">Est. 1989 · Crafting excellence</p>
            <h1>About Lamtek</h1>
            <p className="marketing-lead">
              Crafting excellence, delivering reliability. We are proud to be the UK’s largest manufacturer of flat-pack
              kitchen and bedroom carcasses. As a trade-only supplier, we work with distributors, merchants, developers, and
              retailers across the UK and overseas, delivering high-quality, British-made products with precision and
              reliability.
            </p>
            <p className="marketing-lead">
              Founded in 1989, Lamtek remains a family-run business built on strong values of craftsmanship, quality, and
              customer service. We now operate from three state-of-the-art manufacturing plants, spanning 125,000 square
              feet, with a team of over 80 skilled professionals dedicated to durable, well-crafted furniture components.
            </p>
            <div className="marketing-hero-actions">
              <Link to="/create-account" className="btn">
                Open a trade account
              </Link>
              <Link to="/site/manufacturing" className="btn btn-outline">
                Manufacturing footprint
              </Link>
            </div>
          </div>
          <div className="marketing-hero-media">
            <img
              src="/marketing/warehouse-boards.png"
              alt="High-bay warehouse with panel stock and Lamtek operations"
              loading="eager"
              className="marketing-hero-photo"
            />
          </div>
        </section>

        <section className="marketing-stats marketing-stats--about">
          <div className="card marketing-stat-card">
            <h3>35+ years</h3>
            <p>Family-run manufacturing with continuous investment in people and plant.</p>
          </div>
          <div className="card marketing-stat-card">
            <h3>125,000 sq ft</h3>
            <p>Three manufacturing plants in Nottinghamshire.</p>
          </div>
          <div className="card marketing-stat-card">
            <h3>80+ people</h3>
            <p>Skilled team focused on quality and service.</p>
          </div>
        </section>

        <section className="card marketing-prose-block">
          <h2>Our responsibility</h2>
          <p>
            We believe great manufacturing should also be responsible. We prioritise local sourcing wherever possible, and
            every carcass is made from UK-manufactured melamine-faced chipboard — FSC® certified. Excess offcuts and
            chipboard from machining are used to heat our factories via on-site energy recovery, reducing reliance on
            landfill. Our expertise, passion, and commitment to British manufacturing are central to what we do.
          </p>
        </section>

        <section className="marketing-split card">
          <div className="marketing-split-media">
            <img src="/marketing/manufacturing-factory.png" alt="Wood panel production and factory floor" loading="lazy" />
          </div>
          <div className="marketing-split-copy">
            <h2>Manufacturing you can stand behind</h2>
            <p>
              Our environment is set up for volume, precision, and quality control — so components fit first time. Rapid
              Cab, eight carcass colours, 0.8mm ABS front edging, and metal shelf supports in double units are all part of a
              system built for the trade.
            </p>
            <p>
              <Link to="/site/manufacturing" className="admin-link">
                Read more about our manufacturing capability
              </Link>
            </p>
          </div>
        </section>

        <section className="marketing-split card marketing-split--reverse">
          <div className="marketing-split-media">
            <img src="/marketing/bedroom-harrington.png" alt="Sage green shaker bedroom wardrobes in a styled room" loading="lazy" />
          </div>
          <div className="marketing-split-copy">
            <h2>Complete kitchens and living spaces</h2>
            <p>
              For full door programmes and complete-kitchen solutions for the trade, our Lamtek Complete range covers
              modern and traditional styles — manufactured with quality materials and dependable delivery. See{' '}
              <a href="https://lamtekcomplete.co.uk/" target="_blank" rel="noreferrer" className="admin-link">
                lamtekcomplete.co.uk
              </a>{' '}
              and{' '}
              <a href="https://lamtekcomplete.co.uk/our-kitchens/" target="_blank" rel="noreferrer" className="admin-link">
                our kitchen styles
              </a>
              .
            </p>
          </div>
        </section>

        <section className="card marketing-prose-block">
          <h2>Where to go next</h2>
          <p>
            Explore <Link to="/site/products">products and ranges</Link>, view the{' '}
            <Link to="/site/gallery">gallery</Link>, check <Link to="/site/depots">contact and hours</Link>, or{' '}
            <Link to="/create-account">open an account</Link> to access the live catalogue, pricing, and ordering in the
            portal.
          </p>
        </section>
      </main>
    </div>
  )
}
