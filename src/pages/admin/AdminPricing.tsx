import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type {
  CustomerGroupRow,
  CustomerLocationRow,
  TradeTypeRow,
  CompanyTypeRow,
  CustomerProfileRow,
  CustomerPriceRuleRow,
  CostPriceRuleRow,
  CollectionRow,
  CategoryRow,
  ProductRow,
  SupplierRow,
} from '@/types/database'
import { resolveCustomerPrice, resolveCostPrice, normalizeAccountDiscountPercent } from '@/lib/pricing'

type TabId = 'segments' | 'customer-rules' | 'cost-rules' | 'collections' | 'preview'

export default function AdminPricing() {
  const [tab, setTab] = useState<TabId>('segments')
  const [groups, setGroups] = useState<CustomerGroupRow[]>([])
  const [locations, setLocations] = useState<CustomerLocationRow[]>([])
  const [tradeTypes, setTradeTypes] = useState<TradeTypeRow[]>([])
  const [companyTypes, setCompanyTypes] = useState<CompanyTypeRow[]>([])
  const [customerRules, setCustomerRules] = useState<CustomerPriceRuleRow[]>([])
  const [costRules, setCostRules] = useState<CostPriceRuleRow[]>([])
  const [collections, setCollections] = useState<CollectionRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [customers, setCustomers] = useState<CustomerProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function loadAll() {
    setLoading(true)
    const [
      groupsRes,
      locationsRes,
      tradeRes,
      companyRes,
      customerRulesRes,
      costRulesRes,
      collectionsRes,
      categoriesRes,
      productsRes,
      suppliersRes,
      customersRes,
    ] = await Promise.all([
      supabase.from('customer_groups').select('*').order('sort_order').order('name'),
      supabase.from('customer_locations').select('*').order('sort_order').order('name'),
      supabase.from('trade_types').select('*').order('sort_order').order('name'),
      supabase.from('company_types').select('*').order('sort_order').order('name'),
      supabase.from('customer_price_rules').select('*').order('priority', { ascending: false }).order('name'),
      supabase.from('cost_price_rules').select('*').order('priority', { ascending: false }).order('name'),
      supabase.from('collections').select('*').order('sort_order').order('name'),
      supabase.from('categories').select('*').order('sort_order').order('name'),
      supabase.from('products').select('*').order('name'),
      supabase.from('suppliers').select('*').order('company_name'),
      supabase.from('customer_profiles').select('*').order('company_name'),
    ])
    setGroups((groupsRes.data ?? []) as CustomerGroupRow[])
    setLocations((locationsRes.data ?? []) as CustomerLocationRow[])
    setTradeTypes((tradeRes.data ?? []) as TradeTypeRow[])
    setCompanyTypes((companyRes.data ?? []) as CompanyTypeRow[])
    setCustomerRules((customerRulesRes.data ?? []) as CustomerPriceRuleRow[])
    setCostRules((costRulesRes.data ?? []) as CostPriceRuleRow[])
    setCollections((collectionsRes.data ?? []) as CollectionRow[])
    setCategories((categoriesRes.data ?? []) as CategoryRow[])
    setProducts((productsRes.data ?? []) as ProductRow[])
    setSuppliers((suppliersRes.data ?? []) as SupplierRow[])
    setCustomers((customersRes.data ?? []) as CustomerProfileRow[])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  const tabs: { id: TabId; label: string; title: string }[] = [
    {
      id: 'segments',
      label: 'Segments',
      title: 'Maintain the lists used on each customer record (group, region, trade type, legal structure).',

    },
    {
      id: 'customer-rules',
      label: 'Sell price rules',
      title:
        'Discounts, mark-ups and fixed sell overrides. Rules match customers when every segment field you set on the rule equals that customer’s profile (blank on the rule means “any”).',

    },
    {
      id: 'cost-rules',
      label: 'Cost rules',
      title:
        'How landed cost is derived for margin (fixed cost, % of sell, or markup on catalogue cost). Does not change what the customer pays unless you also use sell rules.',

    },
    {
      id: 'collections',
      label: 'Collections',
      title: 'Product ranges for promotions—reference collection IDs in sell rules or the preview simulator.',

    },
    {
      id: 'preview',
      label: 'Preview',
      title:
        'Dry-run sell price, resolved cost and unit margin for one customer and SKU using current catalogue prices and active rules.',

    },
  ]

  return (
    <div className="admin-page">
      <p className="page-intro">
        Use these tabs to maintain <strong>segment lookups</strong>, <strong>sell-side discounts and promotions</strong>,{' '}
        <strong>cost assumptions for margin</strong>, and to <strong>preview</strong> effective prices.
        Most discounts come from <strong>sell price rules</strong> when a customer’s segment matches.
        You can also set an extra <strong>account discount %</strong> on each customer profile (applied after those rules).
        On <strong>Order detail</strong> you can override per order, auto-apply when adding lines, or use <strong>Apply customer pricing to all lines</strong> (see Settings → Advanced for your default).
      </p>
      <p className="admin-muted" style={{ marginTop: '-0.75rem', marginBottom: '1rem' }}>
        <strong>Where to assign a customer:</strong>{' '}
        <Link to="/admin/customers">Customers</Link> → open the account → under <strong>Profile</strong>, set{' '}
        <em>Pricing segment</em> (group, location, trade type, company type), optional <strong>account discount %</strong>, and{' '}
        <strong>Payment terms</strong> (shown on quotes/invoices).
        Manage the lists of groups/regions/types here under <strong>Segments</strong>; manage percentages and promos under{' '}
        <strong>Sell price rules</strong>.
      </p>
      <div className="admin-pricing-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`admin-pricing-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
            title={t.title}
          >
            {t.label}
          </button>
        ))}
      </div>
      {message && (
        <div className={`admin-message admin-message--${message.type}`} role="alert">
          {message.text}
        </div>
      )}
      {loading ? (
        <div className="admin-loading-state">
          <div className="admin-loading-spinner" aria-hidden />
          <p>Loading…</p>
        </div>
      ) : (
        <>
          {tab === 'segments' && (
            <SegmentsSection
              groups={groups}
              locations={locations}
              tradeTypes={tradeTypes}
              companyTypes={companyTypes}
              onReload={loadAll}
              onMessage={setMessage}
            />
          )}
          {tab === 'customer-rules' && (
            <CustomerRulesSection
              rules={customerRules}
              groups={groups}
              locations={locations}
              tradeTypes={tradeTypes}
              companyTypes={companyTypes}
              categories={categories}
              products={products}
              collections={collections}
              onReload={loadAll}
              onMessage={setMessage}
            />
          )}
          {tab === 'cost-rules' && (
            <CostRulesSection
              rules={costRules}
              suppliers={suppliers}
              categories={categories}
              products={products}
              onReload={loadAll}
              onMessage={setMessage}
            />
          )}
          {tab === 'collections' && (
            <CollectionsSection
              collections={collections}
              onReload={loadAll}
              onMessage={setMessage}
            />
          )}
          {tab === 'preview' && (
            <PricingPreviewSection
              customers={customers}
              products={products}
              categories={categories}
              collections={collections}
            />
          )}
        </>
      )}
    </div>
  )
}

// --- Segments (4 lookup tables) ---
function SegmentsSection({
  groups,
  locations,
  tradeTypes,
  companyTypes,
  onReload,
  onMessage,
}: {
  groups: CustomerGroupRow[]
  locations: CustomerLocationRow[]
  tradeTypes: TradeTypeRow[]
  companyTypes: CompanyTypeRow[]
  onReload: () => void
  onMessage: (m: { type: 'ok' | 'err'; text: string } | null) => void
}) {
  return (
    <div className="admin-pricing-segments">
      <p className="admin-muted" style={{ gridColumn: '1 / -1', marginBottom: '0.25rem' }}>
        Each row is a choice you can assign on a customer profile. Rules in <strong>Sell price rules</strong> reference these values;
        leave a segment blank on the rule to mean “match any customer regardless of that field”.
      </p>
      <SegmentTable
        title="Customer groups"
        subtitle="Pricing tier or channel (e.g. Gold trade, National account). One group per customer."
        rows={groups}
        slugKey="slug"
        onUpdate={onReload}
        onMessage={onMessage}
        table="customer_groups"
      />
      <SegmentTable
        title="Customer locations"
        subtitle="Commercial region or branch label used for regional pricing (not the same as depot stock locations)."
        rows={locations}
        slugKey="slug"
        onUpdate={onReload}
        onMessage={onMessage}
        table="customer_locations"
      />
      <SegmentTable
        title="Trade types"
        subtitle="What they do (e.g. Kitchen fitter, Retailer). Helps target trade-specific discounts."
        rows={tradeTypes}
        slugKey="slug"
        onUpdate={onReload}
        onMessage={onMessage}
        table="trade_types"
      />
      <SegmentTable
        title="Company types"
        subtitle="Legal shape (e.g. Ltd, Sole trader). Optional filter for differentiated pricing."
        rows={companyTypes}
        slugKey="slug"
        onUpdate={onReload}
        onMessage={onMessage}
        table="company_types"
      />
    </div>
  )
}

function SegmentTable({
  title,
  subtitle,
  rows,
  slugKey,
  onUpdate,
  onMessage,
  table,
}: {
  title: string
  subtitle?: string
  rows: { id: string; name: string; slug?: string; code?: string | null; description?: string | null; sort_order: number }[]
  slugKey: string
  onUpdate: () => void
  onMessage: (m: { type: 'ok' | 'err'; text: string } | null) => void
  table: string
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const slugify = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const s = slug.trim() || slugify(name)
    if (!s) return onMessage({ type: 'err', text: 'Slug required' })
    const payload: Record<string, unknown> = { name: name.trim(), [slugKey]: s, sort_order: rows.length }
    if (table === 'customer_locations') payload.code = code.trim() || null
    else payload.description = description.trim() || null
    const { error } = await supabase.from(table).insert(payload)
    if (error) return onMessage({ type: 'err', text: error.message })
    onMessage({ type: 'ok', text: 'Added.' })
    setName('')
    setSlug('')
    setCode('')
    setDescription('')
    setAdding(false)
    onUpdate()
  }

  return (
    <div className="card admin-card admin-segment-card">
      <h3 title={subtitle}>{title}</h3>
      {subtitle ? <p className="admin-muted" style={{ marginTop: '-0.35rem', marginBottom: '0.65rem', fontSize: '0.875rem' }}>{subtitle}</p> : null}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              {table === 'customer_locations' && <th>Code</th>}
              <th>Sort</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td><code>{r.slug ?? String((r as Record<string, unknown>)[slugKey] ?? '')}</code></td>
                {table === 'customer_locations' && <td>{(r as CustomerLocationRow).code ?? '—'}</td>}
                <td>{r.sort_order}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!adding ? (
        <button type="button" className="btn btn-small" onClick={() => setAdding(true)}>Add</button>
      ) : (
        <form onSubmit={handleAdd} className="admin-segment-add-form">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Slug (auto from name)" />
          {table === 'customer_locations' && <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (e.g. NW)" />}
          {table !== 'customer_locations' && <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />}
          <div>
            <button type="submit" className="btn btn-small">Save</button>
            <button type="button" className="btn btn-outline btn-small" onClick={() => { setAdding(false); setName(''); setSlug(''); setCode(''); setDescription(''); }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}

// --- Customer price rules ---
function CustomerRulesSection({
  rules,
  groups,
  locations,
  tradeTypes,
  companyTypes,
  categories,
  products,
  collections,
  onReload,
  onMessage,
}: {
  rules: CustomerPriceRuleRow[]
  groups: CustomerGroupRow[]
  locations: CustomerLocationRow[]
  tradeTypes: TradeTypeRow[]
  companyTypes: CompanyTypeRow[]
  categories: CategoryRow[]
  products: ProductRow[]
  collections: CollectionRow[]
  onReload: () => void
  onMessage: (m: { type: 'ok' | 'err'; text: string } | null) => void
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerPriceRuleRow | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    customer_group_id: '' as string,
    customer_location_id: '' as string,
    trade_type_id: '' as string,
    company_type_id: '' as string,
    scope_type: 'all' as 'all' | 'category' | 'product' | 'collection',
    scope_category_id: '' as string,
    scope_product_id: '' as string,
    scope_collection_id: '' as string,
    rule_type: 'percentage_discount' as 'percentage_discount' | 'percentage_markup' | 'fixed_price_override',
    value: '',
    min_order_total_ex_vat: '',
    valid_from: '',
    valid_to: '',
    priority: '0',
    active: true,
  })
  const [saving, setSaving] = useState(false)

  function openAdd() {
    setEditing(null)
    setForm({
      name: '',
      description: '',
      customer_group_id: '',
      customer_location_id: '',
      trade_type_id: '',
      company_type_id: '',
      scope_type: 'all',
      scope_category_id: '',
      scope_product_id: '',
      scope_collection_id: '',
      rule_type: 'percentage_discount',
      value: '',
      min_order_total_ex_vat: '',
      valid_from: '',
      valid_to: '',
      priority: '0',
      active: true,
    })
    setModalOpen(true)
  }

  function openEdit(r: CustomerPriceRuleRow) {
    setEditing(r)
    setForm({
      name: r.name,
      description: r.description ?? '',
      customer_group_id: r.customer_group_id ?? '',
      customer_location_id: r.customer_location_id ?? '',
      trade_type_id: r.trade_type_id ?? '',
      company_type_id: r.company_type_id ?? '',
      scope_type: r.scope_type,
      scope_category_id: r.scope_category_id ?? '',
      scope_product_id: r.scope_product_id ?? '',
      scope_collection_id: r.scope_collection_id ?? '',
      rule_type: r.rule_type,
      value: String(r.value),
      min_order_total_ex_vat: r.min_order_total_ex_vat != null ? String(r.min_order_total_ex_vat) : '',
      valid_from: r.valid_from ? r.valid_from.slice(0, 16) : '',
      valid_to: r.valid_to ? r.valid_to.slice(0, 16) : '',
      priority: String(r.priority),
      active: r.active,
    })
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      customer_group_id: form.customer_group_id || null,
      customer_location_id: form.customer_location_id || null,
      trade_type_id: form.trade_type_id || null,
      company_type_id: form.company_type_id || null,
      scope_type: form.scope_type,
      scope_category_id: form.scope_type === 'category' ? form.scope_category_id || null : null,
      scope_product_id: form.scope_type === 'product' ? form.scope_product_id || null : null,
      scope_collection_id: form.scope_type === 'collection' ? form.scope_collection_id || null : null,
      rule_type: form.rule_type,
      value: parseFloat(form.value) || 0,
      min_order_total_ex_vat: form.min_order_total_ex_vat ? parseFloat(form.min_order_total_ex_vat) : null,
      valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : null,
      valid_to: form.valid_to ? new Date(form.valid_to).toISOString() : null,
      priority: parseInt(form.priority, 10) || 0,
      active: form.active,
      updated_at: new Date().toISOString(),
    }
    if (editing) {
      const { error } = await supabase.from('customer_price_rules').update(payload).eq('id', editing.id)
      if (error) { onMessage({ type: 'err', text: error.message }); setSaving(false); return }
      onMessage({ type: 'ok', text: 'Rule updated.' })
    } else {
      const { error } = await supabase.from('customer_price_rules').insert(payload)
      if (error) { onMessage({ type: 'err', text: error.message }); setSaving(false); return }
      onMessage({ type: 'ok', text: 'Rule created.' })
    }
    setSaving(false)
    setModalOpen(false)
    onReload()
  }

  const scopeLabel = (r: CustomerPriceRuleRow) => {
    if (r.scope_type === 'all') return 'All products'
    if (r.scope_type === 'category') return `Category: ${categories.find((c) => c.id === r.scope_category_id)?.name ?? r.scope_category_id}`
    if (r.scope_type === 'product') return `Product: ${products.find((p) => p.id === r.scope_product_id)?.name ?? r.scope_product_id}`
    if (r.scope_type === 'collection') return `Collection: ${collections.find((c) => c.id === r.scope_collection_id)?.name ?? r.scope_collection_id}`
    return r.scope_type
  }

  return (
    <div className="card admin-card">
      <div className="admin-card-header">
        <h3>Customer price rules &amp; promotions</h3>
        <button type="button" className="btn btn-small" onClick={openAdd}>Add rule</button>
      </div>
      <p className="admin-muted">
        These rules drive <strong>sell price</strong> (discount %, markup %, or fixed £ override) after catalogue list prices.
        A rule applies only if each segment you fill in matches the customer’s profile—for example group <em>and</em> trade type must both match when both are set.
        Use <strong>Scope</strong> to limit the rule to all products, one category, one SKU, or a collection. Use dates and minimum order value for time-bound promos.
        An optional <strong>account discount %</strong> on the customer profile (Customers → profile) is applied <em>after</em> every matching rule here.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Segment</th>
              <th>Scope</th>
              <th>Effect</th>
              <th>Min order</th>
              <th>Valid</th>
              <th>Priority</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>
                  {[
                    r.customer_group_id ? groups.find((g) => g.id === r.customer_group_id)?.name : null,
                    r.customer_location_id ? locations.find((l) => l.id === r.customer_location_id)?.name : null,
                    r.trade_type_id ? tradeTypes.find((t) => t.id === r.trade_type_id)?.name : null,
                    r.company_type_id ? companyTypes.find((c) => c.id === r.company_type_id)?.name : null,
                  ].filter(Boolean).join(', ') || 'Any'}
                </td>
                <td>{scopeLabel(r)}</td>
                <td>{r.rule_type === 'percentage_discount' && `${r.value}% off`}{r.rule_type === 'percentage_markup' && `+${r.value}%`}{r.rule_type === 'fixed_price_override' && `£${r.value}`}</td>
                <td>{r.min_order_total_ex_vat != null ? `£${Number(r.min_order_total_ex_vat).toFixed(0)}` : '—'}</td>
                <td>{r.valid_from || r.valid_to ? `${r.valid_from ? new Date(r.valid_from).toLocaleDateString() : '…'} – ${r.valid_to ? new Date(r.valid_to).toLocaleDateString() : '…'}` : '—'}</td>
                <td>{r.priority}</td>
                <td>{r.active ? 'Yes' : 'No'}</td>
                <td><button type="button" className="btn btn-ghost btn-small" onClick={() => openEdit(r)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rules.length === 0 && <p className="admin-muted">No customer price rules yet. Add one to apply segment-based pricing or promotions.</p>}

      {modalOpen && (
        <div className="admin-modal-backdrop" onClick={() => !saving && setModalOpen(false)}>
          <div className="admin-modal card admin-modal--large" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? 'Edit rule' : 'Add customer price rule'}</h3>
            <form onSubmit={handleSave} className="admin-modal-form">
              <div className="admin-modal-form-section">
                <h4 className="admin-modal-form-section-title">Name &amp; description</h4>
                <label>Name</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                <label>Description</label>
                <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. March XYZ range promo" />
              </div>
              <div className="admin-modal-form-section">
                <h4
                  className="admin-modal-form-section-title"
                  title="Blank dropdowns mean ‘don’t filter on this field’. To target one customer cohort, set only the segments that matter and leave the rest blank."
                >
                  Segment (leave empty = match any)
                </h4>
                <p className="admin-muted" style={{ margin: '0 0 0.5rem', fontSize: '0.8rem' }}>
                  Must match the customer’s profile fields on{' '}
                  <Link to="/admin/customers">Customers</Link> for each dropdown you set. Narrower combinations reach fewer accounts.
                </p>
                <div className="admin-modal-form-row admin-form-row--multi">
                  <select
                    title="Customer group from their profile. Blank = any group."
                    value={form.customer_group_id}
                    onChange={(e) => setForm((f) => ({ ...f, customer_group_id: e.target.value }))}
                  >
                    <option value="">Any group</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <select
                    title="Customer location / region segment from their profile. Blank = any."
                    value={form.customer_location_id}
                    onChange={(e) => setForm((f) => ({ ...f, customer_location_id: e.target.value }))}
                  >
                    <option value="">Any location</option>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <select
                    title="Trade type from their profile. Blank = any."
                    value={form.trade_type_id}
                    onChange={(e) => setForm((f) => ({ ...f, trade_type_id: e.target.value }))}
                  >
                    <option value="">Any trade</option>
                    {tradeTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select
                    title="Company type from their profile. Blank = any."
                    value={form.company_type_id}
                    onChange={(e) => setForm((f) => ({ ...f, company_type_id: e.target.value }))}
                  >
                    <option value="">Any company type</option>
                    {companyTypes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="admin-modal-form-section">
                <h4 className="admin-modal-form-section-title">Scope</h4>
                <label>Apply to</label>
                <select value={form.scope_type} onChange={(e) => setForm((f) => ({ ...f, scope_type: e.target.value as typeof form.scope_type }))}>
                  <option value="all">All products</option>
                  <option value="category">Category</option>
                  <option value="product">Product</option>
                  <option value="collection">Collection</option>
                </select>
                {form.scope_type === 'category' && (
                  <select value={form.scope_category_id} onChange={(e) => setForm((f) => ({ ...f, scope_category_id: e.target.value }))}>
                    <option value="">Select category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
                {form.scope_type === 'product' && (
                  <select value={form.scope_product_id} onChange={(e) => setForm((f) => ({ ...f, scope_product_id: e.target.value }))}>
                    <option value="">Select product</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} — £{Number(p.unit_price).toFixed(2)}</option>)}
                  </select>
                )}
                {form.scope_type === 'collection' && (
                  <select value={form.scope_collection_id} onChange={(e) => setForm((f) => ({ ...f, scope_collection_id: e.target.value }))}>
                    <option value="">Select collection</option>
                    {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>
              <div className="admin-modal-form-section">
                <h4 className="admin-modal-form-section-title">Rule effect</h4>
                <label title="How this rule adjusts the catalogue unit price when segment and scope match.">Rule type</label>
                <select
                  title="Discount reduces sell price; markup increases it; fixed override replaces list price for matched lines."
                  value={form.rule_type}
                  onChange={(e) => setForm((f) => ({ ...f, rule_type: e.target.value as typeof form.rule_type }))}
                >
                  <option value="percentage_discount">Percentage discount (%)</option>
                  <option value="percentage_markup">Percentage markup (%)</option>
                  <option value="fixed_price_override">Fixed price override (£)</option>
                </select>
                <label title={form.rule_type === 'fixed_price_override' ? 'New sell price ex VAT for matched lines.' : 'Percentage applied to list price (discount subtracts, markup adds).'}>
                  Value ({form.rule_type === 'fixed_price_override' ? '£' : '%'})
                </label>
                <input
                  type="number"
                  step={form.rule_type === 'fixed_price_override' ? '0.01' : '0.1'}
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                  required
                />
              </div>
              <div className="admin-modal-form-section">
                <h4 className="admin-modal-form-section-title">Promotion constraints (optional)</h4>
                <label>Min order total ex VAT (£)</label>
                <input type="number" step="0.01" value={form.min_order_total_ex_vat} onChange={(e) => setForm((f) => ({ ...f, min_order_total_ex_vat: e.target.value }))} placeholder="Optional" />
                <label>Valid from</label>
                <input type="datetime-local" value={form.valid_from} onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))} />
                <label>Valid to</label>
                <input type="datetime-local" value={form.valid_to} onChange={(e) => setForm((f) => ({ ...f, valid_to: e.target.value }))} />
              </div>
              <div className="admin-modal-form-section">
                <h4 className="admin-modal-form-section-title">Priority &amp; status</h4>
                <label title="When multiple rules match, higher numbers run first; later rules compound or override depending on engine behaviour—keep important promos higher.">
                  Priority (higher = applied first)
                </label>
                <input type="number" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} />
                <label className="admin-checkbox-label"><input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /> Active</label>
              </div>
              <div className="admin-modal-actions">
                <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Cost price rules ---
function CostRulesSection({
  rules,
  suppliers,
  categories,
  products,
  onReload,
  onMessage,
}: {
  rules: CostPriceRuleRow[]
  suppliers: SupplierRow[]
  categories: CategoryRow[]
  products: ProductRow[]
  onReload: () => void
  onMessage: (m: { type: 'ok' | 'err'; text: string } | null) => void
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CostPriceRuleRow | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    supplier_id: '' as string,
    scope_type: 'all' as 'all' | 'category' | 'product',
    scope_category_id: '' as string,
    scope_product_id: '' as string,
    rule_type: 'fixed_cost' as 'fixed_cost' | 'percentage_of_sell' | 'markup_on_cost',
    value: '',
    valid_from: '',
    valid_to: '',
    priority: '0',
    active: true,
  })
  const [saving, setSaving] = useState(false)

  function openAdd() {
    setEditing(null)
    setForm({
      name: '',
      description: '',
      supplier_id: '',
      scope_type: 'all',
      scope_category_id: '',
      scope_product_id: '',
      rule_type: 'fixed_cost',
      value: '',
      valid_from: '',
      valid_to: '',
      priority: '0',
      active: true,
    })
    setModalOpen(true)
  }

  function openEdit(r: CostPriceRuleRow) {
    setEditing(r)
    setForm({
      name: r.name,
      description: r.description ?? '',
      supplier_id: r.supplier_id ?? '',
      scope_type: r.scope_type,
      scope_category_id: r.scope_category_id ?? '',
      scope_product_id: r.scope_product_id ?? '',
      rule_type: r.rule_type,
      value: String(r.value),
      valid_from: r.valid_from ? r.valid_from.slice(0, 16) : '',
      valid_to: r.valid_to ? r.valid_to.slice(0, 16) : '',
      priority: String(r.priority),
      active: r.active,
    })
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      supplier_id: form.supplier_id || null,
      scope_type: form.scope_type,
      scope_category_id: form.scope_type === 'category' ? form.scope_category_id || null : null,
      scope_product_id: form.scope_type === 'product' ? form.scope_product_id || null : null,
      rule_type: form.rule_type,
      value: parseFloat(form.value) || 0,
      valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : null,
      valid_to: form.valid_to ? new Date(form.valid_to).toISOString() : null,
      priority: parseInt(form.priority, 10) || 0,
      active: form.active,
      updated_at: new Date().toISOString(),
    }
    if (editing) {
      const { error } = await supabase.from('cost_price_rules').update(payload).eq('id', editing.id)
      if (error) { onMessage({ type: 'err', text: error.message }); setSaving(false); return }
      onMessage({ type: 'ok', text: 'Cost rule updated.' })
    } else {
      const { error } = await supabase.from('cost_price_rules').insert(payload)
      if (error) { onMessage({ type: 'err', text: error.message }); setSaving(false); return }
      onMessage({ type: 'ok', text: 'Cost rule created.' })
    }
    setSaving(false)
    setModalOpen(false)
    onReload()
  }

  const scopeLabel = (r: CostPriceRuleRow) => {
    if (r.scope_type === 'all') return 'All'
    if (r.scope_type === 'category') return categories.find((c) => c.id === r.scope_category_id)?.name ?? r.scope_category_id
    if (r.scope_type === 'product') return products.find((p) => p.id === r.scope_product_id)?.name ?? r.scope_product_id
    return r.scope_type
  }

  return (
    <div className="card admin-card">
      <div className="admin-card-header">
        <h3>Cost price rules</h3>
        <button type="button" className="btn btn-small" onClick={openAdd}>Add rule</button>
      </div>
      <p className="admin-muted">
        Used for <strong>margin reporting</strong> and preview: resolved cost per unit after these rules. Typical pattern is fixed supplier cost or markup on catalogue cost.
        <strong> Percentage of sell</strong> ties cost to whatever sell price was resolved (including customer discounts).
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Supplier</th>
              <th>Scope</th>
              <th>Rule</th>
              <th>Value</th>
              <th>Valid</th>
              <th>Priority</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.supplier_id ? suppliers.find((s) => s.id === r.supplier_id)?.company_name ?? '—' : 'Any'}</td>
                <td>{scopeLabel(r)}</td>
                <td>{r.rule_type}</td>
                <td>{r.value}</td>
                <td>{r.valid_from || r.valid_to ? `${r.valid_from ? new Date(r.valid_from).toLocaleDateString() : '…'} – ${r.valid_to ? new Date(r.valid_to).toLocaleDateString() : '…'}` : '—'}</td>
                <td>{r.priority}</td>
                <td>{r.active ? 'Yes' : 'No'}</td>
                <td><button type="button" className="btn btn-ghost btn-small" onClick={() => openEdit(r)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rules.length === 0 && <p className="admin-muted">No cost price rules. Product cost comes from catalogue; add rules to override by supplier/category/product.</p>}

      {modalOpen && (
        <div className="admin-modal-backdrop" onClick={() => !saving && setModalOpen(false)}>
          <div className="admin-modal card admin-modal--large" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? 'Edit cost rule' : 'Add cost price rule'}</h3>
            <form onSubmit={handleSave} className="admin-modal-form">
              <div className="admin-modal-form-section">
                <h4 className="admin-modal-form-section-title">Name &amp; supplier</h4>
                <label>Name</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                <label>Supplier (optional)</label>
                <select value={form.supplier_id} onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}>
                  <option value="">Any</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                </select>
              </div>
              <div className="admin-modal-form-section">
                <h4 className="admin-modal-form-section-title">Scope</h4>
                <label>Apply to</label>
                <select value={form.scope_type} onChange={(e) => setForm((f) => ({ ...f, scope_type: e.target.value as typeof form.scope_type }))}>
                  <option value="all">All products</option>
                  <option value="category">Category</option>
                  <option value="product">Product</option>
                </select>
                {form.scope_type === 'category' && (
                  <select value={form.scope_category_id} onChange={(e) => setForm((f) => ({ ...f, scope_category_id: e.target.value }))}>
                    <option value="">Select category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
                {form.scope_type === 'product' && (
                  <select value={form.scope_product_id} onChange={(e) => setForm((f) => ({ ...f, scope_product_id: e.target.value }))}>
                    <option value="">Select product</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
              </div>
              <div className="admin-modal-form-section">
                <h4 className="admin-modal-form-section-title">Rule effect</h4>
                <label title="Fixed £ cost, margin as % of resolved sell, or % markup starting from catalogue cost.">Rule type</label>
                <select
                  title="fixed_cost: absolute £; percentage_of_sell: margin tied to sell; markup_on_cost: adds % to base cost."
                  value={form.rule_type}
                  onChange={(e) => setForm((f) => ({ ...f, rule_type: e.target.value as typeof form.rule_type }))}
                >
                  <option value="fixed_cost">Fixed cost (£)</option>
                  <option value="percentage_of_sell">% of sell price</option>
                  <option value="markup_on_cost">Markup on cost (%)</option>
                </select>
                <label title="Numeric parameter for the rule type above (£ or % depending on type).">Value</label>
                <input type="number" step="0.01" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} required />
              </div>
              <div className="admin-modal-form-section">
                <h4 className="admin-modal-form-section-title">Valid period (optional)</h4>
                <label>Valid from</label>
                <input type="datetime-local" value={form.valid_from} onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))} />
                <label>Valid to</label>
                <input type="datetime-local" value={form.valid_to} onChange={(e) => setForm((f) => ({ ...f, valid_to: e.target.value }))} />
              </div>
              <div className="admin-modal-form-section">
                <h4 className="admin-modal-form-section-title">Priority &amp; status</h4>
                <label>Priority</label>
                <input type="number" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} />
                <label className="admin-checkbox-label"><input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /> Active</label>
              </div>
              <div className="admin-modal-actions">
                <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function PricingPreviewSection({
  customers,
  products,
  categories,
  collections,
}: {
  customers: CustomerProfileRow[]
  products: ProductRow[]
  categories: CategoryRow[]
  collections: CollectionRow[]
}) {
  const [customerUserId, setCustomerUserId] = useState('')
  const [productId, setProductId] = useState('')
  const [orderTotalExVat, setOrderTotalExVat] = useState('0')
  const [collectionIdsText, setCollectionIdsText] = useState('')
  const [calculating, setCalculating] = useState(false)
  const [result, setResult] = useState<{
    baseSell: number
    resolvedSell: number
    resolvedCost: number | null
    margin: number | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runPreview(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    const customer = customers.find((c) => c.user_id === customerUserId)
    const product = products.find((p) => p.id === productId)
    if (!customer || !product) {
      setError('Select customer and product.')
      return
    }
    setCalculating(true)
    try {
      const collectionIds = collectionIdsText
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
      const resolvedSell = await resolveCustomerPrice({
        productId: product.id,
        categoryId: product.category_id ?? '',
        baseUnitPrice: Number(product.unit_price || 0),
        segment: {
          customer_group_id: customer.customer_group_id ?? null,
          customer_location_id: customer.customer_location_id ?? null,
          trade_type_id: customer.trade_type_id ?? null,
          company_type_id: customer.company_type_id ?? null,
        },
        orderTotalExVat: Number(orderTotalExVat || 0),
        collectionIds: collectionIds.length > 0 ? collectionIds : undefined,
        accountDiscountPercent: normalizeAccountDiscountPercent(customer.account_discount_percent),
      })
      const resolvedCost = await resolveCostPrice({
        productId: product.id,
        categoryId: product.category_id ?? '',
        baseCostPrice: product.cost_price != null ? Number(product.cost_price) : null,
        sellPrice: resolvedSell,
      })
      const margin = resolvedCost != null ? resolvedSell - resolvedCost : null
      setResult({
        baseSell: Number(product.unit_price || 0),
        resolvedSell,
        resolvedCost,
        margin,
      })
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Preview failed')
    } finally {
      setCalculating(false)
    }
  }

  return (
    <div className="card admin-card">
      <h3>Pricing preview / simulator</h3>
      <p className="admin-muted">
        Uses the selected customer’s <strong>pricing segment</strong>, optional <strong>account discount %</strong>, and active rules to show list vs resolved sell, resolved cost, and unit margin.
      </p>
      <form onSubmit={runPreview} className="admin-inline-form--stack">
        <label title="Customer profile supplies group, location, trade type and company type into the pricing engine.">
          Customer{' '}
          <select value={customerUserId} onChange={(e) => setCustomerUserId(e.target.value)}>
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.user_id}>{c.company_name}</option>
            ))}
          </select>
        </label>
        <label title="Catalogue list price and category drive base sell and which rules apply.">
          Product{' '}
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.sku ?? 'no sku'})</option>
            ))}
          </select>
        </label>
        <label title="Some promotions require a minimum basket ex VAT—enter the hypothetical order total to test that gate.">
          Order total ex VAT{' '}
          <input type="number" step="0.01" value={orderTotalExVat} onChange={(e) => setOrderTotalExVat(e.target.value)} />
        </label>
        <label title="If the product belongs to collections, pass those UUIDs so collection-scoped rules can match (see Collections tab for IDs).">
          Collection IDs (comma-separated){' '}
          <input type="text" value={collectionIdsText} onChange={(e) => setCollectionIdsText(e.target.value)} placeholder="Optional" />
        </label>
        <button type="submit" className="btn btn-small" disabled={calculating || !customerUserId || !productId}>
          {calculating ? 'Calculating…' : 'Run preview'}
        </button>
      </form>
      <div className="admin-muted" style={{ marginTop: '0.5rem' }}>
        Available collections: {collections.map((c) => c.id).join(', ') || 'none'}
      </div>
      <div className="admin-muted" style={{ marginTop: '0.25rem' }}>
        Categories loaded: {categories.length}
      </div>
      {error && <p className="admin-error" style={{ marginTop: '0.75rem' }}>{error}</p>}
      {result && (
        <ul className="admin-report-list" style={{ marginTop: '0.75rem' }}>
          <li className="admin-report-list-item">
            <span className="admin-report-list-label" title="Unit list price from the product catalogue before customer rules.">Base sell price</span>
            <span className="admin-report-list-value">£{result.baseSell.toFixed(2)}</span>
          </li>
          <li className="admin-report-list-item">
            <span className="admin-report-list-label" title="Sell price after applying matching customer price rules.">Resolved sell price</span>
            <span className="admin-report-list-value">£{result.resolvedSell.toFixed(2)}</span>
          </li>
          <li className="admin-report-list-item">
            <span className="admin-report-list-label" title="Unit cost from cost rules (may use catalogue cost as input).">Resolved cost</span>
            <span className="admin-report-list-value">{result.resolvedCost != null ? `£${result.resolvedCost.toFixed(2)}` : '—'}</span>
          </li>
          <li className="admin-report-list-item">
            <span className="admin-report-list-label" title="Resolved sell minus resolved cost for one unit (ex VAT figures).">Unit margin</span>
            <span className="admin-report-list-value">{result.margin != null ? `£${result.margin.toFixed(2)}` : '—'}</span>
          </li>
        </ul>
      )}
    </div>
  )
}

// --- Collections ---
function CollectionsSection({
  collections,
  onReload,
  onMessage,
}: {
  collections: CollectionRow[]
  onReload: () => void
  onMessage: (m: { type: 'ok' | 'err'; text: string } | null) => void
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [saving, setSaving] = useState(false)
  const slugify = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const s = slug.trim() || slugify(name)
    if (!s) return onMessage({ type: 'err', text: 'Slug required' })
    setSaving(true)
    const { error } = await supabase.from('collections').insert({ name: name.trim(), slug: s, sort_order: collections.length })
    setSaving(false)
    if (error) return onMessage({ type: 'err', text: error.message })
    onMessage({ type: 'ok', text: 'Collection added. Add products to it below or in the Customer price rules scope.' })
    setName('')
    setSlug('')
    setAdding(false)
    onReload()
  }

  return (
    <div className="card admin-card">
      <h3>Collections</h3>
      <p className="admin-muted">Create ranges (e.g. &quot;XYZ Kitchen range&quot;) and assign products. Use them in Customer price rules to run promotions like &quot;Extra 10% off XYZ range this March&quot;.</p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Sort</th>
            </tr>
          </thead>
          <tbody>
            {collections.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td><code>{c.slug}</code></td>
                <td>{c.sort_order}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!adding ? (
        <button type="button" className="btn btn-small" onClick={() => setAdding(true)}>Add collection</button>
      ) : (
        <form onSubmit={handleAdd} className="admin-segment-add-form">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. XYZ Kitchen range)" required />
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Slug (auto from name)" />
          <div>
            <button type="submit" className="btn btn-small" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" className="btn btn-outline btn-small" onClick={() => { setAdding(false); setName(''); setSlug(''); }}>Cancel</button>
          </div>
        </form>
      )}
      <p className="admin-muted" style={{ marginTop: '1rem' }}>To add products to a collection, use the <code>collection_products</code> table (collection_id, product_id). You can add a UI for this later or manage via SQL.</p>
    </div>
  )
}
