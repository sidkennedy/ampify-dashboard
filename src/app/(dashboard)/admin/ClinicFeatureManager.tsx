'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FEATURES, type ClinicFeatures } from '@/lib/features'

interface ClinicLite { id: string; name: string; features: ClinicFeatures | null }

const STAGE: Record<string, { label: string; bg: string; color: string }> = {
  live: { label: 'Live', bg: '#DCFCE7', color: '#15803D' },
  beta: { label: 'Beta', bg: '#DBEAFE', color: '#1D4ED8' },
  planned: { label: 'Planned', bg: '#F3F4F6', color: '#6B7280' },
}

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      style={{
        width: 40, height: 22, borderRadius: 9999, border: 'none', cursor: disabled ? 'default' : 'pointer',
        background: on ? '#16A34A' : '#D1D5DB', position: 'relative', transition: 'background 0.15s', flexShrink: 0, opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left 0.15s' }} />
    </button>
  )
}

export default function ClinicFeatureManager({ clinics }: { clinics: ClinicLite[] }) {
  const supabase = createClient()
  const [state, setState] = useState<Record<string, ClinicFeatures>>(
    () => Object.fromEntries(clinics.map(c => [c.id, c.features ?? {}])),
  )
  const [savedFlash, setSavedFlash] = useState<string | null>(null)

  async function toggle(clinicId: string, key: string) {
    const next = { ...(state[clinicId] ?? {}), [key]: !state[clinicId]?.[key] }
    setState(s => ({ ...s, [clinicId]: next }))
    const { error } = await supabase.from('clinics').update({ features: next }).eq('id', clinicId)
    if (!error) { setSavedFlash(clinicId + key); setTimeout(() => setSavedFlash(null), 1200) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {clinics.map(c => (
        <div key={c.id} className="card">
          <div style={{ fontWeight: 600, color: '#0D1117', fontSize: '0.9375rem', marginBottom: '0.875rem' }}>{c.name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem 1.5rem' }}>
            {FEATURES.map(f => {
              const on = f.base || !!state[c.id]?.[f.key]
              const st = STAGE[f.stage]
              return (
                <div key={f.key} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', padding: '0.625rem 0', borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#0D1117' }}>{f.name}</span>
                      <span style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', borderRadius: 4, padding: '0.0625rem 0.3125rem', background: st.bg, color: st.color }}>{st.label}</span>
                      {f.base && <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#9CA3AF' }}>· included</span>}
                      {f.needsEnrollment && <span style={{ fontSize: '0.625rem', color: '#B45309' }}>· needs enrollment</span>}
                      {savedFlash === c.id + f.key && <span style={{ fontSize: '0.6875rem', color: '#16A34A', fontWeight: 600 }}>saved</span>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.125rem' }}>{f.description}</div>
                  </div>
                  <Toggle on={on} disabled={f.base} onClick={() => toggle(c.id, f.key)} />
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
