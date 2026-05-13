import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { lamtekPortalLocations } from '@/lib/lamtekLocations'
import type { LocationRow } from '@/types/database'

export default function Depots() {
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [loading, setLoading] = useState(true)
  const displayLocations = useMemo(() => lamtekPortalLocations(locations), [locations])

  useEffect(() => {
    supabase
      .from('locations')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .order('name')
      .then(({ data }) => {
        setLocations(data ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="depots-page page">
      <div className="depots-header">
        <h1 className="depots-title">Depots &amp; locations</h1>
        <p className="depots-intro">
          Lamtek is headquartered at Wolsey Drive, Kirkby-in-Ashfield, Nottinghamshire (NG17 7JR), with manufacturing on
          site. Collection and loading follow published hours — see{' '}
          <a href="https://www.lamtek.co.uk/contact" target="_blank" rel="noreferrer">
            lamtek.co.uk/contact
          </a>{' '}
          and the in-portal{' '}
          <Link to="/site/depots-details">Lamtek / Lamtek Complete contact sheet</Link>.           Depots below come from your live account database (Lamtek Ltd, Lamtek Complete, Tealbury, and any extra sites
          your team configures). Apply the latest Supabase migrations so legacy depot names are replaced with current
          Lamtek group sites.
        </p>
      </div>
      {loading ? (
        <p className="muted">Loading…</p>
      ) : displayLocations.length === 0 ? (
        <div className="card">
          <p className="muted">Depot information will appear here. Contact Lamtek for details.</p>
        </div>
      ) : (
        <div className="depots-grid">
          {displayLocations.map((loc) => (
            <div key={loc.id} className="card depots-card">
              <h2 className="depots-card-name">{loc.name}</h2>
              {loc.code && <span className="depots-card-code">{loc.code}</span>}
              {loc.address && (
                <p className="depots-card-address">
                  <strong>Address</strong><br />
                  {loc.address}
                </p>
              )}
              {loc.phone && (
                <p className="depots-card-phone">
                  <strong>Phone</strong>{' '}
                  <a href={`tel:${loc.phone.replace(/\s/g, '')}`}>{loc.phone}</a>
                </p>
              )}
              {loc.opening_hours && (
                <p className="depots-card-hours">
                  <strong>Opening hours</strong><br />
                  {loc.opening_hours}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="depots-footer card">
        <p className="muted">
          For online ordering, quotes, price lists, and brochures, use this portal. Need access? Contact{' '}
          <a href="mailto:info@lamtek.co.uk">info@lamtek.co.uk</a> or{' '}
          <a href="tel:01623759856">01623 759 856</a>.
        </p>
      </div>
    </div>
  )
}
