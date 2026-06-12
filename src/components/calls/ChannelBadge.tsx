// How a verification was handled. Reads calls.channel.
const CONFIG: Record<string, { label: string; icon: string; bg: string; color: string; border: string }> = {
  electronic:      { label: 'Electronic',  icon: '⚡', bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
  autonomous_call: { label: 'AI Call',      icon: '📞', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  hybrid_call:     { label: 'Hybrid',       icon: '👤', bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' },
  carve_out_refer: { label: 'Self-pay',      icon: '↪',  bg: '#FAF5FF', color: '#7C3AED', border: '#E9D5FF' },
  needs_setup:     { label: 'Needs setup',  icon: '⚙',  bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' },
}

export default function ChannelBadge({ channel }: { channel: string | null }) {
  if (!channel) return <span style={{ color: '#9CA3AF', fontSize: '0.8125rem' }}>—</span>
  const c = CONFIG[channel] ?? { label: channel, icon: '•', bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      borderRadius: '0.375rem', padding: '0.125rem 0.5rem',
      fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <span aria-hidden>{c.icon}</span>{c.label}
    </span>
  )
}
