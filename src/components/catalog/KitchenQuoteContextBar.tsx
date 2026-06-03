import { carcassFinishLabel } from '@/lib/orderRangeFinish'
import {
  hingeBrandLabel,
  isTealburyCatalogueChoice,
  type TealburyOrderSetup,
} from '@/lib/tealburyOrderSetup'
import type { CategoryRow } from '@/types/database'

type Props = {
  setup: TealburyOrderSetup
  categories: CategoryRow[]
  onEditSetup: () => void
  variant?: 'customer' | 'admin'
  docLabel?: string
}

export default function KitchenQuoteContextBar({
  setup,
  categories,
  onEditSetup,
  variant = 'customer',
  docLabel = 'order',
}: Props) {
  const rangeName = categories.find((c) => c.id === setup.kitchen_range_id)?.name ?? 'Range'
  const isTealbury = isTealburyCatalogueChoice(setup.catalogue_choice)

  if (!isTealbury) {
    return (
      <div className="kq-build-context kq-build-context--sticky">
        <div className="kq-build-context-chips">
          <span className="kq-build-chip">Lamtek components</span>
        </div>
        <button type="button" className="btn btn-outline btn-small" onClick={onEditSetup}>
          Change catalogue
        </button>
      </div>
    )
  }

  return (
    <div className={`kq-build-context kq-build-context--sticky${variant === 'customer' ? ' kq-build-context--customer' : ''}`}>
      <div className="kq-build-context-main">
        <p className="kq-build-context-label">
          Building this {docLabel} for
        </p>
        <div className="kq-build-context-chips">
          <span className="kq-build-chip kq-build-chip--primary">Tealbury Complete</span>
          <span className="kq-build-chip">
            {setup.build_style === 'flat_pack' ? 'Flat pack' : 'Rigid'}
          </span>
          <span className="kq-build-chip">{rangeName}</span>
          <span className="kq-build-chip">{setup.door_finish}</span>
          <span className="kq-build-chip">{carcassFinishLabel(setup.carcass_finish)}</span>
          <span className="kq-build-chip">
            {setup.line_style_preference?.replace(/_/g, ' ') ?? '—'}
          </span>
          <span className="kq-build-chip">{hingeBrandLabel(setup.hinge_brand) ?? '—'}</span>
        </div>
      </div>
      <button type="button" className="btn btn-outline btn-small" onClick={onEditSetup}>
        Change kitchen setup
      </button>
    </div>
  )
}
