import { publicAsset } from '@/lib/basePath'

const TILES = [
  {
    path: 'marketing/kitchen-navy.png',
    alt: 'Navy and cream fitted kitchen with island',
    caption: 'Kitchen carcasses',
  },
  {
    path: 'marketing/warehouse-boards.png',
    alt: 'Warehouse aisle with melamine-faced chipboard stock',
    caption: 'UK panel stock',
  },
  {
    path: 'marketing/manufacturing-factory.png',
    alt: 'Factory floor with stacked panels and machinery',
    caption: 'Nottinghamshire plants',
  },
] as const

export default function MarketingVisualMosaic() {
  return (
    <section className="marketing-visual-mosaic card" aria-labelledby="marketing-mosaic-heading">
      <div className="marketing-visual-mosaic-head">
        <h2 id="marketing-mosaic-heading">Trade kitchens &amp; manufacturing</h2>
        <p className="marketing-visual-mosaic-intro">
          A quick visual snapshot of Lamtek scale — explore products, gallery, and manufacturing pages for more photography.
        </p>
      </div>
      <div className="marketing-visual-mosaic-grid">
        {TILES.map((t) => (
          <figure key={t.path} className="marketing-visual-mosaic-tile">
            <div className="marketing-visual-mosaic-img-wrap">
              <img src={publicAsset(t.path)} alt={t.alt} loading="lazy" decoding="async" />
            </div>
            <figcaption>{t.caption}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
