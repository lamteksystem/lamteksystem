import { Link } from 'react-router-dom'
import MarketingHeader from '@/components/MarketingHeader'

const TRADITIONAL_STYLES = [
  'Abbotsbury',
  'Ashby',
  'Ashbourne',
  'Burghley',
  'Chatsworth',
  'Delmere',
  'Faringdon',
  'Edwinstowe',
  'Grantham',
  'Jarrow',
  'Jersey',
  'Knightsbridge',
  'Lansbury',
  'Matlock',
  'Norwood',
  'Papplewick',
  'Wensley',
  'Windermere',
] as const

const MODERN_STYLES = [
  'Farndon',
  'Oakham Matt',
  'Harlow',
  'Oakham Soft Matt',
  'Oakham Gloss',
  'Rufford',
  'Sherwood Gloss',
  'Sherwood Matt',
  'Sudborough',
  'Tuxford',
] as const

export default function MarketingProductsPage() {
  return (
    <div className="marketing-site">
      <MarketingHeader />
      <main className="marketing-main marketing-main--wide">
        <section className="marketing-hero marketing-hero--image card">
          <div className="marketing-hero-copy">
            <p className="marketing-kicker">Trade kitchens &amp; bedrooms</p>
            <h1>Flat-pack carcasses and complete solutions</h1>
            <p className="marketing-lead">
              Lamtek is a trade-only manufacturer of kitchen and bedroom carcasses and components. All units are supplied
              boxed in flat-pack form for easy assembly, with our Rapid Cab system: cams, pins, and dowels pre-inserted to
              cut build time. Eight carcass colours, 0.8mm ABS front edging, double-module centre rails, and metal shelf
              supports are standard — plus a full range of components, drawers, and fittings. For complete kitchens and
              doors, our Lamtek Complete brand extends choice across traditional and modern styles.
            </p>
            <div className="marketing-hero-actions">
              <Link to="/login" className="btn">
                Login to browse the full catalogue
              </Link>
              <Link to="/create-account" className="btn btn-outline">
                Open a trade account
              </Link>
            </div>
          </div>
          <div className="marketing-hero-media">
            <img
              src="/marketing/kitchen-navy.png"
              alt="Shaker-style kitchen with navy cabinetry"
              loading="eager"
              className="marketing-hero-photo"
            />
          </div>
        </section>

        <section className="card marketing-prose-block">
          <h2>Quality built in</h2>
          <p>
            Whether you are specifying carcasses for a trade programme or a full install, our product design focuses on
            consistency, clear identification (customer ID labelling on packaging), and reliable supply from
            Nottinghamshire. FF&amp;E and component options support diverse project needs.
          </p>
        </section>

        <section className="marketing-split card">
          <div className="marketing-split-media">
            <img src="/marketing/kitchen-hadfield.png" alt="Bright kitchen with cream and blue-grey cabinetry" loading="lazy" />
          </div>
          <div className="marketing-split-copy">
            <h2>Bedrooms and living spaces</h2>
            <p>
              Bedroom carcasses and living-space components complement our kitchen offer — with the same focus on
              trade-friendly flat-pack, durable construction, and efficient assembly.
            </p>
            <p>
              <a href="https://www.lamtek.co.uk/bedrooms" className="admin-link" target="_blank" rel="noreferrer">
                lamtek.co.uk/bedrooms
              </a>
            </p>
          </div>
        </section>

        <section className="card">
          <h2>Lamtek Complete — kitchen styles (trade)</h2>
          <p className="marketing-muted">
            The following style names are published on{' '}
            <a href="https://lamtekcomplete.co.uk/our-kitchens/" target="_blank" rel="noreferrer" className="admin-link">
              lamtekcomplete.co.uk
            </a>
            . Availability and finishes are confirmed when you order or speak to the team.
          </p>
          <h3 className="marketing-subheading">Traditional</h3>
          <div className="marketing-range-grid">
            {TRADITIONAL_STYLES.map((name) => (
              <article key={name} className="marketing-range-card">
                <h3>{name}</h3>
                <p>Traditional kitchen style</p>
              </article>
            ))}
          </div>
          <h3 className="marketing-subheading" style={{ marginTop: '1.5rem' }}>
            Modern
          </h3>
          <div className="marketing-range-grid">
            {MODERN_STYLES.map((name) => (
              <article key={name} className="marketing-range-card">
                <h3>{name}</h3>
                <p>Modern kitchen style</p>
              </article>
            ))}
          </div>
          <p className="marketing-muted marketing-footnote">
            Full range and purchase routes:{' '}
            <a href="https://lamtekcomplete.co.uk/our-kitchens/" target="_blank" rel="noreferrer" className="admin-link">
              lamtekcomplete.co.uk/our-kitchens
            </a>
            . Phone:{' '}
            <a href="tel:01543466454">01543 466454</a> ·{' '}
            <a href="mailto:info@lamtekcomplete.co.uk">info@lamtekcomplete.co.uk</a>
          </p>
        </section>

        <section className="card marketing-prose-block">
          <h2>Main product hubs</h2>
          <ul className="marketing-bullet-list">
            <li>
              <a href="https://www.lamtek.co.uk/kitchens" target="_blank" rel="noreferrer">
                Kitchens
              </a>
            </li>
            <li>
              <a href="https://www.lamtek.co.uk/bedrooms" target="_blank" rel="noreferrer">
                Bedrooms
              </a>
            </li>
            <li>
              <a href="https://www.lamtek.co.uk/components" target="_blank" rel="noreferrer">
                Components
              </a>
            </li>
            <li>
              <a href="https://www.lamtek.co.uk/drawers" target="_blank" rel="noreferrer">
                Drawers
              </a>
            </li>
            <li>
              <a href="https://www.lamtek.co.uk/kitchenaccessories" target="_blank" rel="noreferrer">
                Fittings
              </a>
            </li>
            <li>
              <a href="https://www.lamtek.co.uk/rapid-cab" target="_blank" rel="noreferrer">
                Rapid Cab
              </a>
            </li>
            <li>
              <a href="https://www.lamtek.co.uk/colours" target="_blank" rel="noreferrer">
                Carcass colours
              </a>
            </li>
          </ul>
        </section>

        <section className="card marketing-resources">
          <h2>Brochures and literature</h2>
          <p>
            Use the main Lamtek site for the latest PDFs, project inspiration, and company updates. The portal also hosts
            downloads for registered trade account holders.
          </p>
          <ul className="marketing-external-links">
            <li>
              <a href="https://www.lamtek.co.uk/products" target="_blank" rel="noreferrer">
                Our products (lamtek.co.uk)
              </a>
            </li>
            <li>
              <a href="https://www.lamtek.co.uk/gallery" target="_blank" rel="noreferrer">
                Gallery
              </a>
            </li>
            <li>
              <a href="https://lamtekcomplete.co.uk/" target="_blank" rel="noreferrer">
                Lamtek Complete
              </a>
            </li>
          </ul>
          <div className="marketing-hero-actions">
            <Link to="/site/downloads" className="btn btn-outline">
              Portal downloads (login)
            </Link>
            <Link to="/" className="btn btn-outline">
              Back to home
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
