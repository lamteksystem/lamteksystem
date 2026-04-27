import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAdminUi } from '@/contexts/AdminUiContext'
import type { LocationRow } from '@/types/database'

type LocationsSort = 'name_asc' | 'name_desc' | 'code_asc' | 'sort_order'
type LocationsViewType = 'table' | 'grid' | 'cards'

export default function AdminLocations() {
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', address: '', phone: '', opening_hours: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [searchFilter, setSearchFilter] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [sortBy, setSortBy] = useState<LocationsSort>('sort_order')
  const [viewType, setViewType] = useState<LocationsViewType>('table')
  const [editingLocation, setEditingLocation] = useState<LocationRow | null>(null)
  const [editForm, setEditForm] = useState({ name: '', code: '', address: '', phone: '', opening_hours: '', active: true })
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { tableDensity, setTableDensity } = useAdminUi()

  async function load() {
    const { data } = await supabase
      .from('locations')
      .select('*')
      .order('sort_order')
      .order('name')
    setLocations(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!editingLocation) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setEditingLocation(null) }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [editingLocation])

  const searchLower = searchFilter.trim().toLowerCase()

  const filteredAndSorted = useMemo(() => {
    let list = locations
    if (searchLower) {
      list = list.filter(
        (loc) =>
          loc.name.toLowerCase().includes(searchLower) ||
          (loc.code ?? '').toLowerCase().includes(searchLower) ||
          (loc.address ?? '').toLowerCase().includes(searchLower)
      )
    }
    if (activeOnly) list = list.filter((loc) => loc.active)
    const sorted = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name)
        case 'name_desc':
          return b.name.localeCompare(a.name)
        case 'code_asc':
          return (a.code ?? '').localeCompare(b.code ?? '')
        case 'sort_order':
          return a.sort_order - b.sort_order || a.name.localeCompare(b.name)
        default:
          return 0
      }
    })
    return sorted
  }, [locations, searchLower, activeOnly, sortBy])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setMessage(null)
    const { error } = await supabase.from('locations').insert({
      name: form.name.trim(),
      code: form.code.trim() || null,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      opening_hours: form.opening_hours.trim() || null,
      active: true,
      sort_order: locations.length,
    })
    setSaving(false)
    if (error) {
      setMessage({ type: 'err', text: error.message })
      return
    }
    setMessage({ type: 'ok', text: 'Location added.' })
    setForm({ name: '', code: '', address: '', phone: '', opening_hours: '' })
    setAdding(false)
    load()
  }

  function openEdit(loc: LocationRow) {
    setEditingLocation(loc)
    setEditForm({
      name: loc.name,
      code: loc.code ?? '',
      address: loc.address ?? '',
      phone: loc.phone ?? '',
      opening_hours: loc.opening_hours ?? '',
      active: loc.active,
    })
    setMessage(null)
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingLocation) return
    setSaving(true)
    setMessage(null)
    const { error } = await supabase
      .from('locations')
      .update({
        name: editForm.name.trim(),
        code: editForm.code.trim() || null,
        address: editForm.address.trim() || null,
        phone: editForm.phone.trim() || null,
        opening_hours: editForm.opening_hours.trim() || null,
        active: editForm.active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingLocation.id)
    setSaving(false)
    if (error) {
      setMessage({ type: 'err', text: error.message })
      return
    }
    setMessage({ type: 'ok', text: 'Location updated.' })
    setEditingLocation(null)
    load()
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    setMessage(null)
    const { error } = await supabase.from('locations').delete().eq('id', id)
    setDeleting(false)
    setDeleteConfirmId(null)
    if (error) {
      setMessage({ type: 'err', text: error.message })
      return
    }
    setMessage({ type: 'ok', text: 'Location deleted. Stock records for this location were removed.' })
    load()
  }

  if (loading) {
    return (
      <div className="admin-page">
        <p className="admin-muted">Loading…</p>
      </div>
    )
  }

  return (
    <div className="admin-page admin-locations-page">
      <p className="page-intro">
        Manage depots and warehouses. Stock take is done per location. Add a location to start using it in stock takes.
      </p>
      {message && (
        <div className={message.type === 'ok' ? 'admin-message-ok' : 'admin-error'} style={{ marginBottom: '1rem' }}>
          {message.text}
        </div>
      )}
      <div className="card admin-card">
        <div className="admin-locations-header">
          <h2>Locations</h2>
          {!adding ? (
            <button type="button" className="btn" onClick={() => setAdding(true)}>
              Add location
            </button>
          ) : (
            <form onSubmit={handleAdd} className="admin-locations-add-form">
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Name (e.g. Manchester Depot)"
                required
                className="admin-input"
              />
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="Code (e.g. MAN)"
                className="admin-input admin-input--short"
              />
              <input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Address (optional)"
                className="admin-input admin-input--wide"
              />
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="Phone (optional)"
                className="admin-input"
              />
              <input
                value={form.opening_hours}
                onChange={(e) => setForm((f) => ({ ...f, opening_hours: e.target.value }))}
                placeholder="Opening hours (optional)"
                className="admin-input admin-input--wide"
              />
              <button type="submit" className="btn" disabled={saving}>Save</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setAdding(false); setForm({ name: '', code: '', address: '', phone: '', opening_hours: '' }); }}>Cancel</button>
            </form>
          )}
        </div>

        <div className="admin-filters admin-filters--wrap admin-locations-filters">
          <label>
            Search
            <input
              type="search"
              placeholder="Name, code or address…"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="admin-filter-input"
            />
          </label>
          <label className="admin-locations-active-only">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            Active only
          </label>
          <label>
            Sort
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as LocationsSort)} className="admin-select">
              <option value="sort_order">Sort order</option>
              <option value="name_asc">Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
              <option value="code_asc">Code A–Z</option>
            </select>
          </label>
          <div className="admin-locations-view-toggle" role="group" aria-label="View type">
            <button type="button" className={viewType === 'table' ? 'active' : ''} onClick={() => setViewType('table')} title="Table">☰</button>
            <button type="button" className={viewType === 'grid' ? 'active' : ''} onClick={() => setViewType('grid')} title="Grid">◫</button>
            <button type="button" className={viewType === 'cards' ? 'active' : ''} onClick={() => setViewType('cards')} title="Cards">▦</button>
          </div>
          <label className="admin-locations-density">
            Table density
            <select value={tableDensity} onChange={(e) => setTableDensity(e.target.value as 'compact' | 'comfortable' | 'spacious')} className="admin-select">
              <option value="compact">Compact</option>
              <option value="comfortable">Comfortable</option>
              <option value="spacious">Spacious</option>
            </select>
          </label>
        </div>

        <p className="admin-muted" style={{ marginBottom: '0.75rem' }}>{filteredAndSorted.length} location(s)</p>

        {viewType === 'table' && (
          <div className={`admin-table-wrap admin-table-wrap--${tableDensity}`}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Address</th>
                  <th>Phone</th>
                  <th>Opening hours</th>
                  <th>Active</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="admin-table-empty">No locations match.</td>
                  </tr>
                ) : (
                  filteredAndSorted.map((loc) => (
                    <tr key={loc.id}>
                      <td><strong>{loc.name}</strong></td>
                      <td>{loc.code ?? '—'}</td>
                      <td>{loc.address ?? '—'}</td>
                      <td>{loc.phone ?? '—'}</td>
                      <td>{loc.opening_hours ?? '—'}</td>
                      <td>{loc.active ? 'Yes' : 'No'}</td>
                      <td>
                        <button type="button" className="btn btn-small btn-ghost" onClick={() => openEdit(loc)}>Edit</button>
                        {deleteConfirmId === loc.id ? (
                          <span className="admin-locations-delete-confirm">
                            <button type="button" className="btn btn-small" onClick={() => handleDelete(loc.id)} disabled={deleting}>Yes, delete</button>
                            <button type="button" className="btn btn-small btn-ghost" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                          </span>
                        ) : (
                          <button type="button" className="btn btn-small btn-ghost admin-delete-btn" onClick={() => setDeleteConfirmId(loc.id)}>Delete</button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {(viewType === 'grid' || viewType === 'cards') && (
          <div className={`admin-locations-grid admin-locations-view--${viewType}`}>
            {filteredAndSorted.length === 0 ? (
              <p className="admin-muted">No locations match.</p>
            ) : (
              filteredAndSorted.map((loc) => (
                <div key={loc.id} className="admin-locations-card card">
                  <div className="admin-locations-card-head">
                    <div className="admin-locations-card-name">{loc.name}</div>
                    <div className="admin-locations-card-actions">
                      <button type="button" className="btn btn-small btn-ghost" onClick={() => openEdit(loc)}>Edit</button>
                      {deleteConfirmId === loc.id ? (
                        <span className="admin-locations-delete-confirm">
                          <button type="button" className="btn btn-small" onClick={() => handleDelete(loc.id)} disabled={deleting}>Delete</button>
                          <button type="button" className="btn btn-small btn-ghost" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                        </span>
                      ) : (
                        <button type="button" className="btn btn-small btn-ghost admin-delete-btn" onClick={() => setDeleteConfirmId(loc.id)}>Delete</button>
                      )}
                    </div>
                  </div>
                  {loc.code && <span className="admin-locations-card-code">{loc.code}</span>}
                  {loc.address && <p className="admin-locations-card-address">{loc.address}</p>}
                  {loc.phone && <p className="admin-locations-card-phone"><a href={`tel:${loc.phone.replace(/\s/g, '')}`}>{loc.phone}</a></p>}
                  {loc.opening_hours && <p className="admin-locations-card-hours">{loc.opening_hours}</p>}
                  <span className={`admin-locations-card-active ${loc.active ? 'active' : 'inactive'}`}>{loc.active ? 'Active' : 'Inactive'}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {editingLocation && (
        <div
          className="admin-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-location-edit-title"
          onClick={(e) => e.target === e.currentTarget && setEditingLocation(null)}
        >
          <div className="admin-modal card admin-modal--form">
            <button type="button" className="admin-modal-close" onClick={() => setEditingLocation(null)} aria-label="Close">×</button>
            <h2 id="admin-location-edit-title" className="admin-modal-title">Edit location</h2>
            <form onSubmit={handleSaveEdit} className="admin-modal-form">
              <div className="admin-modal-form-section">
                <h3 className="admin-modal-form-section-title">Details</h3>
                <div className="admin-modal-form-row">
                  <label>
                    Name
                    <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. Rochdale (Head Office)" />
                  </label>
                  <label>
                    Code
                    <input value={editForm.code} onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value }))} placeholder="ROC" />
                  </label>
                </div>
              </div>
              <div className="admin-modal-form-section">
                <h3 className="admin-modal-form-section-title">Address & contact</h3>
                <label>
                  Address
                  <input value={editForm.address} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} placeholder="Full address" />
                </label>
                <label>
                  Phone
                  <input type="tel" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+44 (0)…" />
                </label>
                <label>
                  Opening hours
                  <input value={editForm.opening_hours} onChange={(e) => setEditForm((f) => ({ ...f, opening_hours: e.target.value }))} placeholder="Mon–Fri 9–5" />
                </label>
              </div>
              <div className="admin-modal-form-section">
                <h3 className="admin-modal-form-section-title">Status</h3>
                <label className="admin-checkbox-label">
                  <input type="checkbox" checked={editForm.active} onChange={(e) => setEditForm((f) => ({ ...f, active: e.target.checked }))} />
                  Active (visible to customers and in stock take)
                </label>
              </div>
              <div className="admin-modal-actions">
                <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
                <button type="button" className="btn btn-outline" onClick={() => setEditingLocation(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
