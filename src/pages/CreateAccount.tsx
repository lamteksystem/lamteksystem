import { type FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import MarketingHeader from '@/components/MarketingHeader'

export default function CreateAccount() {
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
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
  })

  const completion = useMemo(() => Math.round((step / 4) * 100), [step])

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleRegion(region: string) {
    update(
      'deliveryRegions',
      form.deliveryRegions.includes(region)
        ? form.deliveryRegions.filter((r) => r !== region)
        : [...form.deliveryRegions, region]
    )
  }

  function next() {
    setStep((s) => Math.min(4, s + 1))
  }

  function back() {
    setStep((s) => Math.max(1, s - 1))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
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
          <div className="account-open-progress" aria-label="Application progress">
            <div className="account-open-progress-bar" style={{ width: `${completion}%` }} />
          </div>
          <p className="account-open-step-label">Step {step} of 4</p>
        </section>

        {!submitted ? (
          <form className="card account-open-form" onSubmit={submit}>
            {step === 1 && (
              <div className="account-open-grid">
                <label>Company name<input value={form.companyName} onChange={(e) => update('companyName', e.target.value)} required /></label>
                <label>Contact name<input value={form.contactName} onChange={(e) => update('contactName', e.target.value)} required /></label>
                <label>Email<input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required /></label>
                <label>Phone<input value={form.phone} onChange={(e) => update('phone', e.target.value)} required /></label>
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
                  </select>
                </label>
                <label>Address line 1<input value={form.address1} onChange={(e) => update('address1', e.target.value)} required /></label>
                <label>City<input value={form.city} onChange={(e) => update('city', e.target.value)} required /></label>
                <label>Postcode<input value={form.postcode} onChange={(e) => update('postcode', e.target.value)} required /></label>
              </div>
            )}

            {step === 3 && (
              <div className="account-open-grid">
                <label>Proof of company trade (PDF/JPG/PNG)<input type="file" accept=".pdf,.jpg,.jpeg,.png" required /></label>
                <label>Director/owner photo ID<input type="file" accept=".pdf,.jpg,.jpeg,.png" required /></label>
                <label>Proof of address<input type="file" accept=".pdf,.jpg,.jpeg,.png" required /></label>
                <label>Optional trade references<input type="file" accept=".pdf,.jpg,.jpeg,.png" /></label>
              </div>
            )}

            {step === 4 && (
              <div className="account-open-grid">
                <fieldset className="account-open-fieldset">
                  <legend>Preferred servicing depots/regions</legend>
                  <label><input type="checkbox" checked={form.deliveryRegions.includes('rochdale')} onChange={() => toggleRegion('rochdale')} /> Rochdale (Head Office)</label>
                  <label><input type="checkbox" checked={form.deliveryRegions.includes('cookstown')} onChange={() => toggleRegion('cookstown')} /> Cookstown</label>
                  <label><input type="checkbox" checked={form.deliveryRegions.includes('dublin')} onChange={() => toggleRegion('dublin')} /> Dublin</label>
                </fieldset>
                <label className="account-open-consent">
                  <input type="checkbox" required /> I confirm these details are accurate and I consent to account verification checks.
                </label>
              </div>
            )}

            <div className="marketing-hero-actions">
              {step > 1 && <button type="button" className="btn btn-outline" onClick={back}>Back</button>}
              {step < 4 ? (
                <button type="button" className="btn" onClick={next}>Continue</button>
              ) : (
                <button type="submit" className="btn">Submit application</button>
              )}
              <Link to="/login" className="btn btn-ghost">Already have an account?</Link>
            </div>
          </form>
        ) : (
          <section className="card">
            <h2>Application submitted</h2>
            <p>
              Thanks, {form.contactName || 'there'}. Our team will review your documents and contact you after verification to activate your online ordering access.
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
