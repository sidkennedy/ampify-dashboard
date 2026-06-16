'use client'

// Messenger-style notification bell for the top bar. Shows recent case messages
// addressed to *you* (VA sees clinic messages; clinic sees VA messages), unread in
// bold with a badge count, read ones greyed. Click → opens that patient's case and
// marks the message read. Live via Supabase Realtime on case_messages.

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Notif {
  id: string
  call_id: string
  body: string
  sender_role: 'clinic' | 'va' | 'system'
  created_at: string
  read_at: string | null
  calls: { patient_name: string } | null
}

function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

export default function NotificationBell({
  viewer,
}: {
  viewer: { id: string; role: 'staff' | 'admin' | 'superadmin' }
}) {
  const supabase = createClient()
  const router = useRouter()
  const myRole: 'clinic' | 'va' = viewer.role === 'superadmin' ? 'va' : 'clinic'

  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notif[]>([])

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('case_messages')
      .select('id, call_id, body, sender_role, created_at, read_at, calls(patient_name)')
      .neq('sender_role', myRole) // messages addressed to me
      .order('created_at', { ascending: false })
      .limit(15)
    if (data) setItems(data as unknown as Notif[])
  }, [supabase, myRole])

  useEffect(() => {
    void load()
    const channel = supabase
      .channel(`notif-${viewer.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'case_messages' }, payload => {
        if ((payload.new as Notif).sender_role !== myRole) void load()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'case_messages' }, () => void load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, load, viewer.id, myRole])

  const unread = items.filter(i => !i.read_at).length

  async function openCase(n: Notif) {
    setOpen(false)
    if (!n.read_at) {
      setItems(prev => prev.map(i => (i.id === n.id ? { ...i, read_at: new Date().toISOString() } : i)))
      await supabase.from('case_messages').update({ read_at: new Date().toISOString() }).eq('id', n.id)
    }
    router.push(`/calls/${n.call_id}`)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '0.625rem', border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', color: '#374151' }}
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: '#DC2626', color: '#fff', fontSize: '0.6875rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'absolute', right: 0, top: 48, width: 360, maxHeight: 440, overflowY: 'auto', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '0.75rem', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 41 }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0D1117' }}>Messages</span>
              <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{myRole === 'va' ? 'From clinics' : 'From your verification team'}</span>
            </div>

            {items.length === 0 && (
              <p style={{ padding: '1.5rem 1rem', textAlign: 'center', fontSize: '0.8125rem', color: '#9CA3AF', margin: 0 }}>No messages yet.</p>
            )}

            {items.map(n => {
              const unreadItem = !n.read_at
              return (
                <button
                  key={n.id}
                  onClick={() => void openCase(n)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', border: 'none', borderBottom: '1px solid #F3F4F6', background: unreadItem ? '#F5F8FF' : '#fff', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {unreadItem && <span style={{ width: 8, height: 8, borderRadius: 4, background: '#2563EB', flexShrink: 0 }} />}
                    <span style={{ fontSize: '0.875rem', fontWeight: unreadItem ? 700 : 500, color: unreadItem ? '#0D1117' : '#9CA3AF', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.calls?.patient_name ?? 'Patient'}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: '#9CA3AF', flexShrink: 0 }}>{ago(n.created_at)}</span>
                  </div>
                  <p style={{ margin: '0.25rem 0 0 1rem', fontSize: '0.8125rem', color: unreadItem ? '#374151' : '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.sender_role === 'va' ? 'VA: ' : n.sender_role === 'system' ? '' : 'Clinic: '}{n.body}
                  </p>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
