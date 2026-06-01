'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminActions() {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', npi: '', tax_id: '', address: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function createClinic() {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) return
    setSaving(true)
    setMsg('')
    const res = await fetch('/api/admin/clinics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      setMsg(`Error: ${data.error}`)
    } else {
      setMsg('Clinic created! Send them their email and password directly.')
      setForm({ name: '', email: '', password: '', npi: '', tax_id: '', address: '' })
      router.refresh()
      setTimeout(() => { setShowCreate(false); setMsg('') }, 4000)
    }
  }

  return (
    <div>
      <button className="btn-primary" style={{ fontSize: '0.8125rem' }} onClick={() => setShowCreate(s => !s)}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add Clinic
      </button>

      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }} onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}>
          <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0D1117', marginBottom: '0.375rem' }}>Create New Clinic</h3>
            <p style={{ color: '#6B7280', fontSize: '0.8125rem', marginBottom: '1.5rem' }}>
              You'll send them their login details directly — no invite email.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="label">Clinic Name *</label>
                <input className="input" placeholder="Hearing Care Clinic" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="label">Admin Email *</label>
                  <input className="input" type="email" placeholder="admin@clinic.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Password *</label>
                  <input className="input" type="text" placeholder="Set their password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                </div>
              </div>

              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.8125rem', color: '#15803D' }}>
                💡 After creating, just text or email them: <em>their email + this password</em>. They can change it in Settings later.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="label">Provider NPI</label>
                  <input className="input" placeholder="1234567890" value={form.npi} onChange={e => setForm(f => ({ ...f, npi: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Tax ID (EIN)</label>
                  <input className="input" placeholder="XX-XXXXXXX" value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="label">Clinic Address</label>
                <input className="input" placeholder="123 Main St, City, ST 12345" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
            </div>

            {msg && (
              <p style={{ fontSize: '0.875rem', color: msg.startsWith('Error') ? '#DC2626' : '#16A34A', fontWeight: 500, marginTop: '1rem' }}>{msg}</p>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button
                className="btn-primary"
                onClick={createClinic}
                disabled={saving || !form.name.trim() || !form.email.trim() || !form.password.trim()}
              >
                {saving ? 'Creating…' : 'Create Clinic'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
