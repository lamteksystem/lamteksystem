import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PageNav } from '@/components/PageNav'

type HelpSection = {
  id: string
  title: string
  intro: string
  steps: string[]
}

const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'quick-start',
    title: 'Quick start',
    intro:
      'This portal helps you browse products, manage draft orders (baskets), build quotes and orders, track statements, and contact our team for returns or issues.',
    steps: [
      'Use the top search bar to quickly find a product, order reference, download, or support ticket.',
      'Go to Products to browse the Lamtek component catalogue, or Tealbury kitchens for the Tealbury programme only.',
      'Choose Create order, then Manual order or Guided order — or open Tealbury kitchens from the sidebar.',
      'Use Order baskets when you need more than one draft job; pick which basket is active before opening Cart.',
      'Use Cart to review lines and totals (your account pricing applies here) before you save or submit.',
      'Check Downloads for brochures, technical data, and pricelists.',
      'Use Support to raise a ticket (question, issue, or returns). You can upload files on ticket replies.',
    ],
  },
  {
    id: 'baskets',
    title: 'Order baskets (multiple drafts)',
    intro:
      'Draft orders are saved on your account — not only in your browser. Use Order baskets when you are working on more than one job at a time.',
    steps: [
      'Open Order baskets from the sidebar.',
      'You will see your draft orders (baskets). Choose which one is active — that is the basket Cart uses.',
      'Rename or create baskets if your build offers those actions (useful for “Kitchen A” vs “Extras B”).',
      'Open Cart only after confirming the active basket, so lines do not mix between jobs.',
      'If totals look wrong, check you did not switch active basket without noticing.',
    ],
  },
  {
    id: 'ordering',
    title: 'Ordering flow',
    intro:
      'Ordering is step-by-step: pick how you want to shop, add lines, then review and submit from Cart.',
    steps: [
      'Go to Create order from the top navigation (or use Tealbury kitchens for programme-only shopping).',
      'At Create order, pick Manual order (browse freely) or Guided order (step-by-step prompts).',
      'Set date or range inputs when prompted (guided flow).',
      'Add items from the product picker; quantities and options are saved on your active draft.',
      'Open Cart to confirm quantities, delivery or collection, contact details, and totals.',
      'Save to keep working later, or submit when ready. Status moves through Draft → Quotation → Placed → Invoiced → Paid as we process it.',
    ],
  },
  {
    id: 'tealbury',
    title: 'Tealbury kitchens',
    intro:
      'Tealbury is a separate kitchen programme from the main Lamtek component catalogue. Use the dedicated area so you only see Tealbury lines.',
    steps: [
      'Open Tealbury kitchens from the sidebar (not Products).',
      'Browse and add packaged kitchen lines to your active basket the same way as other ordering.',
      'SKUs may include the door range in the code — search using the code shown on screen if you have an older spreadsheet.',
      'If the list is empty, contact us via Support — staff may still be importing the latest workbook.',
    ],
  },
  {
    id: 'pricing',
    title: 'Your prices',
    intro:
      'Prices can depend on your account (trade segment, promotions, and any account discount). The cart is the source of truth before you submit.',
    steps: [
      'Open My account — if an account pricing discount is set, it is shown there (applied after our standard pricing rules).',
      'Product browse pages may show list prices; open Cart to see repriced line totals for your account.',
      'After we change your pricing, refresh Cart or save the basket again so lines update.',
      'Quotes and orders you have already submitted keep the prices frozen on each line.',
      'For price queries on a new job, use Support with the SKU and quantity you need.',
    ],
  },
  {
    id: 'support',
    title: 'Support tickets (returns, issues, questions)',
    intro:
      'If something is wrong or you need help, create a ticket. Our team will respond and update the ticket with next steps.',
    steps: [
      'Open Support from the top navigation or the Account quick actions.',
      'Choose the ticket type: Question, Issue, or Return.',
      'If relevant, select an Order so you can reference the correct items.',
      'For returns, select the order lines you want to return.',
      'Write a clear subject and message body.',
      'Send the ticket. To attach files, use the upload control in the ticket Reply area.',
      'When we approve/reject return lines, your ticket status will update automatically when all lines are decided.',
    ],
  },
  {
    id: 'statements',
    title: 'Statements & account transactions',
    intro:
      'Your My account page shows your statement balance and recent transaction lines.',
    steps: [
      'Open My account from the top navigation.',
      'Review Statement balance to see your current outstanding balance.',
      'Use Order history to see your recent quotes and orders.',
      'Use Recent statement lines to view the most recent transactions.',
      'If you need a full statement export, contact our team via Support.',
    ],
  },
]

function Section({ s }: { s: HelpSection }) {
  return (
    <section className="help-section" aria-labelledby={`help-${s.id}`}>
      <h2 id={`help-${s.id}`}>{s.title}</h2>
      <p className="help-intro">{s.intro}</p>
      <details>
        <summary>Step-by-step walkthrough</summary>
        <ol>
          {s.steps.map((step, idx) => (
            <li key={idx}>{step}</li>
          ))}
        </ol>
      </details>
    </section>
  )
}

export default function Help() {
  const faqItems = useMemo(() => ([
    {
      q: 'What can I search for using the header search?',
      a: 'You can search products (name/SKU/description), your orders (reference and related fields), downloads (title/description), and your support tickets (subject/type/status).',
    },
    {
      q: 'What is the difference between Products and Tealbury kitchens?',
      a: 'Products is the Lamtek component catalogue. Tealbury kitchens shows only Tealbury programme lines — use it when ordering that range.',
    },
    {
      q: 'Why do I have Order baskets and Cart?',
      a: 'Order baskets lists all your draft jobs. Cart is for the one active draft — switch the active basket before editing lines so jobs do not mix.',
    },
    {
      q: 'Why does my order show different statuses?',
      a: 'Statuses reflect the order lifecycle: Draft (basket), Quotation (quote), Placed (in progress), then Invoiced and Paid. If staff need more detail, use Support.',
    },
    {
      q: 'Why is the price on the product page different from Cart?',
      a: 'Browse pages may show list prices. Cart applies your account pricing rules and any account discount. Use Cart totals before you submit.',
    },
    {
      q: 'How do returns work in this system?',
      a: 'When you create a Return ticket, you can select which order lines you want to return. Staff then approve or reject each return line. Once all lines have a resolution, the ticket is automatically marked resolved.',
    },
    {
      q: 'Can I attach files to a ticket?',
      a: 'Yes. In a ticket detail page, use the attachments control in the Reply area. Uploaded files are stored with the ticket and can be viewed by staff.',
    },
    {
      q: 'Where are my downloads available?',
      a: 'Open Downloads from the top navigation. Documents are grouped into categories such as brochures and technical data.',
    },
    {
      q: 'I need help—what should I do first?',
      a: 'Start with the Quick start section above. If your question is specific, use Support and choose the most appropriate ticket type.',
    },
  ]), [])

  return (
    <div className="help-page">
      <PageNav breadcrumb={[{ to: '/account', label: 'My account' }, { label: 'Help' }]} />
      <div className="help-header">
        <h1>Help & FAQs</h1>
        <p className="page-intro">
          Step-by-step guides for ordering, baskets, Tealbury, pricing, downloads, statements, and support. Updated May 2026. If you get stuck, go to{' '}
          <Link to="/account/support">Support</Link>.
        </p>
      </div>

      <div className="help-grid">
        {HELP_SECTIONS.map((s) => (
          <Section key={s.id} s={s} />
        ))}

        <section className="help-section" aria-labelledby="menu-reference">
          <h2 id="menu-reference">Menu reference (what each area does)</h2>
          <p className="help-intro">
            Use this as a quick glossary when onboarding new users.
          </p>
          <ul className="admin-report-list">
            <li className="admin-report-list-item">
              <span className="admin-report-list-label">Dashboard</span>
              <span className="admin-report-list-value">Overview of account status, quick links, and high-level activity.</span>
            </li>
            <li className="admin-report-list-item">
              <span className="admin-report-list-label">Products</span>
              <span className="admin-report-list-value">Browse Lamtek component catalogue items and add lines to your active draft.</span>
            </li>
            <li className="admin-report-list-item">
              <span className="admin-report-list-label">Tealbury kitchens</span>
              <span className="admin-report-list-value">Browse and order Tealbury programme lines only.</span>
            </li>
            <li className="admin-report-list-item">
              <span className="admin-report-list-label">Create order</span>
              <span className="admin-report-list-value">Start manual or guided ordering; choose how you build a draft quote/order.</span>
            </li>
            <li className="admin-report-list-item">
              <span className="admin-report-list-label">Order baskets</span>
              <span className="admin-report-list-value">Manage multiple draft orders and choose which basket is active.</span>
            </li>
            <li className="admin-report-list-item">
              <span className="admin-report-list-label">Cart</span>
              <span className="admin-report-list-value">Review quantities, account-priced totals, delivery/collection, and submit.</span>
            </li>
            <li className="admin-report-list-item">
              <span className="admin-report-list-label">Downloads</span>
              <span className="admin-report-list-value">Brochures, technical guides, and other document assets.</span>
            </li>
            <li className="admin-report-list-item">
              <span className="admin-report-list-label">Support</span>
              <span className="admin-report-list-value">Create and track question/issue/return tickets with threaded replies.</span>
            </li>
            <li className="admin-report-list-item">
              <span className="admin-report-list-label">My account</span>
              <span className="admin-report-list-value">Profile, pricing note (if set), recent orders, statement snapshot.</span>
            </li>
            <li className="admin-report-list-item">
              <span className="admin-report-list-label">Search (header bar)</span>
              <span className="admin-report-list-value">Global search across products, orders, downloads, and support records.</span>
            </li>
          </ul>
        </section>

        <section className="help-section" aria-labelledby="troubleshooting">
          <h2 id="troubleshooting">Troubleshooting checklist</h2>
          <p className="help-intro">
            If something does not behave as expected, try this sequence before contacting support.
          </p>
          <details>
            <summary>Step-by-step troubleshooting flow</summary>
            <ol>
              <li>Refresh the page and retry the action once.</li>
              <li>Confirm you are signed in to the correct account.</li>
              <li>On ordering issues, open Order baskets and confirm the expected draft is active.</li>
              <li>Check that required fields are filled in (delivery address, ticket subject, etc.).</li>
              <li>For pricing, open Cart — browse list prices may differ from your account totals.</li>
              <li>If a result looks wrong, use the global search to verify the product or order exists.</li>
              <li>If the issue persists, raise a Support ticket with exact steps and a screenshot if possible.</li>
            </ol>
          </details>
        </section>

        <section className="help-section" aria-labelledby="faq">
          <h2 id="faq">FAQ</h2>
          <p className="help-intro">
            Short answers to common questions. For detailed steps, open the step-by-step walkthrough blocks above.
          </p>
          <div className="help-faq">
            {faqItems.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p className="help-answer">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
