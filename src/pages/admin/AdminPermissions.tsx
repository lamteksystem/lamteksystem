import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { PermissionRuleRow } from '@/types/database'
import type { StaffProfileRow } from '@/hooks/useStaff'
import { clearPermissionRulesCache } from '@/lib/permissions'

const SCOPES = [
  'admin.catalogue',
  'admin.stock',
  'admin.pricing',
  'admin.customers',
  'admin.orders',
  'admin.uploads',
  'admin.reports',
  'accounts.view',
  'accounts.receive_payments',
  'accounts.adjust_balances',
  'tickets.view',
  'tickets.manage',
  'tickets.assign',
  'admin.settings',
  'admin.users',
  'admin.permissions',
]
const ACTIONS = ['view', 'edit', 'create', 'delete']
const ROLES = ['admin', 'staff'] as const

type PermissionTemplateRule = {
  name: string
  description: string
  scope: string
  action: string
  role: 'admin' | 'staff' | null
  user_id: string | null
  conditions: Record<string, unknown>
}

const STAFF_DEFAULT_TEMPLATE: PermissionTemplateRule[] = [
  { name: 'Staff view catalogue', description: 'Default staff access', scope: 'admin.catalogue', action: 'view', role: 'staff', user_id: null, conditions: {} },
  { name: 'Staff edit catalogue', description: 'Default staff access', scope: 'admin.catalogue', action: 'edit', role: 'staff', user_id: null, conditions: {} },
  { name: 'Staff view orders', description: 'Default staff access', scope: 'admin.orders', action: 'view', role: 'staff', user_id: null, conditions: {} },
  { name: 'Staff edit orders', description: 'Default staff access', scope: 'admin.orders', action: 'edit', role: 'staff', user_id: null, conditions: {} },
  { name: 'Staff view stock', description: 'Default staff access', scope: 'admin.stock', action: 'view', role: 'staff', user_id: null, conditions: {} },
  { name: 'Staff edit stock', description: 'Default staff access', scope: 'admin.stock', action: 'edit', role: 'staff', user_id: null, conditions: {} },
  { name: 'Staff view pricing', description: 'Default staff access', scope: 'admin.pricing', action: 'view', role: 'staff', user_id: null, conditions: {} },
  { name: 'Staff edit pricing', description: 'Default staff access', scope: 'admin.pricing', action: 'edit', role: 'staff', user_id: null, conditions: {} },
  { name: 'Staff view reports', description: 'Default staff access', scope: 'admin.reports', action: 'view', role: 'staff', user_id: null, conditions: {} },
  { name: 'Staff view accounting', description: 'Default staff access', scope: 'accounts.view', action: 'view', role: 'staff', user_id: null, conditions: {} },
  { name: 'Staff receive payments', description: 'Default staff access', scope: 'accounts.receive_payments', action: 'create', role: 'staff', user_id: null, conditions: {} },
  { name: 'Staff adjust balances', description: 'Default staff access', scope: 'accounts.adjust_balances', action: 'create', role: 'staff', user_id: null, conditions: {} },
  { name: 'Staff view tickets', description: 'Default staff access', scope: 'tickets.view', action: 'view', role: 'staff', user_id: null, conditions: {} },
  { name: 'Staff manage tickets', description: 'Default staff access', scope: 'tickets.manage', action: 'edit', role: 'staff', user_id: null, conditions: {} },
]

const SALES_TEMPLATE: PermissionTemplateRule[] = [
  { name: 'Sales view catalogue', description: 'Sales template', scope: 'admin.catalogue', action: 'view', role: 'staff', user_id: null, conditions: {} },
  { name: 'Sales edit catalogue', description: 'Sales template', scope: 'admin.catalogue', action: 'edit', role: 'staff', user_id: null, conditions: {} },
  { name: 'Sales view customers', description: 'Sales template', scope: 'admin.customers', action: 'view', role: 'staff', user_id: null, conditions: {} },
  { name: 'Sales view orders', description: 'Sales template', scope: 'admin.orders', action: 'view', role: 'staff', user_id: null, conditions: {} },
  { name: 'Sales edit orders', description: 'Sales template', scope: 'admin.orders', action: 'edit', role: 'staff', user_id: null, conditions: {} },
  { name: 'Sales view pricing', description: 'Sales template', scope: 'admin.pricing', action: 'view', role: 'staff', user_id: null, conditions: {} },
  { name: 'Sales view reports', description: 'Sales template', scope: 'admin.reports', action: 'view', role: 'staff', user_id: null, conditions: {} },
  { name: 'Sales view tickets', description: 'Sales template', scope: 'tickets.view', action: 'view', role: 'staff', user_id: null, conditions: {} },
  { name: 'Sales manage tickets', description: 'Sales template', scope: 'tickets.manage', action: 'edit', role: 'staff', user_id: null, conditions: {} },
]

const ACCOUNTS_TEMPLATE: PermissionTemplateRule[] = [
  { name: 'Accounts view orders', description: 'Accounts template', scope: 'admin.orders', action: 'view', role: 'staff', user_id: null, conditions: {} },
  { name: 'Accounts view accounting', description: 'Accounts template', scope: 'accounts.view', action: 'view', role: 'staff', user_id: null, conditions: {} },
  { name: 'Accounts receive payments', description: 'Accounts template', scope: 'accounts.receive_payments', action: 'create', role: 'staff', user_id: null, conditions: {} },
  { name: 'Accounts adjust balances', description: 'Accounts template', scope: 'accounts.adjust_balances', action: 'create', role: 'staff', user_id: null, conditions: {} },
  { name: 'Accounts view reports', description: 'Accounts template', scope: 'admin.reports', action: 'view', role: 'staff', user_id: null, conditions: {} },
]

const WAREHOUSE_TEMPLATE: PermissionTemplateRule[] = [
  { name: 'Warehouse view stock', description: 'Warehouse template', scope: 'admin.stock', action: 'view', role: 'staff', user_id: null, conditions: {} },
  { name: 'Warehouse edit stock', description: 'Warehouse template', scope: 'admin.stock', action: 'edit', role: 'staff', user_id: null, conditions: {} },
  { name: 'Warehouse view locations', description: 'Warehouse template', scope: 'admin.orders', action: 'view', role: 'staff', user_id: null, conditions: {} },
  { name: 'Warehouse view tickets', description: 'Warehouse template', scope: 'tickets.view', action: 'view', role: 'staff', user_id: null, conditions: {} },
]

const SUPPORT_TEMPLATE: PermissionTemplateRule[] = [
  { name: 'Support view tickets', description: 'Support template', scope: 'tickets.view', action: 'view', role: 'staff', user_id: null, conditions: {} },
  { name: 'Support manage tickets', description: 'Support template', scope: 'tickets.manage', action: 'edit', role: 'staff', user_id: null, conditions: {} },
  { name: 'Support assign tickets', description: 'Support template', scope: 'tickets.assign', action: 'edit', role: 'staff', user_id: null, conditions: {} },
  { name: 'Support view customers', description: 'Support template', scope: 'admin.customers', action: 'view', role: 'staff', user_id: null, conditions: {} },
]

const TEMPLATES: Record<string, { label: string; rules: PermissionTemplateRule[] }> = {
  default_staff: { label: 'Default staff', rules: STAFF_DEFAULT_TEMPLATE },
  sales: { label: 'Sales', rules: SALES_TEMPLATE },
  accounts: { label: 'Accounts', rules: ACCOUNTS_TEMPLATE },
  warehouse: { label: 'Warehouse', rules: WAREHOUSE_TEMPLATE },
  support: { label: 'Support', rules: SUPPORT_TEMPLATE },
}

export default function AdminPermissions() {
  const [rules, setRules] = useState<PermissionRuleRow[]>([])
  const [staffProfiles, setStaffProfiles] = useState<StaffProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PermissionRuleRow | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    scope: 'admin.catalogue',
    action: 'view',
    role: 'staff' as 'admin' | 'staff' | null,
    userId: '',
    conditionsText: '{}',
    active: true,
  })
  const [templateKey, setTemplateKey] = useState<keyof typeof TEMPLATES>('default_staff')

  const staffByUserId = useMemo(() => {
    const map = new Map<string, StaffProfileRow>()
    for (const s of staffProfiles) map.set(s.user_id, s)
    return map
  }, [staffProfiles])

  async function load() {
    const [rulesRes, staffRes] = await Promise.all([
      supabase
      .from('permission_rules')
      .select('*')
      .order('scope')
      .order('action'),
      supabase.from('staff_profiles').select('*').order('display_name'),
    ])
    const { data } = rulesRes
    setRules((data ?? []) as PermissionRuleRow[])
    setStaffProfiles((staffRes.data ?? []) as StaffProfileRow[])
  }

  useEffect(() => {
    setLoading(true)
    load().then(() => setLoading(false))
  }, [])

  function openAdd() {
    setEditing(null)
    setForm({ name: '', description: '', scope: 'admin.catalogue', action: 'view', role: 'staff', userId: '', conditionsText: '{}', active: true })
    setModalOpen(true)
  }

  function openEdit(r: PermissionRuleRow) {
    setEditing(r)
    setForm({
      name: r.name,
      description: r.description ?? '',
      scope: r.scope,
      action: r.action,
      role: r.role ?? 'staff',
      userId: r.user_id ?? '',
      conditionsText: (() => {
        try { return JSON.stringify(r.conditions ?? {}, null, 2) } catch (_) { return '{}' }
      })(),
      active: r.active,
    })
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    // Table constraint: at least one of role or user_id must be set
    const user_id = form.userId.trim() ? form.userId.trim() : null
    const role = user_id ? null : (form.role ?? null)
    let parsedConditions: unknown = {}
    try {
      parsedConditions = JSON.parse(form.conditionsText || '{}')
    } catch (_) {
      setMessage({ type: 'err', text: 'Conditions JSON is invalid.' })
      return
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      scope: form.scope,
      action: form.action,
      role,
      user_id,
      conditions: parsedConditions,
      active: form.active,
      updated_at: new Date().toISOString(),
    }
    if (editing) {
      const { error } = await supabase.from('permission_rules').update(payload).eq('id', editing.id)
      if (error) { setMessage({ type: 'err', text: error.message }); return }
      setMessage({ type: 'ok', text: 'Rule updated.' })
    } else {
      const { error } = await supabase.from('permission_rules').insert(payload)
      if (error) { setMessage({ type: 'err', text: error.message }); return }
      setMessage({ type: 'ok', text: 'Rule created.' })
    }
    clearPermissionRulesCache()
    setModalOpen(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this permission rule?')) return
    const { error } = await supabase.from('permission_rules').delete().eq('id', id)
    if (error) setMessage({ type: 'err', text: error.message })
    else { clearPermissionRulesCache(); setMessage({ type: 'ok', text: 'Rule deleted.' }); load() }
  }

  async function applyTemplateRules(templateToApply: PermissionTemplateRule[], templateLabel: string) {
    const existing = new Set(
      rules.map((r) => `${r.scope}|${r.action}|${r.role ?? ''}|${r.user_id ?? ''}`)
    )
    const toInsert = templateToApply
      .filter((t) => !existing.has(`${t.scope}|${t.action}|${t.role ?? ''}|${t.user_id ?? ''}`))
      .map((t) => ({
        name: t.name,
        description: t.description,
        scope: t.scope,
        action: t.action,
        role: t.role,
        user_id: t.user_id,
        conditions: t.conditions,
        active: true,
      }))

    if (toInsert.length === 0) {
      setMessage({ type: 'ok', text: `${templateLabel} template rules already exist.` })
      return
    }
    const { error } = await supabase.from('permission_rules').insert(toInsert)
    if (error) {
      setMessage({ type: 'err', text: error.message })
      return
    }
    clearPermissionRulesCache()
    setMessage({ type: 'ok', text: `Added ${toInsert.length} ${templateLabel} template rule(s).` })
    await load()
  }

  return (
    <div className="admin-page">
      <p className="page-intro">
        Manage permission rules by scope and action. Rules can apply to a role (admin or staff) or a specific user. Use Conditions JSON for granular &quot;if this, then that&quot; logic.
      </p>
      {message && (
        <div className={message.type === 'ok' ? 'admin-message-ok' : 'admin-error'} style={{ marginBottom: '1rem' }}>
          {message.text}
        </div>
      )}
      <div className="card admin-card">
        <div className="admin-card-header">
          <h2>Permission rules</h2>
          <div className="admin-inline-form--stack">
            <label>
              Template{' '}
              <select value={templateKey} onChange={(e) => setTemplateKey(e.target.value as keyof typeof TEMPLATES)}>
                {Object.entries(TEMPLATES).map(([k, t]) => (
                  <option key={k} value={k}>{t.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-small btn-outline"
              onClick={() => applyTemplateRules(TEMPLATES[templateKey].rules, TEMPLATES[templateKey].label)}
            >
              Apply template
            </button>
            <button type="button" className="btn btn-small" onClick={openAdd}>Add rule</button>
          </div>
        </div>
        {loading ? (
          <p className="admin-muted">Loading…</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Scope</th>
                  <th>Action</th>
                  <th>Role</th>
                  <th>Conditions</th>
                  <th>Active</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 ? (
                  <tr><td colSpan={7} className="admin-table-empty">No permission rules. By default, staff can access admin; add rules to restrict or document access.</td></tr>
                ) : (
                  rules.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td><code>{r.scope}</code></td>
                      <td>{r.action}</td>
                      <td>
                        {r.user_id
                          ? `User: ${staffByUserId.get(r.user_id)?.display_name ?? r.user_id.slice(0, 8)}`
                          : (r.role ?? '—')}
                      </td>
                      <td>
                        {r.conditions && typeof r.conditions === 'object' && Object.keys(r.conditions as Record<string, unknown>).length > 0
                          ? 'Yes'
                          : '—'}
                      </td>
                      <td>{r.active ? 'Yes' : 'No'}</td>
                      <td>
                        <button type="button" className="btn btn-ghost btn-small" onClick={() => openEdit(r)}>Edit</button>
                        {' '}
                        <button type="button" className="btn btn-ghost btn-small" onClick={() => handleDelete(r.id)}>Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card admin-card" style={{ marginTop: '1rem' }}>
        <h2>Default access model</h2>
        <ul className="admin-report-list">
          <li className="admin-report-list-item">
            <span className="admin-report-list-label">Admin users</span>
            <span className="admin-report-list-value">Full access (all scopes/actions)</span>
          </li>
          <li className="admin-report-list-item">
            <span className="admin-report-list-label">Staff users</span>
            <span className="admin-report-list-value">Template-based + custom role/user rules</span>
          </li>
          <li className="admin-report-list-item">
            <span className="admin-report-list-label">Customer users</span>
            <span className="admin-report-list-value">Portal-only by default (no admin scope)</span>
          </li>
        </ul>
        <p className="admin-muted" style={{ marginTop: '0.75rem' }}>
          Use rule conditions for granular logic such as office-hours access, specific user constraints, or compound if/then checks.
        </p>
      </div>

      {modalOpen && (
        <div className="admin-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="admin-modal card admin-modal--large" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? 'Edit rule' : 'Add permission rule'}</h3>
            <form onSubmit={handleSave} className="admin-modal-form">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. Staff view catalogue" />
              <label>Description</label>
              <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
              <label>Scope</label>
              <select value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}>
                {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <label>Action</label>
              <select value={form.action} onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}>
                {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <label>Role</label>
              <select value={form.role ?? ''} onChange={(e) => setForm((f) => ({ ...f, role: (e.target.value || null) as 'admin' | 'staff' | null }))}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
                <label>User (optional)</label>
                <select value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}>
                  <option value="">— Apply to role (above)</option>
                  {staffProfiles.map((u) => (
                    <option key={u.id} value={u.user_id}>{u.display_name ?? u.user_id}</option>
                  ))}
                </select>
              <label>Conditions JSON (optional)</label>
              <textarea
                value={form.conditionsText}
                onChange={(e) => setForm((f) => ({ ...f, conditionsText: e.target.value }))}
                rows={8}
                placeholder='{}'
                style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}
              />
              <p className="admin-muted" style={{ marginTop: '-0.25rem' }}>
                Examples: <code>{'{ "if": { "field": "env.hour", "op": "gte", "value": 8 } }'}</code> or{' '}
                <code>{'{ "all": [ { "field": "staff.role", "op": "eq", "value": "staff" }, { "field": "env.weekday", "op": "in", "value": [1,2,3,4,5] } ] }'}</code>
              </p>
              <label className="admin-checkbox-label">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
                Active
              </label>
              <div className="admin-modal-actions">
                <button type="submit" className="btn">Save</button>
                <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
