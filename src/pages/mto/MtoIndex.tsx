import { Link } from 'react-router-dom'
import {
  DoorFramed,
  DoorAngled,
  DoorNonStandard,
  PanelRect,
  RoundTop,
  CornerAngledTop,
  ProfiledPanel,
} from '@/components/mto/MtoShapeDiagrams'

const MTM_CATEGORIES = [
  {
    to: '/ordering/mto/non-standard',
    title: 'Non standard',
    description: 'Doors and drawers in custom sizes. Enter height × width and hinge options.',
    diagram: (
      <div className="mtm-landing-diagrams mtm-landing-diagrams--two">
        <DoorNonStandard variant="door" />
        <DoorNonStandard variant="drawer" />
      </div>
    ),
  },
  {
    to: '/ordering/mto/angled',
    title: 'MTM Angled',
    description: 'Doors with angled or stepped corners. Choose shape then dimensions.',
    diagram: (
      <div className="mtm-landing-diagrams mtm-landing-diagrams--angled">
        {(['top-right', 'top-left', 'both-top', 'top-right-step', 'top-left-step'] as const).map((id) => (
          <DoorAngled key={id} type={id} width={56} height={56} />
        ))}
      </div>
    ),
  },
  {
    to: '/ordering/mto/framed',
    title: 'MTM Framed',
    description: 'Framed feature doors in any size. Drill positions and hinge side.',
    diagram: <DoorFramed width={100} height={100} />,
  },
  {
    to: '/ordering/mto/worktops-panels',
    title: 'MTM Worktops & Panels',
    description: 'Panels, round tops, corner angled tops, and profiled edges.',
    diagram: (
      <div className="mtm-landing-diagrams mtm-landing-diagrams--four">
        <PanelRect width={60} height={60} />
        <RoundTop width={60} height={60} />
        <CornerAngledTop width={60} height={60} />
        <ProfiledPanel width={60} height={60} />
      </div>
    ),
  },
]

export default function MtoIndex() {
  return (
    <div className="mto-index">
      <div className="mto-index-intro">
        <h1 className="mto-index-title">Made to measure</h1>
        <p className="mto-index-desc">
          Choose the type of item you need. Each option opens a configurator with diagrams and dimensions. Add items to your cart and review in the order flow.
        </p>
      </div>
      <div className="mto-index-grid">
        {MTM_CATEGORIES.map(({ to, title, description, diagram }) => (
          <Link key={to} to={to} className="mto-index-card card">
            <div className="mto-index-card-diagram">{diagram}</div>
            <h2 className="mto-index-card-title">{title}</h2>
            <p className="mto-index-card-desc">{description}</p>
            <span className="mto-index-card-cta">Configure →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
