'use client'

// Per-case chat between the clinic biller and the Ampify VA. Lives inside the
// patient/case view (not a separate app). Backed by Supabase Realtime on
// public.case_messages — no Slack/GHL round-trip; both parties are already here.
//
// The VA is an internal user (role 'superadmin' today). Their messages are tagged
// sender_role='va'; everyone else is 'clinic'. RLS already scopes rows to the clinic.

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CaseMessage {
  id: string
  call_id: string
  sender_id: string | null
  sender_role: 'clinic' | 'va' | 'system'
  body: string
  read_at: string | null
  created_at: string
}

interface Viewer {
  id: string
  role: 'staff' | 'admin' | 'superadmin'
  fullName: string | null
}

const bubble = (mine: boolean): React.CSSProperties => ({
  alignSelf: mine ? 'flex-end' : 'flex-start',
  maxWidth: '78%',
  background: mine ? '#1D4ED8' : '#F3F4F6',
  color: mine ? '#fff' : '#0D1117',
  padding: '0.5rem 0.75rem',
  borderRadius: '0.75rem',
  borderBottomRightRadius: mine ? '0.25rem' : '0.75rem',
  borderBottomLeftRadius: mine ? '0.75rem' : '0.25rem',
  fontSize: '0.875rem',
  lineHeight: 1.4,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
})

export default function CaseChat({
  callId,
  clinicId,
  viewer,
}: {
  callId: string
  clinicId: string
  viewer: Viewer
}) {
  const supabase = createClient()
  const myRole: 'clinic' | 'va' = viewer.role === 'superadmin' ? 'va' : 'clinic'

  const [messages, setMessages] = useState<CaseMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    })
  }, [])

  // Mark messages from the *other* party as read.
  const markRead = useCallback(
    async (rows: CaseMessage[]) => {
      const unread = rows.filter(m => m.sender_role !== myRole && !m.read_at).map(m => m.id)
      if (unread.length === 0) return
      await supabase.from('case_messages').update({ read_at: new Date().toISOString() }).in('id', unread)
    },
    [supabase, myRole],
  )

  // Initial load + live subscription.
  useEffect(() => {
    let active = true

    supabase
      .from('case_messages')
      .select('*')
      .eq('call_id', callId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!active || !data) return
        setMessages(data as CaseMessage[])
        void markRead(data as CaseMessage[])
        scrollToBottom()
      })

    const channel = supabase
      .channel(`case-chat-${callId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'case_messages', filter: `call_id=eq.${callId}` },
        payload => {
          const msg = payload.new as CaseMessage
          setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]))
          if (msg.sender_role !== myRole) void markRead([msg])
          scrollToBottom()
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [callId, supabase, markRead, scrollToBottom, myRole])

  async function send() {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setDraft('')
    // No optimistic append — the realtime INSERT echoes back to us too (and dedupes by id).
    const { error } = await supabase.from('case_messages').insert({
      call_id: callId,
      clinic_id: clinicId,
      sender_id: viewer.id,
      sender_role: myRole,
      body,
    })
    if (error) setDraft(body) // restore on failure
    setSending(false)
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 420, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #E5E7EB' }}>
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0D1117', margin: 0 }}>Case messages</h2>
        <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: '0.125rem 0 0' }}>
          {myRole === 'va' ? 'Reply to the clinic about this patient.' : 'Question about this patient? Message the verification team.'}
        </p>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {messages.length === 0 && (
          <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', textAlign: 'center', margin: 'auto' }}>No messages yet.</p>
        )}
        {messages.map(m => {
          const mine = m.sender_role === myRole
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
              <div style={bubble(mine)}>{m.body}</div>
              <span style={{ fontSize: '0.6875rem', color: '#9CA3AF', margin: '0.125rem 0.25rem 0' }}>
                {m.sender_role === 'va' ? 'Ampify VA' : m.sender_role === 'system' ? 'System' : 'Clinic'}
                {' · '}
                {new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', borderTop: '1px solid #E5E7EB' }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          placeholder="Type a message…"
          style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid #D1D5DB', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#0D1117' }}
        />
        <button onClick={() => void send()} disabled={sending || !draft.trim()} className="btn-primary" style={{ fontSize: '0.875rem' }}>
          Send
        </button>
      </div>
    </div>
  )
}
