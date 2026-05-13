import { type FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import MarketingHeader from '@/components/MarketingHeader'
import { supabase } from '@/lib/supabase'

type DocSlot = 'proof_trade' | 'photo_id' | 'proof_address' | 'references'

const DOC_LABELS: Record<DocSlot, string> = {
  proof_trade: 'Proof of company trade (PDF/JPG/PNG)',
  photo_id: 'Director/owner photo ID',
  proof_address: 'Proof of address',
  references: 'Optional trade references',
}

const REGION_OPTIONS: { id: string; label: string }[] = [
  { id: 'kirkby', label: 'Kirkby-in-Ashfield (Nottinghamshire — head office & loading)' },
  { id: 'lamtek-complete', label: 'Lamtek Complete trade kitchens (same site)' },
  { id: 'tealbury', label: 'Tealbury made-to-order (Lamtek group)' },
  { id: 'uk-wide', label: 'UK-wide delivery (no fixed depot)' },
]

/** Sanitises a filename for Supabase Storage paths (ASCII, no path separators). */
function sanitiseFilename(name: string): string {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : ''
  const base = name.slice(0, name.length - ext.length).replace(/[^a-z0-9_-]+/gi, '-').slice(0, 60) || 'file'
  return `${base}${ext.toLowerCase()}`
}

export default function CreateAccount() {
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    companyNumber: '',
    vatNumber: '',
    tradeType: '',
    address1: '',
    city: '',
    postcode: '',
    deliveryRegions: [] as string[],
    consent: false,
  })

  const [files, setFiles] = useState<Record<DocSlot, File | null>>({
    proof_trade: null,
    photo_id: null,
    proof_address: null,
    references: null,
  })

  const completion = useMemo(() => Math.round((step / 4) * 100), [step])

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function setFile(slot: DocSlot, file: File | null) {
    setFiles((prev) => ({ ...prev, [slot]: file }))
  }

  function toggleRegion(region: string) {
    update(
      'deliveryRegions',
      form.deliveryRegions.includes(region)
        ? form.deliveryRegions.filter((r) => r !== region)
        : [...form.deliveryRegions, region],
    )
  }

  function validateStep1(): string | null {
    if (!form.companyName.trim()) return 'Company name is required.'
    if (!form.contactName.trim()) return 'Contact name is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Enter a valid email address.'
    if (!form.phone.trim()) return 'Phone is required.'
    return null
  }

  function validateStep2(): string | null {
    if (!form.companyNumber.trim()) return 'Company number is required.'
    if (!form.tradeType) return 'Select your trade type.'
    if (!form.address1.trim()) return 'Address is required.'
    if (!form.city.trim()) return 'City is required.'
    if (!form.postcode.trim()) return 'Postcode is required.'
    return null
  }

  function validateStep3(): string | null {
    if (!files.proof_trade) return 'Upload proof of company trade.'
    if (!files.photo_id) return 'Upload director/owner photo ID.'
    if (!files.proof_address) return 'Upload proof of address.'
    return null
  }

  function validateStep4(): string | null {
    if (!form.consent) return 'Please confirm the application is accurate and consent to verification checks.'
    return null
  }

  function next() {
    setError('')
    const stepError =
      step === 1 ? validateStep1() :
      step === 2 ? validateStep2() :
      step === 3 ? validateStep3() :
      null
    if (stepError) {
      setError(stepError)
      return
    }
    setStep((s) => Math.min(4, s + 1))
  }

  function back() {
    setError('')
    setStep((s) => Math.max(1, s - 1))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const stepError = validateStep1() || validateStep2() || validateStep3() || validateStep4()
    if (stepError) {
      setError(stepError)
      return
    }

    setSubmitting(true)
    try {
      const submittedAt = new Date().toISOString().replace(/[:.]/g, '-')
      const safeEmail = form.email.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '_')
      const dirPrefix = `${safeEmail}/${submittedAt}`

      const uploadedPaths: Partial<Record<DocSlot, string>> = {}
      for (const slot of Object.keys(files) as DocSlot[]) {
        const file = files[slot]
        if (!file) continue
        const path = `${dirPrefix}/${slot}-${sanitiseFilename(file.name)}`
        const { error: upErr } = await supabase.storage
          .from('account-applications')
          .upload(path, file, {
            contentType: file.type || undefined,
            upsert: false,
          })
        if (upErr) {
          throw new Error(`Could not upload "${DOC_LABELS[slot]}": ${upErr.message}`)
        }
        uploadedPaths[slot] = path
      }

      const { error: insertErr } = await supabase.from('account_applications').insert({
        email: form.email.trim().toLowerCase(),
        company_name: form.companyName.trim(),
        contact_name: form.contactName.trim(),
        phone: form.phone.trim(),
        company_number: form.companyNumber.trim() || null,
        vat_number: form.vatNumber.trim() || null,
        trade_type: form.tradeType || null,
        address1: form.address1.trim() || null,
        city: form.city.trim() || null,
        postcode: form.postcode.trim() || null,
        delivery_regions: form.deliveryRegions,
        document_paths: uploadedPaths,
      })

      if (insertErr) throw new Error(insertErr.message)

      setSubmitted(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not submit application. Please try again.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="marketing-site">
      <MarketingHeader />

      <main className="marketing-main">
        <section className="card">
          <h1>Create a Lamtek account</h1>
          <p className="page-intro">
            Complete this quick application to open a trade account. Upload supporting documents so our team can verify and activate access faster.
          </p>
          {!submitted && (
            <>
              <div className="account-open-progress" aria-label="Application progress">
                <div className="account-open-progress-bar" style={{ width: `${completion}%` }} />
              </div>
              <p className="account-open-step-label">Step {step} of 4</p>
            </>
          )}
        </section>

        {!submitted ? (
          <form className="card account-open-form" onSubmit={submit} noValidate>
            {error && <div className="login-error" role="alert">{error}</div>}

            {step === 1 && (
              <div className="account-open-grid">
                <label>Company name<input value={form.companyName} onChange={(e) => update('companyName', e.target.value)} required /></label>
                <label>Contact name<input value={form.contactName} onChange={(e) => update('contactName', e.target.value)} required /></label>
                <label>Email<input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required autoComplete="email" /></label>
                <label>Phone<input value={form.phone} onChange={(e) => update('phone', e.target.value)} required autoComplete="tel" /></label>
              </div>
            )}

            {step === 2 && (
              <div className="account-open-grid">
                <label>Company number<input value={form.companyNumber} onChange={(e) => update('companyNumber', e.target.value)} required /></label>
                <label>VAT number<input value={form.vatNumber} onChange={(e) => update('vatNumber', e.target.value)} /></label>
                <label>Trade type
                  <select value={form.tradeType} onChange={(e) => update('tradeType', e.target.value)} required>
                    <option value="">Select trade type</option>
                    <option value="kitchen-retailer">Kitchen retailer</option>
                    <option value="bedroom-retailer">Bedroom retailer</option>
                    <option value="joinery">Joinery / manufacturer</option>
                    <option value="contractor">Contractor / installer</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label>Address line 1<input value={form.address1} onChange={(e) => update('address1', e.target.value)} required autoComplete="street-address" /></label>
                <label>City<input value={form.city} onChange={(e) => update('city', e.target.value)} required autoComplete="address-level2" /></label>
                <label>Postcode<input value={form.postcode} onChange={(e) => update('postcode', e.target.value)} required autoComplete="postal-code" /></label>
              </div>
            )}

            {step === 3 && (
              <div className="account-open-grid">
                {(Object.keys(DOC_LABELS) as DocSlot[]).map((slot) => (
                  <label key={slot}>
                    {DOC_LABELS[slot]}
                    {slot !== 'references' && <span className="required"> *</span>}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
                      onChange={(e) => setFile(slot, e.target.files?.[0] ?? null)}
                    />
                    {files[slot] && (
                      <span className="admin-muted" style={{ display: 'block', fontSize: '0.85em' }}>
                        Selected: {files[slot]!.name}
                      </span>
                    )}
                  </label>
                ))}
                <p className="admin-muted" style={{ gridColumn: '1 / -1' }}>
                  Files stay private and are only visible to Lamtek staff reviewing your application. Max 10&nbsp;MB per file (PDF, JPG, PNG, WebP, HEIC).
                </p>
              </div>
            )}

            {step === 4 && (
              <div className="account-open-grid">
                <fieldset className="account-open-fieldset">
                  <legend>Preferred servicing depots / regions</legend>
                  {REGION_OPTIONS.map((r) => (
                    <label key={r.id}>
                      <input
                        type="checkbox"
                        checked={form.deliveryRegions.includes(r.id)}
                        onChange={() => toggleRegion(r.id)}
                      />
                      {r.label}
                    </label>
                  ))}
                </fieldset>
                <label className="account-open-consent">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={(e) => update('consent', e.target.checked)}
                    required
                  />
                  I confirm these details are accurate and I consent to account verification checks.
                </label>
              </div>
            )}

            <div className="marketing-hero-actions">
              {step > 1 && (
                <button type="button" className="btn btn-outline" onClick={back} disabled={submitting}>
                  Back
                </button>
              )}
              {step < 4 ? (
                <button type="button" className="btn" onClick={next} disabled={submitting}>
                  Continue
                </button>
              ) : (
                <button type="submit" className="btn" disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit application'}
                </button>
              )}
              <Link to="/login" className="btn btn-ghost">Already have an account?</Link>
            </div>
          </form>
        ) : (
          <section className="card">
            <h2>Application submitted</h2>
            <p>
              Thanks, {form.contactName || 'there'}. We have received your application for{' '}
              <strong>{form.companyName}</strong> and the supporting documents are queued for review.
            </p>
            <p>
              Our team will verify your details and contact you on{' '}
              <a href={`mailto:${form.email}`}>{form.email}</a> once your trade account is activated — typically within
              one working day.
            </p>
            <div className="marketing-hero-actions">
              <Link to="/login" className="btn">Go to login</Link>
              <Link to="/" className="btn btn-outline">Return to homepage</Link>
            </div>
          </section>
        )}

        <section className="card">
          <h2>What we verify</h2>
          <div className="marketing-process-grid">
            <div>
              <h3>Business credentials</h3>
              <p>Company registration, trade profile, and relevant operating details.</p>
            </div>
            <div>
              <h3>Identity and address</h3>
              <p>Primary account owner verification and trading address validation.</p>
            </div>
            <div>
              <h3>Depot alignment</h3>
              <p>We set your account to the most suitable depot and support channel.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
