import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { ROLES, date } from '../labels'

// Admin only. The UI hides this tab from others, but the real protection is RLS:
// only admins pass the profiles UPDATE policy for other users' rows.
export default function Users({ profile }) {
  const [users, setUsers] = useState([])
  const [error, setError] = useState(null)

  async function load() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .order('created_at')
    if (error) setError(error.message)
    else setUsers(data)
  }

  useEffect(() => {
    load()
  }, [])

  async function setRole(user, role) {
    setError(null)
    const { error } = await supabase.from('profiles').update({ role }).eq('id', user.id)
    if (error) setError(error.message)
    else load()
  }

  return (
    <div className="card">
      <h2>משתמשים והרשאות</h2>
      <p className="muted">משתמשים חדשים מקבלים הרשאת עובד מיד בהרשמה. כדי לחסום משתמש, שנה את התפקיד שלו ל״ממתין לאישור״.</p>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>שם</th>
            <th>נרשם</th>
            <th>תפקיד</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                {u.full_name || '(ללא שם)'} {u.id === profile.id && <span className="muted">(את/ה)</span>}
              </td>
              <td>{date(u.created_at)}</td>
              <td>
                <select
                  value={u.role}
                  disabled={u.id === profile.id}
                  onChange={(e) => setRole(u, e.target.value)}
                >
                  {Object.entries(ROLES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
