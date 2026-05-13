import { Link } from 'react-router-dom'
import MarketingHeader from '@/components/MarketingHeader'
import MarketingHeroBackdrop from '@/components/marketing/MarketingHeroBackdrop'
import MarketingHeroExtraCard from '@/components/marketing/MarketingHeroExtraCard'
import { publicAsset } from '@/lib/basePath'

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
        <MarketingHeroBackdrop variant="split" />
        <div className="marketing-hero-copy">
          <h1>Online ordering for trade</h1>
          <p>
            Place and manage orders through one portal — with quotes, order tracking, and account tools aligned to
            Lamtek’s trade workflow from Nottinghamshire.
          </p>
          <div className="marketing-hero-actions">
            <Link to="/login" className="btn">Login to start ordering</Link>
            <Link to="/create-account" className="btn btn-outline">Open an account</Link>
          </div>
        </div>
        <div className="marketing-hero-rail">
          <div className="marketing-hero-panel">
            <h2>Ordering flow</h2>
            <ul>
              <li>Select products and quantities</li>
              <li>Save quote or place order</li>
              <li>Track order status and updates</li>
            </ul>
          </div>
          <MarketingHeroExtraCard
            title="Practical notes"
            items={[
              'Check loading hours on Contact before you book a collection',
              'Lamtek Complete: lamtekcomplete.co.uk · Tealbury bespoke: tealbury.co.uk',
              'Account or portal help: use your onboarding contact, or info@lamtek.co.uk',
            ]}
            footer={
              <Link to="/site/depots" className="marketing-hero-extra-link">
                Contact, hours &amp; loading →
              </Link>
            }
          />
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
            <h3>Complete kitchens &amp; living spaces</h3>
            <p>
              <a href="https://lamtekcomplete.co.uk/" target="_blank" rel="noreferrer" className="admin-link">
                Lamtek Complete
              </a>{' '}
              (trade kitchens) and{' '}
              <a href="https://tealbury.co.uk/" target="_blank" rel="noreferrer" className="admin-link">
                Tealbury
              </a>{' '}
              (made-to-order living spaces) — same Lamtek group campus in Nottinghamshire.
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
    { label: 'Tealbury — Bespoke kitchens & living (Lamtek group)', href: 'https://tealbury.co.uk/' },
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
        <MarketingHeroBackdrop variant="split" />
        <div className="marketing-hero-copy">
          <h1>Downloads</h1>
          <p>
            Brochure PDFs, trade literature, and media are published on the Lamtek, Lamtek Complete, and Tealbury sites (all
            Lamtek group). This
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
        <div className="marketing-hero-rail">
          <div className="marketing-hero-panel">
            <h2>Quick links</h2>
            <ul>
              <li>Product and brochure pages</li>
              <li>Lamtek Complete kitchen range overview</li>
              <li>Portal-secured documents (after login)</li>
            </ul>
          </div>
          <MarketingHeroExtraCard
            title="Where files live"
            items={[
              'Public brochures and pages stay on lamtek.co.uk — always the latest issue',
              'Extra imagery, technical PDFs, and account packs unlock after trade login',
              'Style names and finishes for complete kitchens update on the Lamtek Complete hub',
            ]}
            footer={
              <Link to="/login" className="marketing-hero-extra-link">
                Customer login →
              </Link>
            }
          />
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
          <Link to="/login" className="btn">Go to login</Link>
          <Link to="/create-account" className="btn btn-outline">Open an account</Link>
        </div>
      </section>
    </Wrapper>
  )
}

export function MarketingDepotsPage() {
  return (
    <Wrapper>
      <section className="marketing-hero card">
        <MarketingHeroBackdrop variant="split" />
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
        <div className="marketing-hero-rail">
          <div className="marketing-hero-panel">
            <h2>Quick links</h2>
            <ul>
              <li><Link to="/site/lamtek-uk">lamtek.co.uk hub (in this repo)</Link></li>
              <li><Link to="/site/lamtek-complete-uk">lamtekcomplete.co.uk hub (in this repo)</Link></li>
              <li><Link to="/site/tealbury-uk">tealbury.co.uk hub (in this repo)</Link></li>
              <li><Link to="/site/depots-details">Group contact (Lamtek, Complete, Tealbury)</Link></li>
              <li><Link to="/create-account">Open an account</Link></li>
              <li><Link to="/login">Customer login</Link></li>
            </ul>
          </div>
          <MarketingHeroExtraCard
            title="Visit &amp; collections"
            items={[
              'Head office &amp; plants: Kirkby-in-Ashfield, Nottinghamshire',
              'Phone ahead for loading — use published opening and loading hours',
              'Lamtek Complete (trade kitchens) and Tealbury (made-to-order living) share the Lamtek group campus — see Contact detail page',
            ]}
            footer={
              <Link to="/site/depots-details" className="marketing-hero-extra-link">
                Lamtek Complete contact →
              </Link>
            }
          />
        </div>
      </section>
    </Wrapper>
  )
}

export function MarketingManufacturingPage() {
  return (
    <Wrapper>
      <section className="marketing-hero marketing-hero--image card">
        <MarketingHeroBackdrop variant="media" />
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
            src={publicAsset('marketing/manufacturing-factory.png')}
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
          <img src={publicAsset('marketing/warehouse-boards.png')} alt="Warehouse aisle with panel stock" loading="lazy" />
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
        <MarketingHeroBackdrop variant="split" />
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
          <h2>Tealbury (bespoke kitchens &amp; living)</h2>
          <p>Call / email: <a href="mailto:hello@tealbury.co.uk">hello@tealbury.co.uk</a></p>
          <p>Laminating Technology Ltd (Tealbury), Wolsey Drive, Kirkby-in-Ashfield, Nottinghamshire NG17 7JR</p>
          <p>
            <a href="https://tealbury.co.uk/" target="_blank" rel="noreferrer">
              tealbury.co.uk
            </a>
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

/** In-repo mirror of the public lamtek.co.uk proposition (carcasses, components, manufacturing). */
export function MarketingLamtekCoUkHubPage() {
  return (
    <Wrapper>
      <section className="marketing-hero card">
        <MarketingHeroBackdrop variant="split" />
        <div className="marketing-hero-copy">
          <p className="marketing-kicker">lamtek.co.uk</p>
          <h1>Lamtek — kitchen &amp; bedroom carcasses for the trade</h1>
          <p className="marketing-lead">
            British-made melamine-faced chipboard carcasses and components, Rapid Cab assembly, and the scale distributors
            need. This hub summarises what visitors see on the main Lamtek website; use the live site for the latest
            pages, imagery, and forms.
          </p>
          <div className="marketing-hero-actions">
            <a href="https://www.lamtek.co.uk/" className="btn" target="_blank" rel="noreferrer">
              Open lamtek.co.uk
            </a>
            <Link to="/site/depots" className="btn btn-outline">
              Contact &amp; hours
            </Link>
            <Link to="/login" className="btn btn-outline">
              Portal login
            </Link>
          </div>
        </div>
        <div className="marketing-hero-rail">
          <MarketingHeroExtraCard
            title="Head office"
            items={[
              'Lamtek Ltd, Wolsey Drive, Kirkby-in-Ashfield, Nottinghamshire NG17 7JR',
              'Switchboard 01623 759 856 — opening and loading hours on lamtek.co.uk/contact',
            ]}
            footer={
              <a href="https://www.lamtek.co.uk/contact" className="marketing-hero-extra-link" target="_blank" rel="noreferrer">
                Contact form →
              </a>
            }
          />
        </div>
      </section>
      <section className="card marketing-prose-block">
        <h2>What lamtek.co.uk covers</h2>
        <p>
          Product ranges, sustainability and responsibility, factory news, and the main company contact route. After
          approval, trade customers use this portal for live pricing, stock, quotes, and orders.
        </p>
        <p>
          <Link to="/site/products" className="admin-link">
            Products overview in this portal
          </Link>
          {' · '}
          <Link to="/site/manufacturing" className="admin-link">
            Manufacturing footprint
          </Link>
        </p>
      </section>
    </Wrapper>
  )
}

/** In-repo mirror of lamtekcomplete.co.uk — complete kitchens and doors to the trade. */
export function MarketingLamtekCompleteCoUkHubPage() {
  return (
    <Wrapper>
      <section className="marketing-hero card">
        <MarketingHeroBackdrop variant="media" />
        <div className="marketing-hero-copy">
          <p className="marketing-kicker">lamtekcomplete.co.uk</p>
          <h1>Lamtek Complete — trade kitchens &amp; doors</h1>
          <p className="marketing-lead">
            Complete kitchen, bedroom, and living-space programmes for the trade, with curated door ranges and dependable
            delivery. Same Nottinghamshire manufacturing campus as Lamtek Ltd; dedicated Complete sales line and
            literature on the live Complete site.
          </p>
          <div className="marketing-hero-actions">
            <a href="https://lamtekcomplete.co.uk/" className="btn" target="_blank" rel="noreferrer">
              Open lamtekcomplete.co.uk
            </a>
            <Link to="/site/depots-details" className="btn btn-outline">
              Lamtek vs Complete contact
            </Link>
            <Link to="/login" className="btn btn-outline">
              Portal login
            </Link>
          </div>
        </div>
        <div className="marketing-hero-media">
          <img
            src={publicAsset('marketing/warehouse-boards.png')}
            alt="Warehouse and panel stock supporting kitchen programmes"
            loading="lazy"
            className="marketing-hero-photo"
          />
        </div>
      </section>
      <section className="card marketing-prose-block">
        <h2>Trade contact (Complete)</h2>
        <p>
          <strong>Phone:</strong>{' '}
          <a href="tel:01543466454">01543 466454</a>
          <br />
          <strong>Address:</strong> Laminating Technology Ltd, Wolsey Drive, Kirkby-in-Ashfield, Nottinghamshire NG17 7JR
          <br />
          <a href="mailto:info@lamtekcomplete.co.uk?subject=Trade%20enquiry">info@lamtekcomplete.co.uk</a>
        </p>
        <p>
          Use the external site for the latest brochures, door ranges, and programme detail; use this portal once your
          account is live for ordering alongside Lamtek carcass lines.
        </p>
      </section>
    </Wrapper>
  )
}

/** Tealbury — Lamtek group made-to-order kitchens & living spaces (tealbury.co.uk). */
export function MarketingTealburyCoUkHubPage() {
  return (
    <Wrapper>
      <section className="marketing-hero card">
        <MarketingHeroBackdrop variant="split" />
        <div className="marketing-hero-copy">
          <p className="marketing-kicker">tealbury.co.uk</p>
          <h1>Tealbury — beautiful living spaces made to order</h1>
          <p className="marketing-lead">
            Bespoke kitchens, bedrooms, and living-space furniture — stain, colour match, express colours — from the same
            Nottinghamshire manufacturing group as Lamtek and Lamtek Complete. This hub points to the public Tealbury
            site for styles, finishes, and the retailer finder.
          </p>
          <div className="marketing-hero-actions">
            <a href="https://tealbury.co.uk/" className="btn" target="_blank" rel="noreferrer">
              Open tealbury.co.uk
            </a>
            <Link to="/site/depots-details" className="btn btn-outline">
              Group contact details
            </Link>
            <Link to="/ordering/tealbury" className="btn btn-outline">
              Tealbury trade packages
            </Link>
            <Link to="/login" className="btn btn-outline">
              Portal login
            </Link>
          </div>
        </div>
        <div className="marketing-hero-rail">
          <MarketingHeroExtraCard
            title="Tealbury · contact"
            items={[
              'hello@tealbury.co.uk',
              'Laminating Technology Ltd (Tealbury), Wolsey Drive, Kirkby-in-Ashfield, Nottinghamshire NG17 7JR',
            ]}
            footer={
              <a href="mailto:hello@tealbury.co.uk" className="marketing-hero-extra-link">
                Email Tealbury →
              </a>
            }
          />
        </div>
      </section>
      <section className="card marketing-prose-block">
        <h2>Made to order, made in Nottinghamshire</h2>
        <p>
          Tealbury showcases fitted and freestanding ranges with curated door styles (many named after UK places),
          retailer support, and a focus on craftsmanship and sustainability.
        </p>
        <p>
          Trade ordering for Lamtek components and assemblies continues in this portal under your account; curated Tealbury packaged
          kitchens are listed separately under <Link to="/ordering/tealbury">Tealbury kitchens</Link> once you are logged in.
          Brochure-led consumer programmes live primarily on tealbury.co.uk and through retailers.
        </p>
      </section>
    </Wrapper>
  )
}
