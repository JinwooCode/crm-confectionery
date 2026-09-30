import { useEffect, useState } from 'react'
import { supabase, authFlags } from './supabaseClient'
import { ROLES } from './labels'
import AuthPage, { NewPassword } from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import Products from './pages/Products'
import Orders from './pages/Orders'
import Users from './pages/Users'
import ThemeToggle from './ThemeToggle'

const TABS = [
  { id: 'dashboard', icon: '📊', label: 'לוח בקרה', subtitle: 'תמונת מצב של העסק', Component: Dashboard },
  { id: 'orders', icon: '🧾', label: 'הזמנות', subtitle: 'יצירה ומעקב אחרי הזמנות', Component: Orders },
  { id: 'customers', icon: '👥', label: 'לקוחות', subtitle: 'כל הלקוחות במקום אחד', Component: Customers },
  { id: 'products', icon: '🧁', label: 'מוצרים', subtitle: 'קטלוג העוגות והמאפים', Component: Products },
  { id: 'users', icon: '🔐', label: 'משתמשים', subtitle: 'ניהול צוות והרשאות', Component: Users, adminOnly: true },
]

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('dashboard')
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (authFlags.registering) return
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id
  const [profileError, setProfileError] = useState(null)

  useEffect(() => {
    setProfileError(null)
    if (!userId) {
      setProfile(null)
      return
    }
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setProfileError(error?.message ?? 'הפרופיל לא נמצא')
        else setProfile(data)
      })
  }, [userId])

  if (loading) return <div className="center"><div className="spinner" /></div>
  if (!session) return <AuthPage />
  if (recovery) return <NewPassword onDone={() => setRecovery(false)} />
  if (profileError)
    return (
      <div className="center">
        <div className="card narrow blocked">
          <div className="blocked-icon">⚠️</div>
          <h2>לא הצלחנו לטעון את החשבון</h2>
          <p className="muted">{profileError}</p>
          <button onClick={() => supabase.auth.signOut({ scope: 'local' })}>
            התנתקות והתחברות מחדש
          </button>
        </div>
      </div>
    )
  if (!profile) return <div className="center"><div className="spinner" /></div>

  const signOut = () => supabase.auth.signOut()

  const displayName = profile.full_name || session.user.email

  if (profile.role === 'pending') {
    return (
      <div className="center">
        <ThemeToggle className="floating" />
        <div className="card narrow blocked">
          <div className="blocked-icon">🔒</div>
          <h2>שלום {displayName}</h2>
          <p className="muted">הגישה שלך למערכת חסומה כרגע. פנה למנהל המערכת.</p>
          <button onClick={signOut}>התנתקות</button>
        </div>
      </div>
    )
  }

  const isAdmin = profile.role === 'admin'
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin)
  const current = visibleTabs.find((t) => t.id === tab) ?? visibleTabs[0]
  const Current = current.Component

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">🎂</span>
          <div className="brand-text">
            <strong>הקונדיטוריה</strong>
            <small>מערכת ניהול לקוחות</small>
          </div>
        </div>
        <nav>
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              className={t.id === current.id ? 'nav-item active' : 'nav-item'}
              onClick={() => setTab(t.id)}
            >
              <span className="nav-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="user-card">
          <div className="avatar">{displayName.charAt(0).toUpperCase()}</div>
          <div className="user-info">
            <strong>{displayName}</strong>
            <span className={`role-chip ${profile.role}`}>{ROLES[profile.role]}</span>
          </div>
          <button className="icon-btn" title="התנתקות" onClick={signOut}>
            ⎋
          </button>
        </div>
      </aside>
      <main>
        <header className="page-header">
          <div>
            <h1>
              {current.icon} {current.label}
            </h1>
            <p className="muted">{current.subtitle}</p>
          </div>
          <ThemeToggle />
        </header>
        <Current profile={profile} isAdmin={isAdmin} />
      </main>
    </div>
  )
}
