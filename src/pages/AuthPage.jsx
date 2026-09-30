import { useState } from 'react'
import { supabase, authFlags } from '../supabaseClient'
import ThemeToggle from '../ThemeToggle'

// Shown after the user opens the password-reset link from their email
export function NewPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setError(error.message)
    else onDone()
  }

  return (
    <div className="center">
      <form className="card narrow" onSubmit={submit}>
        <h2>בחירת סיסמה חדשה</h2>
        <label>
          סיסמה חדשה
          <input
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button>שמירה</button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  )
}

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage({ type: 'error', text: 'התחברות נכשלה: ' + error.message })
    } else if (mode === 'signup') {
      authFlags.registering = true
      let data, error
      try {
        ;({ data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
        }))
        if (data?.session) await supabase.auth.signOut({ scope: 'local' })
      } catch (err) {
        error = err
      } finally {
        authFlags.registering = false
      }

      if (error) {
        setMessage({ type: 'error', text: 'ההרשמה נכשלה: ' + error.message })
      } else {
        setMode('login')
        setPassword('')
        setMessage({
          type: 'ok',
          text: data?.session
            ? 'נרשמת בהצלחה! התחבר עם האימייל והסיסמה שלך.'
            : 'נשלח אליך מייל לאימות החשבון. אשר אותו ואז התחבר.',
        })
      }
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      setMessage(
        error
          ? { type: 'error', text: error.message }
          : { type: 'ok', text: 'אם הכתובת קיימת במערכת, נשלח אליה קישור לאיפוס סיסמה.' }
      )
    }
    setBusy(false)
  }

  const titles = { login: 'התחברות', signup: 'הרשמה', reset: 'איפוס סיסמה' }

  const subtitles = {
    login: 'טוב לראות אותך שוב 👋',
    signup: 'צור חשבון והצטרף לצוות',
    reset: 'נשלח אליך קישור לבחירת סיסמה חדשה',
  }

  const switchMode = (m) => {
    setMode(m)
    setMessage(null)
  }

  return (
    <div className="auth">
      <ThemeToggle className="floating" />
      <section className="auth-hero">
        <div className="auth-hero-content">
          <span className="hero-emoji">🎂</span>
          <h1>הקונדיטוריה</h1>
          <p>כל ההזמנות, הלקוחות והמוצרים של הקונדיטוריה במקום אחד – מסודר, מתוק ופשוט.</p>
          <ul>
            <li>🧾 מעקב הזמנות לפי תאריך מסירה</li>
            <li>👥 כרטיס לקוח עם אלרגיות והעדפות</li>
            <li>🧁 קטלוג מוצרים עם תמונות</li>
          </ul>
        </div>
      </section>

      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <h2>{titles[mode]}</h2>
          <p className="muted">{subtitles[mode]}</p>

          {mode === 'signup' && (
            <label>
              שם מלא
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="ישראל ישראלי"
                required
              />
            </label>
          )}
          <label>
            אימייל
            <input
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
            />
          </label>
          {mode !== 'reset' && (
            <label>
              סיסמה
              <input
                type="password"
                dir="ltr"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="לפחות 6 תווים"
                required
              />
            </label>
          )}

          {message && <div className={`alert ${message.type}`}>{message.text}</div>}

          <button className="block" disabled={busy}>
            {busy ? 'רגע...' : titles[mode]}
          </button>

          <div className="links">
            {mode === 'login' && (
              <>
                <a onClick={() => switchMode('reset')}>שכחתי סיסמה</a>
                <span>
                  אין לך חשבון? <a onClick={() => switchMode('signup')}>להרשמה</a>
                </span>
              </>
            )}
            {mode !== 'login' && (
              <span>
                יש לך חשבון? <a onClick={() => switchMode('login')}>להתחברות</a>
              </span>
            )}
          </div>
        </form>
      </section>
    </div>
  )
}
