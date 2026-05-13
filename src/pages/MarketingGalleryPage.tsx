import { Link } from 'react-router-dom'
import MarketingHeader from '@/components/MarketingHeader'
import MarketingHeroBackdrop from '@/components/marketing/MarketingHeroBackdrop'
import MarketingHeroExtraCard from '@/components/marketing/MarketingHeroExtraCard'

/** Gallery imagery from lamtek.co.uk/gallery (Wix CDN). */
const GALLERY_IMAGES: { src: string; alt: string }[] = [
  {
    src: 'https://static.wixstatic.com/media/478c83_9e424e4229974a15b39b64a092bea9bb~mv2.jpg/v1/fill/w_480,h_360,q_90,enc_avif,quality_auto/478c83_9e424e4229974a15b39b64a092bea9bb~mv2.jpg',
    alt: 'Lamtek kitchen installation',
  },
  {
    src: 'https://static.wixstatic.com/media/478c83_d6dd5d12cbb84e15b742f76013c9a955~mv2.jpg/v1/fill/w_480,h_360,q_90,enc_avif,quality_auto/478c83_d6dd5d12cbb84e15b742f76013c9a955~mv2.jpg',
    alt: 'Lamtek cabinetry',
  },
  {
    src: 'https://static.wixstatic.com/media/478c83_9e46696246d34fe6a8210b263ae179d1~mv2.jpg/v1/fill/w_480,h_480,q_90,enc_avif,quality_auto/478c83_9e46696246d34fe6a8210b263ae179d1~mv2.jpg',
    alt: 'Lamtek project',
  },
  {
    src: 'https://static.wixstatic.com/media/478c83_adb63928674b41079210aa7c74214103~mv2.jpg/v1/fill/w_480,h_320,q_90,enc_avif,quality_auto/478c83_adb63928674b41079210aa7c74214103~mv2.jpg',
    alt: 'Lamtek manufacturing and quality',
  },
  {
    src: 'https://static.wixstatic.com/media/20b84f_8b3b5b4e0c324f91818c17b57a1928f4~mv2.jpg/v1/fill/w_480,h_320,q_90,enc_avif,quality_auto/20b84f_8b3b5b4e0c324f91818c17b57a1928f4~mv2.jpg',
    alt: 'Lamtek interior',
  },
  {
    src: 'https://static.wixstatic.com/media/478c83_01395c127eee413093b678fd9dbed76a~mv2.jpg/v1/fill/w_480,h_480,q_90,enc_avif,quality_auto/478c83_01395c127eee413093b678fd9dbed76a~mv2.jpg',
    alt: 'Lamtek fitted furniture',
  },
  {
    src: 'https://static.wixstatic.com/media/478c83_ae4e0a2129dc439284526326a9763fd2~mv2.jpg/v1/fill/w_480,h_480,q_90,enc_avif,quality_auto/478c83_ae4e0a2129dc439284526326a9763fd2~mv2.jpg',
    alt: 'Lamtek kitchen range',
  },
  {
    src: 'https://static.wixstatic.com/media/478c83_a02eaf9bccdd4765b9b68b2cc0de0c9f~mv2.jpg/v1/fill/w_480,h_320,q_90,enc_avif,quality_auto/478c83_a02eaf9bccdd4765b9b68b2cc0de0c9f~mv2.jpg',
    alt: 'Lamtek bedroom or kitchen',
  },
  {
    src: 'https://static.wixstatic.com/media/20b84f_b9fef7f4313c496b92c0ae3f71c5a79b~mv2.jpg/v1/fill/w_480,h_480,q_90,enc_avif,quality_auto/20b84f_b9fef7f4313c496b92c0ae3f71c5a79b~mv2.jpg',
    alt: 'Lamtek complete look',
  },
  {
    src: 'https://static.wixstatic.com/media/478c83_53da00a486a8451d8915b87fad187442f003.jpg/v1/fill/w_480,h_272,q_90,enc_avif,quality_auto/478c83_53da00a486a8451d8915b87fad187442f003.jpg',
    alt: 'Lamtek project photography',
  },
  {
    src: 'https://static.wixstatic.com/media/478c83_272453d943ba4dce8fc92c2080a3e247~mv2.jpg/v1/fill/w_480,h_320,q_90,enc_avif,quality_auto/478c83_272453d943ba4dce8fc92c2080a3e247~mv2.jpg',
    alt: 'Lamtek installation',
  },
  {
    src: 'https://static.wixstatic.com/media/20b84f_44b683cfb64d4a1c8f413d1beede88f9~mv2.jpg/v1/fill/w_480,h_480,q_90,enc_avif,quality_auto/20b84f_44b683cfb64d4a1c8f413d1beede88f9~mv2.jpg',
    alt: 'Lamtek kitchen styling',
  },
]

export default function MarketingGalleryPage() {
  return (
    <div className="marketing-site">
      <MarketingHeader />
      <main className="marketing-main marketing-main--wide">
        <section className="marketing-hero card">
          <MarketingHeroBackdrop variant="split" />
          <div className="marketing-hero-copy">
            <p className="marketing-kicker">Inspiration</p>
            <h1>Gallery</h1>
            <p>
              A selection of project photography from our marketing gallery. For full door ranges and complete-kitchen
              styles, also see{' '}
              <a href="https://lamtekcomplete.co.uk/our-kitchens/" target="_blank" rel="noreferrer">
                Lamtek Complete — our kitchens
              </a>
              .
            </p>
            <p className="marketing-muted">
              Source:{' '}
              <a href="https://www.lamtek.co.uk/gallery" target="_blank" rel="noreferrer">
                lamtek.co.uk/gallery
              </a>
            </p>
            <div className="marketing-hero-actions">
              <Link to="/site/products" className="btn">Popular products</Link>
              <Link to="/login" className="btn btn-outline">Login to browse all</Link>
            </div>
          </div>
          <div className="marketing-hero-rail">
            <div className="marketing-hero-panel">
              <h2>Gallery themes</h2>
              <ul>
                <li>Shaker and modern style inspiration</li>
                <li>Kitchen, bedroom, and living spaces</li>
                <li>Lamtek and Lamtek Complete applications</li>
              </ul>
            </div>
            <MarketingHeroExtraCard
              title="How to use these shots"
              items={[
                'Ideal for showroom conversations, proposals, and mood boards',
                'Full SKU detail and trade pricing still live in your account catalogue',
                'Door ranges and finishes: browse Lamtek Complete online for current styles',
              ]}
              footer={
                <Link to="/site/products" className="marketing-hero-extra-link">
                  Product overview →
                </Link>
              }
            />
          </div>
        </section>

        <section className="marketing-gallery-banner card">
          <div>
            <h2>Designed to inspire your showroom pipeline</h2>
            <p>
              Use these visuals in sales conversations, then move into account login for full catalogue data and trade prices.
            </p>
          </div>
          <div className="marketing-gallery-banner-icon" aria-hidden>
            <svg viewBox="0 0 56 56">
              <rect x="8" y="10" width="40" height="30" rx="4" />
              <path d="M14 33l9-9 7 6 8-8 4 4" />
              <circle cx="19" cy="20" r="3" />
            </svg>
          </div>
        </section>
        <section className="marketing-gallery-grid" aria-label="Project gallery">
          {GALLERY_IMAGES.map((img) => (
            <figure key={img.src} className="marketing-gallery-item card">
              <img src={img.src} alt={img.alt} loading="lazy" className="marketing-gallery-img" />
            </figure>
          ))}
        </section>
        <section className="card marketing-prose-block">
          <h2>Trade account</h2>
          <p>
            Lamtek is a trade-only supplier. Request access through the main site or use this portal to open an account and
            place orders.
          </p>
          <div className="marketing-hero-actions">
            <a href="https://www.lamtek.co.uk/contact" className="btn btn-outline" target="_blank" rel="noreferrer">
              Contact (lamtek.co.uk)
            </a>
            <Link to="/create-account" className="btn">
              Open a portal account
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
