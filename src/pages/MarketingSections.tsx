import { Link } from 'react-router-dom'
import MarketingHeader from '@/components/MarketingHeader'

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketing-site">
      <MarketingHeader />
      <main className="marketing-main">{children}</main>
    </div>
  )
}

export function MarketingOrderingPage() {
  return (
    <Wrapper>
      <section className="marketing-hero card">
        <div className="marketing-hero-copy">
          <h1>Online ordering for trade</h1>
          <p>
            Place and manage orders through one portal — with quotes, order tracking, and account tools aligned to
            Lamtek’s trade workflow from Nottinghamshire.
          </p>
          <div className="marketing-hero-actions">
            <a href="/login" className="btn">Login to start ordering</a>
            <a href="/create-account" className="btn btn-outline">Open an account</a>
          </div>
        </div>
        <div className="marketing-hero-panel">
          <h2>Ordering flow</h2>
          <ul>
            <li>Select products and quantities</li>
            <li>Save quote or place order</li>
            <li>Track order status and updates</li>
          </ul>
        </div>
      </section>
      <section className="marketing-process card">
        <h2>Support and fulfilment</h2>
        <div className="marketing-process-grid">
          <div>
            <h3>Head office &amp; manufacturing</h3>
            <p>
              Lamtek Ltd, Wolsey Drive, Kirkby-in-Ashfield, Nottinghamshire — production, logistics, and account support
              for UK and international trade customers.
            </p>
          </div>
          <div>
            <h3>Complete kitchen programmes</h3>
            <p>
              For Lamtek Complete door and kitchen solutions, see{' '}
              <a href="https://lamtekcomplete.co.uk/" target="_blank" rel="noreferrer" className="admin-link">
                lamtekcomplete.co.uk
              </a>
              .
            </p>
          </div>
          <div>
            <h3>Loading &amp; hours</h3>
            <p>See contact page for current opening and loading times before you book collections.</p>
          </div>
        </div>
      </section>
      <section className="card">
        <h2>How the portal works</h2>
        <div className="marketing-ordering-table-wrap">
          <table className="marketing-ordering-table">
            <thead>
              <tr>
                <th>Step</th>
                <th>What you do</th>
                <th>What we support</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>Sign in with your trade account</td>
                <td>Access live catalogue, pricing, and lead-time context</td>
              </tr>
              <tr>
                <td>2</td>
                <td>Build quotes and orders in one place</td>
                <td>Accurate line items, documentation, and status updates</td>
              </tr>
              <tr>
                <td>3</td>
                <td>Track through to despatch or collection</td>
                <td>Reliable information for your installs and your customers</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </Wrapper>
  )
}

export function MarketingDownloadsPage() {
  const featuredDownloads = [
    { label: 'Lamtek — Our products (brochures & literature)', href: 'https://www.lamtek.co.uk/products' },
    { label: 'Lamtek — Main website', href: 'https://www.lamtek.co.uk/' },
    { label: 'Lamtek Complete — Quality kitchens to trade', href: 'https://lamtekcomplete.co.uk/' },
    { label: 'Lamtek Complete — Kitchen styles (traditional & modern)', href: 'https://lamtekcomplete.co.uk/our-kitchens/' },
    { label: 'Rapid Cab (product information)', href: 'https://www.lamtek.co.uk/rapid-cab' },
    { label: 'Gallery', href: 'https://www.lamtek.co.uk/gallery' },
  ]

  const logoDownloads = [
    { label: 'Lamtek logo (light background)', href: 'https://www.lamtek.co.uk/' },
  ]

  const showroomCards = [
    ['Abbotsbury', 'https://lamtekcomplete.co.uk/our-kitchens/'],
    ['Ashbourne', 'https://lamtekcomplete.co.uk/our-kitchens/'],
    ['Burghley', 'https://lamtekcomplete.co.uk/our-kitchens/'],
    ['Chatsworth', 'https://lamtekcomplete.co.uk/our-kitchens/'],
    ['Farndon', 'https://lamtekcomplete.co.uk/our-kitchens/'],
    ['Grantham', 'https://lamtekcomplete.co.uk/our-kitchens/'],
    ['Harlow (modern)', 'https://lamtekcomplete.co.uk/our-kitchens/'],
    ['Sherwood Matt', 'https://lamtekcomplete.co.uk/our-kitchens/'],
  ] as const

  return (
    <Wrapper>
      <section className="marketing-hero card">
        <div className="marketing-hero-copy">
          <h1>Downloads</h1>
          <p>
            Brochure PDFs, trade literature, and media are published on the main Lamtek and Lamtek Complete websites. This
            page lists the same entry points so you can open resources in one place; for files hosted on this portal, sign
            in to access your library.
          </p>
          <p>
            Always use the current versions on{' '}
            <a href="https://www.lamtek.co.uk/" target="_blank" rel="noreferrer">
              lamtek.co.uk
            </a>{' '}
            for the latest materials.
          </p>
        </div>
        <div className="marketing-hero-panel">
          <h2>Quick links</h2>
          <ul>
            <li>Product and brochure pages</li>
            <li>Lamtek Complete kitchen range overview</li>
            <li>Portal-secured documents (after login)</li>
          </ul>
        </div>
      </section>

      <section className="card marketing-resources">
        <h2>Brochures, literature &amp; web resources</h2>
        <ul className="marketing-external-links">
          {featuredDownloads.map((d) => (
            <li key={d.href}>
              <a href={d.href} target="_blank" rel="noreferrer">{d.label}</a>
            </li>
          ))}
        </ul>
      </section>

      <section className="card marketing-resources">
        <h2>Brand &amp; logo</h2>
        <p className="marketing-muted">For approved print and website use, follow Lamtek brand rules.</p>
        <ul className="marketing-external-links">
          {logoDownloads.map((d) => (
            <li key={d.href}>
              <a href={d.href} target="_blank" rel="noreferrer">{d.label}</a>
            </li>
          ))}
        </ul>
        <p className="marketing-muted" style={{ marginTop: '0.75rem' }}>
          For logo authorisation and marketing queries, use the contact details on{' '}
          <a href="https://www.lamtek.co.uk/contact" target="_blank" rel="noreferrer">
            lamtek.co.uk/contact
          </a>{' '}
          or email <a href="mailto:info@lamtek.co.uk">info@lamtek.co.uk</a>.
        </p>
      </section>

      <section className="card marketing-resources">
        <h2>Featured kitchen styles (Lamtek Complete)</h2>
        <p className="marketing-muted">Style names and range detail — see the full list on the Lamtek Complete site.</p>
        <ul className="marketing-external-links">
          {showroomCards.map(([name, href]) => (
            <li key={name}>
              <a href={href} target="_blank" rel="noreferrer">{name}</a>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Login to access downloads</h2>
        <p className="page-intro">This library is available to approved trade account holders.</p>
        <div className="marketing-grid">
          <article className="card">
            <h3>Product imagery</h3>
            <p>Ready-to-use product visuals for showrooms, proposals, and customer presentations.</p>
          </article>
          <article className="card">
            <h3>Brochures</h3>
            <p>Latest range brochures and support packs for sales conversations.</p>
          </article>
          <article className="card">
            <h3>Technical documents</h3>
            <p>Specifications, fitting references, and practical install documentation.</p>
          </article>
          <article className="card">
            <h3>Price resources</h3>
            <p>Current pricing support material for accurate, fast quoting.</p>
          </article>
        </div>
        <div className="marketing-hero-actions">
          <a href="/login" className="btn">Go to login</a>
          <a href="/create-account" className="btn btn-outline">Open an account</a>
        </div>
      </section>
    </Wrapper>
  )
}

export function MarketingDepotsPage() {
  return (
    <Wrapper>
      <section className="marketing-hero card">
        <div className="marketing-hero-copy">
          <h1>Contact</h1>
          <p>
            Lamtek Ltd — head office and manufacturing in Nottinghamshire. For collections, phone the main switchboard;
            check opening and loading hours before you travel.
          </p>
          <p>
            <strong>Address</strong>
            <br />
            Lamtek Ltd
            <br />
            Wolsey Drive
            <br />
            Kirkby-in-Ashfield
            <br />
            Nottinghamshire NG17 7JR
          </p>
          <p>
            <strong>Phone</strong> <a href="tel:01623759856">01623 759 856</a>
          </p>
          <p>
            <strong>Opening hours</strong> Mon–Fri 7:15–16:30
            <br />
            <strong>Loading hours</strong> Mon–Thu 7:15–15:45 · Fri 7:15–12:45
          </p>
          <p>
            <a href="https://www.lamtek.co.uk/contact" className="admin-link" target="_blank" rel="noreferrer">
              Contact form (lamtek.co.uk)
            </a>
          </p>
        </div>
        <div className="marketing-hero-panel">
          <h2>Quick links</h2>
          <ul>
            <li><Link to="/site/depots-details">Lamtek Complete (trade kitchens)</Link></li>
            <li><Link to="/create-account">Open an account</Link></li>
            <li><Link to="/login">Customer login</Link></li>
          </ul>
        </div>
      </section>
    </Wrapper>
  )
}

export function MarketingManufacturingPage() {
  return (
    <Wrapper>
      <section className="marketing-hero marketing-hero--image card">
        <div className="marketing-hero-copy">
          <p className="marketing-kicker">Manufacturing</p>
          <h1>Advanced manufacturing footprint</h1>
          <p className="marketing-lead">
            Supporting UK and international trade demand through large-scale carcass production, ongoing investment, and
            practical availability. Our Nottinghamshire plants are set up for consistent output, quality control, and the
            throughput you need when programmes are busy.
          </p>
        </div>
        <div className="marketing-hero-media">
          <img
            src="/marketing/manufacturing-factory.png"
            alt="Factory floor with stacked panels and production equipment"
            loading="eager"
            className="marketing-hero-photo"
          />
        </div>
      </section>
      <section className="card marketing-prose-block">
        <h2>125,000 sq ft across three plants</h2>
        <p>
          Our Nottinghamshire footprint supports high-volume production of flat-pack kitchen and bedroom carcasses — over
          10,000 cabinets a week — with ongoing investment in plant, people, and sustainability (including FSC® certified
          board and on-site use of wood waste for factory heat).
        </p>
        <p>
          From panel processing to finishing and dispatch, manufacturing and logistics work as one system so trade
          customers can plan with confidence.
        </p>
      </section>
      <section className="marketing-split card">
        <div className="marketing-split-media">
          <img src="/marketing/warehouse-boards.png" alt="Warehouse aisle with panel stock" loading="lazy" />
        </div>
        <div className="marketing-split-copy">
          <h2>Stock, lead times, and trade support</h2>
          <p>
            Depth of manufacturing and warehousing supports trade demand across the UK and overseas. Loading and
            collection are subject to published hours — check the contact page before you visit.
          </p>
          <p>
            <Link to="/site/about" className="admin-link">
              Our story &amp; responsibility
            </Link>
          </p>
        </div>
      </section>
      <section className="card">
        <h2>At a glance</h2>
        <ul className="marketing-bullet-list">
          <li>125,000 sq ft across three state-of-the-art plants (Nottinghamshire)</li>
          <li>10,000+ cabinets produced weekly; Rapid Cab flat-pack assembly system</li>
          <li>UK-manufactured melamine-faced chipboard; FSC® certified</li>
          <li>Trade-only supply to distributors, merchants, developers, and retailers</li>
        </ul>
      </section>
    </Wrapper>
  )
}

export function MarketingDepotsDetailPage() {
  return (
    <Wrapper>
      <section className="marketing-hero card">
        <div className="marketing-hero-copy">
          <h1>Lamtek Complete — trade kitchens</h1>
          <p>
            Complete kitchen, bedroom, and living-space solutions built in Nottinghamshire for the trade — with curated
            styles, dependable delivery, and a helpful team. Company name on record: Laminating Technology Ltd (same
            group as Lamtek).
          </p>
        </div>
      </section>
      <section className="marketing-grid">
        <article className="card">
          <h2>Lamtek Ltd (carcasses &amp; components)</h2>
          <p>Call: <a href="tel:01623759856">01623 759 856</a></p>
          <p>
            Lamtek Ltd, Wolsey Drive, Kirkby-in-Ashfield, Nottinghamshire NG17 7JR
          </p>
          <p>
            <a href="https://www.lamtek.co.uk/contact" target="_blank" rel="noreferrer">
              lamtek.co.uk/contact
            </a>
          </p>
          <p>
            <a href="mailto:info@lamtek.co.uk?subject=Lamtek%20enquiry">info@lamtek.co.uk</a>
          </p>
        </article>
        <article className="card">
          <h2>Lamtek Complete (doors &amp; complete kitchens to trade)</h2>
          <p>Call: <a href="tel:01543466454">01543 466454</a></p>
          <p>Laminating Technology Ltd, Wolsey Drive, Kirkby-in-Ashfield, Nottinghamshire NG17 7JR</p>
          <p>
            <a href="https://lamtekcomplete.co.uk/" target="_blank" rel="noreferrer">
              lamtekcomplete.co.uk
            </a>
          </p>
          <p>
            <a href="mailto:info@lamtekcomplete.co.uk?subject=Lamtek%20Complete%20enquiry">info@lamtekcomplete.co.uk</a>
          </p>
        </article>
        <article className="card">
          <h2>Portal support</h2>
          <p>For this ordering portal, contact your account team or use the email you were given at onboarding.</p>
          <p>
            <a href="mailto:info@lamtek.co.uk?subject=Trade%20portal%20enquiry">info@lamtek.co.uk</a>
          </p>
        </article>
      </section>
    </Wrapper>
  )
}
