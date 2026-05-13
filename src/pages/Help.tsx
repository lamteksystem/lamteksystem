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
      'This portal helps you browse products, build an order, track statements, and contact our team for returns or issues.',
    steps: [
      'Use the top search bar to quickly find a product, order reference, download, or support ticket.',
      'Go to `Products` to browse the catalogue and open product details.',
      'Choose `Create Order`, pick `Manual order` or `Guided Order`, then build your quote/order.',
      'Use `Cart` to review your lines and totals before submitting.',
      'Check `Downloads` for brochures, technical data, and pricelists.',
      'Use `Support` to raise a ticket (question, issue, or returns). You can upload files on ticket replies.',
    ],
  },
  {
    id: 'ordering',
    title: 'Ordering flow',
    intro:
      'Ordering is designed to be step-by-step so you can build exactly what you need and avoid missing details.',
    steps: [
      'Go to `Create Order` from the top navigation.',
      'At `Create order`, pick `Manual order` (browse freely) or `Guided Order` (step-by-step).',
      'Set your date/range inputs as prompted.',
      'Add your items using the product picker.',
      'Review the cart to confirm quantities, options, and totals.',
      'Submit the order. After submission you will see it move through statuses (Draft → Quotation → Placed → Invoiced → Paid).',
    ],
  },
  {
    id: 'support',
    title: 'Support tickets (returns, issues, questions)',
    intro:
      'If something is wrong or you need help, create a ticket. Our team will respond and update the ticket with next steps.',
    steps: [
      'Open `Support` from the top navigation or the Account quick actions.',
      'Choose the ticket type: `Question`, `Issue`, or `Return`.',
      'If relevant, select an `Order` so you can reference the correct items.',
      'For returns, select the order lines you want to return.',
      'Write a clear subject and message body.',
      'Send the ticket. To attach files, use the upload control in the ticket `Reply` area.',
      'When we approve/reject return lines, your ticket status will update automatically when all lines are decided.',
    ],
  },
  {
    id: 'statements',
    title: 'Statements & account transactions',
    intro:
      'Your `My account` page shows your statement balance and recent transaction lines.',
    steps: [
      'Open `My account` from the top navigation.',
      'Review `Statement balance` to see your current outstanding balance.',
      'Use `Order history` to see your recent quotes/orders.',
      'Use `Recent statement lines` to view the most recent transactions.',
      'If you need a full statement export, contact our team via `Support`.',
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
        <p className="help-muted" style={{ marginTop: '0.75rem' }}>
          Screenshot placeholders (coming next): this section will include visual examples of what you should click and what you should see.
        </p>
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
      q: 'Why does my order show different statuses?',
      a: 'Statuses reflect the order lifecycle. They progress from drafting/quotation to placing, invoicing, and payment. If staff need additional info, a ticket can be used to coordinate changes.',
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
      a: 'Open `Downloads` from the top navigation. Documents are grouped into categories such as brochures and technical data.',
    },
    {
      q: 'I need help—what should I do first?',
      a: 'Start with the “Quick start” section above. If your question is specific, use `Support` and choose the most appropriate ticket type.',
    },
  ]), [])

  return (
    <div className="help-page">
      <PageNav breadcrumb={[{ to: '/account', label: 'My account' }, { label: 'Help' }]} />
      <div className="help-header">
        <h1>Help & FAQs</h1>
        <p className="page-intro">
          Step-by-step guides for ordering, downloads, statements, and support tickets. If you get stuck, go to{' '}
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
              <span className="admin-report-list-value">Browse available items, view details, and add lines to draft order.</span>
            </li>
            <li className="admin-report-list-item">
              <span className="admin-report-list-label">Create order</span>
              <span className="admin-report-list-value">Build a draft order/quote from products and configured pricing rules.</span>
            </li>
            <li className="admin-report-list-item">
              <span className="admin-report-list-label">Cart</span>
              <span className="admin-report-list-value">Review quantities, totals, and submit as quotation or placed order.</span>
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
              <span className="admin-report-list-value">Profile details, recent orders, statement snapshot, preferences.</span>
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
              <li>Confirm you are in the correct account/user context.</li>
              <li>Check that required fields are filled in (order reference, ticket subject/body, etc.).</li>
              <li>If a result looks wrong, use the global search page to verify data exists.</li>
              <li>If issue persists, raise a Support ticket with exact steps and any screenshot.</li>
            </ol>
          </details>
        </section>

        <section className="help-section" aria-labelledby="faq">
          <h2 id="faq">FAQ</h2>
          <p className="help-intro">
            Short answers to common questions. For detailed steps, open the “Step-by-step walkthrough” blocks above.
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

