'use client'

import { useState } from 'react'
import { Template, Profile, Clinic } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  profile: any
  clinic: Clinic | null
  templates: Template[]
  staff: any[]
  userId: string
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#0D1117' }}>{title}</h2>
      {description && <p style={{ color: '#6B7280', fontSize: '0.8125rem', marginTop: '0.25rem' }}>{description}</p>}
    </div>
  )
}

export default function SettingsForms({ profile, clinic, templates: initialTemplates, staff, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()

  // ── Clinic settings ──────────────────────────────────────────────────────
  const [clinicForm, setClinicForm] = useState({
    name: clinic?.name ?? '',
    npi: clinic?.npi ?? '',
    tax_id: clinic?.tax_id ?? '',
    address: clinic?.address ?? '',
  })
  const [clinicSaving, setClinicSaving] = useState(false)
  const [clinicMsg, setClinicMsg] = useState('')

  async function saveClinic() {
    setClinicSaving(true)
    setClinicMsg('')
    const { error } = await supabase
      .from('clinics')
      .update(clinicForm)
      .eq('id', clinic?.id ?? '')
    setClinicSaving(false)
    setClinicMsg(error ? `Error: ${error.message}` : 'Saved!')
    if (!error) router.refresh()
    setTimeout(() => setClinicMsg(''), 3000)
  }

  // ── My profile ────────────────────────────────────────────────────────────
  const [nameForm, setNameForm] = useState(profile?.full_name ?? '')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameMsg, setNameMsg] = useState('')

  async function saveName() {
    setNameSaving(true)
    setNameMsg('')
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: nameForm })
      .eq('id', userId)
    setNameSaving(false)
    setNameMsg(error ? `Error: ${error.message}` : 'Saved!')
    if (!error) router.refresh()
    setTimeout(() => setNameMsg(''), 3000)
  }

  // ── Templates ─────────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<Template[]>(initialTemplates)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateCodes, setNewTemplateCodes] = useState('')
  const [templateSaving, setTemplateSaving] = useState(false)
  const [templateMsg, setTemplateMsg] = useState('')

  async function createTemplate() {
    if (!newTemplateName.trim() || !newTemplateCodes.trim()) return
    setTemplateSaving(true)
    setTemplateMsg('')
    const { data, error } = await supabase
      .from('templates')
      .insert({ name: newTemplateName.trim(), codes_requested: newTemplateCodes.trim(), clinic_id: clinic?.id ?? '' })
      .select()
      .single()
    setTemplateSaving(false)
    if (error) {
      setTemplateMsg(`Error: ${error.message}`)
    } else {
      setTemplates(t => [...t, data])
      setNewTemplateName('')
      setNewTemplateCodes('')
      setTemplateMsg('Template created!')
    }
    setTimeout(() => setTemplateMsg(''), 3000)
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template?')) return
    const { error } = await supabase.from('templates').delete().eq('id', id)
    if (!error) setTemplates(t => t.filter(x => x.id !== id))
  }

  // ── Invite ────────────────────────────────────────────────────────────────
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'staff' | 'admin'>('staff')
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

  async function sendInvite() {
    if (!inviteEmail.trim()) return
    setInviteSending(true)
    setInviteMsg('')
    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
    })
    const data = await res.json()
    setInviteSending(false)
    if (!res.ok) {
      setInviteMsg(`Error: ${data.error}`)
    } else {
      setInviteMsg('Invite sent! They\'ll receive an email to set up their account.')
      setInviteEmail('')
    }
    setTimeout(() => setInviteMsg(''), 6000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* ── Clinic Info ── */}
      <div className="card">
        <SectionHeader title="Clinic Information" description="This info is pre-filled when starting a new call." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label className="label">Clinic Name</label>
            <input className="input" value={clinicForm.name} onChange={e => setClinicForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Clinic Address</label>
            <input className="input" placeholder="123 Main St, City, ST 12345" value={clinicForm.address} onChange={e => setClinicForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div>
            <label className="label">Provider NPI</label>
            <input className="input" placeholder="1234567890" value={clinicForm.npi} onChange={e => setClinicForm(f => ({ ...f, npi: e.target.value }))} />
          </div>
          <div>
            <label className="label">Tax ID (EIN)</label>
            <input className="input" placeholder="XX-XXXXXXX" value={clinicForm.tax_id} onChange={e => setClinicForm(f => ({ ...f, tax_id: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.25rem' }}>
          <button className="btn-primary" onClick={saveClinic} disabled={clinicSaving}>
            {clinicSaving ? 'Saving…' : 'Save Changes'}
          </button>
          {clinicMsg && (
            <span style={{ fontSize: '0.875rem', color: clinicMsg.startsWith('Error') ? '#DC2626' : '#16A34A', fontWeight: 500 }}>
              {clinicMsg}
            </span>
          )}
        </div>
      </div>

      {/* ── My Profile ── */}
      <div className="card">
        <SectionHeader title="My Profile" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label className="label">Full Name</label>
            <input className="input" value={nameForm} onChange={e => setNameForm(e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" value={profile?.email ?? ''} disabled style={{ color: '#9CA3AF', cursor: 'not-allowed' }} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.25rem' }}>
          <button className="btn-primary" onClick={saveName} disabled={nameSaving}>
            {nameSaving ? 'Saving…' : 'Save Name'}
          </button>
          {nameMsg && (
            <span style={{ fontSize: '0.875rem', color: nameMsg.startsWith('Error') ? '#DC2626' : '#16A34A', fontWeight: 500 }}>
              {nameMsg}
            </span>
          )}
        </div>
      </div>

      {/* ── Code Templates ── */}
      <div className="card">
        <SectionHeader title="Code Templates" description="Save common CPT/HCPCS code sets so you can apply them in one click when starting a call." />

        {/* Existing templates */}
        {templates.length > 0 && (
          <div style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {templates.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#F9FAFB', borderRadius: '0.5rem', border: '1px solid #E5E7EB' }}>
                <div>
                  <span style={{ fontWeight: 600, color: '#0D1117', fontSize: '0.875rem' }}>{t.name}</span>
                  <span style={{ marginLeft: '0.75rem', color: '#6B7280', fontSize: '0.8125rem', fontFamily: 'monospace' }}>{t.codes_requested}</span>
                </div>
                <button
                  onClick={() => deleteTemplate(t.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '0.25rem', borderRadius: '0.375rem', transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#DC2626')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
                  title="Delete template"
                >
                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new template */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div>
            <label className="label">Template Name</label>
            <input className="input" placeholder="e.g. Audiology Standard" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} />
          </div>
          <div>
            <label className="label">CPT / HCPCS Codes</label>
            <input className="input" placeholder="92557, 92550, 92628" value={newTemplateCodes} onChange={e => setNewTemplateCodes(e.target.value)} />
          </div>
          <button
            className="btn-primary"
            onClick={createTemplate}
            disabled={templateSaving || !newTemplateName.trim() || !newTemplateCodes.trim()}
          >
            {templateSaving ? 'Adding…' : 'Add Template'}
          </button>
        </div>

        {templateMsg && (
          <p style={{ fontSize: '0.875rem', color: templateMsg.startsWith('Error') ? '#DC2626' : '#16A34A', fontWeight: 500, marginTop: '0.75rem' }}>
            {templateMsg}
          </p>
        )}
      </div>

      {/* ── Team ── */}
      <div className="card">
        <SectionHeader title="Team Members" description="Invite staff to your clinic account. They'll get an email to set their password." />

        {/* Staff list */}
        {staff.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  {['Name', 'Email', 'Role', 'Joined'].map(h => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map(member => (
                  <tr key={member.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem', fontWeight: 500, color: '#0D1117' }}>
                      {member.full_name ?? '—'}
                      {member.id === userId && <span style={{ marginLeft: '0.5rem', fontSize: '0.6875rem', color: '#9CA3AF', fontWeight: 400 }}>(you)</span>}
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#374151' }}>{member.email ?? '—'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className={`badge ${member.role === 'admin' ? 'badge-purple' : 'badge-gray'}`}>{member.role}</span>
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.8125rem', color: '#9CA3AF' }}>
                      {member.created_at ? new Date(member.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Invite form */}
        <div>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.875rem' }}>Invite a new team member</p>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div>
              <label className="label">Email Address</label>
              <input
                className="input"
                type="email"
                placeholder="colleague@clinic.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendInvite()}
              />
            </div>
            <div>
              <label className="label">Role</label>
              <select
                className="input"
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as 'staff' | 'admin')}
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              className="btn-primary"
              onClick={sendInvite}
              disabled={inviteSending || !inviteEmail.trim()}
            >
              {inviteSending ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
          {inviteMsg && (
            <p style={{ fontSize: '0.875rem', color: inviteMsg.startsWith('Error') ? '#DC2626' : '#16A34A', fontWeight: 500, marginTop: '0.75rem' }}>
              {inviteMsg}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
