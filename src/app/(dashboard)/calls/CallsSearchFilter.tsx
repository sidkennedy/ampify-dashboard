'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'queued', label: 'Queued' },
  { value: 'failed', label: 'Failed' },
]

interface Props {
  currentParams: { q?: string; status?: string; from?: string; to?: string }
  statusCounts: Record<string, number>
}

export default function CallsSearchFilter({ currentParams, statusCounts }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const updateParams = useCallback((updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    const merged = { ...currentParams, ...updates }
    Object.entries(merged).forEach(([k, v]) => {
      if (v && v !== 'all') params.set(k, v)
    })
    router.push(`${pathname}?${params.toString()}`)
  }, [currentParams, pathname, router])

  const activeStatus = currentParams.status || 'all'

  return (
    <div style={{ marginBottom: '1rem' }}>
      {/* Status tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.875rem', flexWrap: 'wrap' }}>
        {STATUS_OPTIONS.map(opt => {
          const count = statusCounts[opt.value] ?? 0
          const isActive = activeStatus === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => updateParams({ status: opt.value })}
              style={{
                padding: '0.4375rem 0.875rem',
                borderRadius: '9999px',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: 'pointer',
                border: isActive ? '1.5px solid #0D1117' : '1px solid #E5E7EB',
                background: isActive ? '#0D1117' : 'white',
                color: isActive ? 'white' : '#6B7280',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
              }}
            >
              {opt.label}
              <span style={{
                background: isActive ? 'rgba(255,255,255,0.2)' : '#F3F4F6',
                color: isActive ? 'white' : '#6B7280',
                borderRadius: '9999px',
                padding: '0 0.375rem',
                fontSize: '0.6875rem',
                fontWeight: 600,
                minWidth: '1.25rem',
                textAlign: 'center',
              }}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search + date filters */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
          <svg
            width="15" height="15" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"
            style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="input"
            style={{ paddingLeft: '2.25rem' }}
            placeholder="Search by patient name…"
            defaultValue={currentParams.q ?? ''}
            onChange={e => {
              const val = e.target.value
              // Debounce: wait for 400ms pause before navigating
              clearTimeout((window as any).__searchTimeout)
              ;(window as any).__searchTimeout = setTimeout(() => {
                updateParams({ q: val || undefined })
              }, 400)
            }}
          />
        </div>

        {/* From date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.8125rem', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap' }}>From</label>
          <input
            className="input"
            type="date"
            style={{ width: 150 }}
            defaultValue={currentParams.from ?? ''}
            onChange={e => updateParams({ from: e.target.value || undefined })}
          />
        </div>

        {/* To date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.8125rem', color: '#6B7280', fontWeight: 500 }}>To</label>
          <input
            className="input"
            type="date"
            style={{ width: 150 }}
            defaultValue={currentParams.to ?? ''}
            onChange={e => updateParams({ to: e.target.value || undefined })}
          />
        </div>

        {/* Clear filters */}
        {(currentParams.q || currentParams.status || currentParams.from || currentParams.to) && (
          <button
            onClick={() => router.push(pathname)}
            style={{ fontSize: '0.8125rem', color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', textDecoration: 'underline' }}
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
