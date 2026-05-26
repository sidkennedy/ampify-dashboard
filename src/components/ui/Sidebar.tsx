'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'

interface SidebarProps {
  profile: (Profile & { clinics: { name: string } | null }) | null
}

const NAV = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    href: '/calls/new',
    label: 'New Call',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14v2.92z"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/>
      </svg>
    ),
  },
  {
    href: '/calls',
    label: 'Call History',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    ),
  },
]

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: 240,
      background: '#0D1117', display: 'flex', flexDirection: 'column',
      padding: '1.5rem 0', zIndex: 50
    }}>
      {/* Logo */}
      <div style={{ padding: '0 1.25rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
        <div style={{ width: 30, height: 30, background: '#00C853', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14v3z"/>
          </svg>
        </div>
        <span style={{ color: 'white', fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.01em' }}>Ampify</span>
      </div>

      {/* Clinic name */}
      {profile?.clinics?.name && (
        <div style={{ padding: '0 1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ background: '#161B22', borderRadius: 8, padding: '0.625rem 0.875rem' }}>
            <p style={{ color: '#6B7280', fontSize: '0.6875rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.125rem' }}>Clinic</p>
            <p style={{ color: '#E5E7EB', fontSize: '0.8125rem', fontWeight: 600 }}>{profile.clinics.name}</p>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 0.75rem' }}>
        {NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.625rem',
              padding: '0.625rem 0.75rem', borderRadius: '0.5rem', marginBottom: '0.25rem',
              color: isActive(item.href) ? 'white' : '#9CA3AF',
              background: isActive(item.href) ? '#161B22' : 'transparent',
              textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500,
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            <span style={{ color: isActive(item.href) ? '#00C853' : '#6B7280' }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}

        {profile?.role === 'superadmin' && (
          <Link
            href="/admin"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.625rem',
              padding: '0.625rem 0.75rem', borderRadius: '0.5rem', marginTop: '0.5rem',
              color: isActive('/admin') ? 'white' : '#9CA3AF',
              background: isActive('/admin') ? '#161B22' : 'transparent',
              textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500,
              borderTop: '1px solid #21262D', paddingTop: '0.875rem',
            }}
          >
            <span style={{ color: isActive('/admin') ? '#00C853' : '#6B7280' }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </span>
            Admin Panel
          </Link>
        )}
      </nav>

      {/* Sign out */}
      <div style={{ padding: '0 0.75rem', borderTop: '1px solid #21262D', paddingTop: '1rem', marginTop: '0.5rem' }}>
        <div style={{ padding: '0 0.75rem', marginBottom: '0.75rem' }}>
          <p style={{ color: '#6B7280', fontSize: '0.75rem' }}>{profile?.email}</p>
        </div>
        <button
          onClick={handleSignOut}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.625rem',
            padding: '0.625rem 0.75rem', borderRadius: '0.5rem', width: '100%',
            color: '#9CA3AF', background: 'transparent', border: 'none',
            cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500,
          }}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>

        {/* HIPAA badge */}
        <div style={{
          margin: '0.875rem 0.75rem 0',
          background: '#0D1117',
          border: '1px solid #21262D',
          borderRadius: '0.5rem',
          padding: '0.5rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <svg width="13" height="13" fill="none" stroke="#00C853" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          <div>
            <p style={{ color: '#00C853', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em' }}>HIPAA COMPLIANT</p>
            <p style={{ color: '#4B5563', fontSize: '0.625rem', marginTop: '0.0625rem' }}>Data encrypted &amp; access-controlled</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
