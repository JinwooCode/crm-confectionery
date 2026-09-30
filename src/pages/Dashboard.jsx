import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { ORDER_STATUS, money, date } from '../labels'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [upcoming, setUpcoming] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10)
      const count = (table, filter) => {
        let q = supabase.from(table).select('id', { count: 'exact', head: true })
        if (filter) q = filter(q)
        return q
      }

      const [customers, products, open, upcomingRes] = await Promise.all([
        count('customers'),
        count('products', (q) => q.eq('is_active', true)),
        count('orders', (q) => q.in('status', ['new', 'in_progress', 'ready'])),
        supabase
          .from('orders')
          .select('id, due_date, status, total, customers(full_name)')
          .gte('due_date', today)
          .not('status', 'in', '(delivered,cancelled)')
          .order('due_date')
          .limit(10),
      ])

      const firstError = [customers, products, open, upcomingRes].find((r) => r.error)?.error
      if (firstError) return setError(firstError.message)

      setStats({ customers: customers.count, products: products.count, open: open.count })
      setUpcoming(upcomingRes.data)
    }
    load()
  }, [])

  if (error) return <p className="error">{error}</p>
  if (!stats) return <div className="spinner" />

  return (
    <>
      <div className="stats">
        <div className="card stat pink">
          <span className="stat-icon">🧾</span>
          <div>
            <span>הזמנות פתוחות</span>
            <strong>{stats.open}</strong>
          </div>
        </div>
        <div className="card stat cream">
          <span className="stat-icon">👥</span>
          <div>
            <span>לקוחות</span>
            <strong>{stats.customers}</strong>
          </div>
        </div>
        <div className="card stat mint">
          <span className="stat-icon">🧁</span>
          <div>
            <span>מוצרים פעילים</span>
            <strong>{stats.products}</strong>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>הזמנות קרובות</h2>
        {upcoming.length === 0 ? (
          <div className="empty">
            <span>🍰</span>
            <p>אין הזמנות קרובות – זמן טוב לאפות משהו חדש</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>לקוח</th>
                <th>תאריך</th>
                <th>סטטוס</th>
                <th>סכום</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((o) => (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>{o.customers?.full_name}</td>
                  <td>{date(o.due_date)}</td>
                  <td>
                    <span className={`badge ${o.status}`}>{ORDER_STATUS[o.status]}</span>
                  </td>
                  <td>{money(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
