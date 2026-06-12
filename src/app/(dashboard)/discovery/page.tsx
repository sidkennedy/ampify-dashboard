import DiscoveryClient from './DiscoveryClient'

export default function DiscoveryPage() {
  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0D1117', marginBottom: '0.25rem' }}>Insurance Discovery</h1>
        <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>
          Find a patient&apos;s active coverage — payer and member ID — from their identity, even with no card on hand.
          Best for self-pay patients who may actually have insurance, or to surface hidden secondary coverage.
        </p>
      </div>
      <DiscoveryClient />
    </div>
  )
}
