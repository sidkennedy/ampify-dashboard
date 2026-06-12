'use client'

import { useState, useEffect, useRef } from 'react'
import { Claim, ClaimStatus, ServiceLineItem } from '@/types'

interface PayerOption { key: string; name: string; stediPayerId: string | null }

const STATUS: Record<ClaimStatus, { label: string; bg: string; color: string }> = {
  paid:         { label: 'Paid',         bg: '#DCFCE7', color: '#15803D' },
  denied:       { label: 'Denied',       bg: '#FEE2E2', color: '#B91C1C' },
  pending:      { label: 'Pending',      bg: '#FEF3C7', color: '#B45309' },
  acknowledged: { label: 'Acknowledged', bg: '#DBEAFE', color: '#1D4ED8' },
  not_found:    { label: 'Not found',    bg: '#F3F4F6', color: '#6B7280' },
  error:        { label: 'Error',        bg: '#FEE2E2', color: '#B91C1C' },
  unchecked:    { label: 'Not checked',  bg: '#F3F4F6', color: '#9CA3AF' },
}
const SUB: Record<string, { label: string; bg: string; color: string }> = {
  draft:     { label: 'Draft',     bg: '#F3F4F6', color: '#6B7280' },
  submitted: { label: 'Submitted', bg: '#DBEAFE', color: '#1D4ED8' },
  accepted:  { label: 'Accepted',  bg: '#DCFCE7', color: '#15803D' },
  rejected:  { label: 'Rejected',  bg: '#FEE2E2', color: '#B91C1C' },
  error:     { label: 'Error',     bg: '#FEE2E2', color: '#B91C1C' },
}
const money = (n: number | null) => (n == null ? '—' : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 })}`)
const emptyLine = (): ServiceLineItem => ({ procedureCode: '', chargeAmount: 0, units: 1, serviceDate: '', modifiers: [] })

interface Prefill { patientName?: string; patientDob?: string; memberId?: string }

export default function ClaimsClient({ initialClaims, canSubmit, canEra, prefill }: { initialClaims: Claim[]; canSubmit: boolean; canEra?: boolean; prefill?: Prefill | null }) {
  const [claims, setClaims] = useState<Claim[]>(initialClaims)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [eraMsg, setEraMsg] = useState('')

  async function checkAll() {
    setBusy('all'); setError(''); setEraMsg('')
    try {
      const res = await fetch('/api/claims/check-all', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setEraMsg(`Checked ${data.checked} — ${data.paid} paid · ${data.denied} denied · ${data.pending} pending · ${data.errors} errors.`)
      if (data.checked > 0) window.location.reload()
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed') } finally { setBusy(null) }
  }

  async function syncEra() {
    setBusy('era'); setError(''); setEraMsg('')
    try {
      const res = await fetch('/api/remittances/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setEraMsg(`Synced — ${data.erasFound} ERA(s) found, ${data.paymentsPosted} payment(s) posted.`)
      if (data.paymentsPosted > 0) window.location.reload()
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed') } finally { setBusy(null) }
  }
  const [open, setOpen] = useState(initialClaims.length === 0 || !!prefill)
  const [adding, setAdding] = useState(false)

  const [form, setForm] = useState({ patientName: prefill?.patientName ?? '', patientDob: prefill?.patientDob ?? '', gender: '', memberId: prefill?.memberId ?? '', serviceDateFrom: '', chargeAmount: '' })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const [dx, setDx] = useState('')
  const [lines, setLines] = useState<ServiceLineItem[]>([emptyLine()])
  const setLine = (i: number, k: keyof ServiceLineItem, v: string) =>
    setLines(ls => ls.map((l, j) => j === i ? { ...l, [k]: k === 'chargeAmount' || k === 'units' ? Number(v) : k === 'modifiers' ? v.split(',').map(s => s.trim()).filter(Boolean) : v } : l))

  // payer search
  const [payer, setPayer] = useState<PayerOption | null>(null)
  const [pq, setPq] = useState(''); const [pres, setPres] = useState<PayerOption[]>([]); const [pOpen, setPOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const t = setTimeout(() => { fetch(`/api/payers${pq ? `?q=${encodeURIComponent(pq)}` : ''}`).then(r => r.json()).then(d => setPres(d.payers ?? [])).catch(() => {}) }, pq ? 250 : 0)
    return () => clearTimeout(t)
  }, [pq])
  useEffect(() => {
    const h = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setPOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  async function addClaim(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!payer) { setError('Select the payer.'); return }
    setAdding(true)
    const cleanLines = lines.filter(l => l.procedureCode && l.serviceDate)
    try {
      const res = await fetch('/api/claims', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, payerStediId: payer.stediPayerId, payerName: payer.name,
          diagnosisCodes: dx.split(',').map(s => s.trim()).filter(Boolean),
          serviceLines: canSubmit ? cleanLines : [],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setClaims(c => [data.claim, ...c])
      setForm({ patientName: '', patientDob: '', gender: '', memberId: '', serviceDateFrom: '', chargeAmount: '' })
      setDx(''); setLines([emptyLine()]); setPayer(null); setPq(''); setOpen(false)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed') } finally { setAdding(false) }
  }

  async function act(id: string, kind: 'check' | 'submit') {
    setBusy(id + kind); setError('')
    try {
      const res = await fetch(`/api/claims/${id}/${kind}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      if (data.needsEnrollment) setError('This clinic’s NPI isn’t enrolled with Stedi for this yet — enroll it to go live.')
      setClaims(cs => cs.map(c => {
        if (c.id !== id) return c
        return kind === 'check'
          ? { ...c, status: data.status, status_detail: data.detail, paid_amount: data.paidAmount, last_checked_at: new Date().toISOString() }
          : { ...c, submission_status: data.status, submission_detail: data.detail, submitted_at: new Date().toISOString() }
      }))
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed') } finally { setBusy(null) }
  }

  // ── AR / denials overview (the value owners pay for) ───────────────────────
  const now = Date.now()
  const day = 86400000
  let outstanding = 0, paid = 0, deniedCount = 0, deniedAmt = 0
  const aging = { d030: 0, d3160: 0, d60: 0 }
  for (const c of claims) {
    const amt = Number(c.charge_amount) || 0
    paid += Number(c.paid_amount) || 0
    const isPaid = c.status === 'paid'
    const isDenied = c.status === 'denied' || c.submission_status === 'rejected'
    if (isDenied) { deniedCount++; deniedAmt += amt }
    if (!isPaid && !isDenied) {
      outstanding += amt
      const days = (now - new Date(c.service_date_from).getTime()) / day
      if (days <= 30) aging.d030 += amt
      else if (days <= 60) aging.d3160 += amt
      else aging.d60 += amt
    }
  }
  const m = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`

  return (
    <div>
      {/* AR overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Outstanding', value: m(outstanding), sub: `${claims.length} claims`, color: '#0D1117' },
          { label: 'Paid', value: m(paid), sub: 'collected', color: '#15803D' },
          { label: 'Denied', value: m(deniedAmt), sub: `${deniedCount} claims`, color: '#B91C1C' },
          { label: 'Aging (60+ days)', value: m(aging.d60), sub: `0–30: ${m(aging.d030)} · 31–60: ${m(aging.d3160)}`, color: aging.d60 > 0 ? '#B45309' : '#9CA3AF' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '1rem 1.125rem' }}>
            <p style={{ color: '#6B7280', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.375rem' }}>{s.label}</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</p>
            <p style={{ color: '#9CA3AF', fontSize: '0.6875rem', marginTop: '0.25rem' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
      {eraMsg && <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem' }}>{eraMsg}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '1rem' }}>
        {claims.some(c => c.status !== 'paid') && <button className="btn-secondary" onClick={checkAll} disabled={busy === 'all'}>{busy === 'all' ? 'Checking…' : '⟳ Check all'}</button>}
        {canEra && <button className="btn-secondary" onClick={syncEra} disabled={busy === 'era'}>{busy === 'era' ? 'Syncing…' : '⟳ Sync remittances'}</button>}
        <button className="btn-primary" onClick={() => setOpen(o => !o)}>{open ? 'Close' : (canSubmit ? '+ New claim' : '+ Track a claim')}</button>
      </div>

      {open && (
        <form onSubmit={addClaim} className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '1rem' }}>{canSubmit ? 'New claim' : 'Track a claim'}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.875rem' }}>
            <div><label className="label">Patient name *</label><input className="input" value={form.patientName} onChange={e => set('patientName', e.target.value)} required /></div>
            <div><label className="label">Date of birth</label><input className="input" type="date" value={form.patientDob} onChange={e => set('patientDob', e.target.value)} /></div>
            <div><label className="label">Member ID *</label><input className="input" value={form.memberId} onChange={e => set('memberId', e.target.value)} required /></div>
            <div ref={boxRef} style={{ position: 'relative' }}>
              <label className="label">Payer *</label>
              {payer ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', border: '2px solid #2563EB', background: '#EFF6FF', borderRadius: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1D4ED8' }}>{payer.name}</span>
                  <button type="button" onClick={() => { setPayer(null); setPq('') }} style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', fontSize: '0.8125rem' }}>Change</button>
                </div>
              ) : (
                <>
                  <input className="input" placeholder="Search payer…" value={pq} onChange={e => { setPq(e.target.value); setPOpen(true) }} onFocus={() => setPOpen(true)} />
                  {pOpen && pres.length > 0 && (
                    <div style={{ position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, marginTop: 4, background: 'white', border: '1px solid #E5E7EB', borderRadius: '0.5rem', maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
                      {pres.filter(p => p.stediPayerId).map(p => (
                        <button key={p.key} type="button" onClick={() => { setPayer(p); setPOpen(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', background: 'none', border: 'none', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', fontSize: '0.8125rem' }}>{p.name}</button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div><label className="label">Date of service *</label><input className="input" type="date" value={form.serviceDateFrom} onChange={e => set('serviceDateFrom', e.target.value)} required /></div>
            {!canSubmit && <div><label className="label">Charge amount</label><input className="input" type="number" step="0.01" placeholder="0.00" value={form.chargeAmount} onChange={e => set('chargeAmount', e.target.value)} /></div>}
          </div>

          {/* Submission details — only when claims submission is enabled */}
          {canSubmit && (
            <div style={{ marginTop: '1.25rem', borderTop: '1px solid #F3F4F6', paddingTop: '1.25rem' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.625rem' }}>Claim details (for submission)</div>
              <div style={{ marginBottom: '0.875rem', maxWidth: 360 }}>
                <label className="label">Diagnosis codes (ICD-10, comma-separated)</label>
                <input className="input" placeholder="e.g. H90.3, H93.25" value={dx} onChange={e => setDx(e.target.value)} style={{ fontFamily: 'monospace' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.7fr 0.7fr 1.2fr auto', gap: '0.5rem', fontSize: '0.7rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: '0.375rem' }}>
                <span>CPT/HCPCS</span><span>Modifiers</span><span>Units</span><span>Charge</span><span>Date</span><span></span>
              </div>
              {lines.map((l, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.7fr 0.7fr 1.2fr auto', gap: '0.5rem', marginBottom: '0.375rem', alignItems: 'center' }}>
                  <input className="input" placeholder="92557" value={l.procedureCode} onChange={e => setLine(i, 'procedureCode', e.target.value)} style={{ fontFamily: 'monospace' }} />
                  <input className="input" placeholder="—" value={(l.modifiers ?? []).join(',')} onChange={e => setLine(i, 'modifiers', e.target.value)} />
                  <input className="input" type="number" value={l.units} onChange={e => setLine(i, 'units', e.target.value)} />
                  <input className="input" type="number" step="0.01" placeholder="0.00" value={l.chargeAmount || ''} onChange={e => setLine(i, 'chargeAmount', e.target.value)} />
                  <input className="input" type="date" value={l.serviceDate} onChange={e => setLine(i, 'serviceDate', e.target.value)} />
                  <button type="button" onClick={() => setLines(ls => ls.length > 1 ? ls.filter((_, j) => j !== i) : ls)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '1.25rem' }}>×</button>
                </div>
              ))}
              <button type="button" onClick={() => setLines(ls => [...ls, emptyLine()])} style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, marginTop: '0.25rem' }}>+ Add line</button>
            </div>
          )}

          <div style={{ marginTop: '1.25rem' }}>
            <button className="btn-primary" type="submit" disabled={adding}>{adding ? 'Saving…' : (canSubmit ? 'Save claim' : 'Add claim')}</button>
          </div>
        </form>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {claims.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>No claims yet. Add one above.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              {['Patient', 'Payer', 'Service date', 'Charge', ...(canSubmit ? ['Submission'] : []), 'Status', 'Paid', 'Actions'].map(h => <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {claims.map(c => {
                const s = STATUS[c.status] ?? STATUS.unchecked
                const sub = c.submission_status ? SUB[c.submission_status] : null
                const hasLines = Array.isArray(c.service_lines) && c.service_lines.length > 0
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0D1117' }}>{c.patient_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#9CA3AF', fontFamily: 'monospace' }}>{c.member_id}</div>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', color: '#374151' }}>{c.payer_name ?? c.payer_stedi_id}</td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', color: '#374151' }}>{c.service_date_from}</td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', color: '#374151' }}>{money(c.charge_amount)}</td>
                    {canSubmit && (
                      <td style={{ padding: '0.875rem 1rem' }}>
                        {sub ? <span style={{ background: sub.bg, color: sub.color, borderRadius: '0.375rem', padding: '0.125rem 0.5rem', fontSize: '0.75rem', fontWeight: 600 }}>{sub.label}</span> : <span style={{ color: '#D1D5DB' }}>—</span>}
                      </td>
                    )}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <span style={{ background: s.bg, color: s.color, borderRadius: '0.375rem', padding: '0.125rem 0.5rem', fontSize: '0.75rem', fontWeight: 600 }}>{s.label}</span>
                      {c.status_detail && <div style={{ fontSize: '0.6875rem', color: '#9CA3AF', marginTop: '0.25rem', maxWidth: 160 }}>{c.status_detail}</div>}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', fontWeight: 600, color: c.paid_amount ? '#15803D' : '#9CA3AF' }}>{money(c.paid_amount)}</td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        {canSubmit && hasLines && c.submission_status !== 'accepted' && (
                          <button onClick={() => act(c.id, 'submit')} disabled={busy === c.id + 'submit'} className="btn-primary" style={{ fontSize: '0.75rem', padding: '0.375rem 0.625rem' }}>{busy === c.id + 'submit' ? '…' : 'Submit'}</button>
                        )}
                        <button onClick={() => act(c.id, 'check')} disabled={busy === c.id + 'check'} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.375rem 0.625rem' }}>{busy === c.id + 'check' ? '…' : 'Check status'}</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
