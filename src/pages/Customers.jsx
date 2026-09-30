import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { date } from '../labels'

const EMPTY = { full_name: '', phone: '', email: '', address: '', notes: '' }

export default function Customers({ isAdmin }) {
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState(null)

  async function load() {
    const { data, error } = await supabase
      .from('customers')
      .select('id, full_name, phone, email, address, notes, created_at')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setCustomers(data)
  }

  useEffect(() => {
    load()
  }, [])

  async function save(e) {
    e.preventDefault()
    setError(null)
    const payload = { ...form }
    const { error } = editingId
      ? await supabase.from('customers').update(payload).eq('id', editingId)
      : await supabase.from('customers').insert(payload)
    if (error) return setError(error.message)
    setForm(EMPTY)
    setEditingId(null)
    load()
  }

  function edit(c) {
    setEditingId(c.id)
    setForm({
      full_name: c.full_name ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
      address: c.address ?? '',
      notes: c.notes ?? '',
    })
  }

  async function remove(c) {
    if (!confirm(`למחוק את ${c.full_name}?`)) return
    const { error } = await supabase.from('customers').delete().eq('id', c.id)
    if (error)
      setError(error.code === '23503' ? 'לא ניתן למחוק לקוח שיש לו הזמנות' : error.message)
    else load()
  }

  const field = (name) => ({
    value: form[name],
    onChange: (e) => setForm({ ...form, [name]: e.target.value }),
  })

  const term = search.trim().toLowerCase()
  const filtered = customers.filter(
    (c) =>
      !term ||
      c.full_name.toLowerCase().includes(term) ||
      (c.phone ?? '').includes(term) ||
      (c.email ?? '').toLowerCase().includes(term)
  )

  return (
    <>
      <form className="card grid-form" onSubmit={save}>
        <h2>{editingId ? 'עריכת לקוח' : 'לקוח חדש'}</h2>
        <label>
          שם מלא
          <input {...field('full_name')} required />
        </label>
        <label>
          טלפון
          <input {...field('phone')} />
        </label>
        <label>
          אימייל
          <input type="email" {...field('email')} />
        </label>
        <label>
          כתובת
          <input {...field('address')} />
        </label>
        <label className="wide">
          הערות (אלרגיות, העדפות...)
          <textarea rows={2} {...field('notes')} />
        </label>
        <div className="actions wide">
          <button>{editingId ? 'שמירה' : 'הוספה'}</button>
          {editingId && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setEditingId(null)
                setForm(EMPTY)
              }}
            >
              ביטול
            </button>
          )}
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="card">
        <div className="row">
          <h2>לקוחות ({filtered.length})</h2>
          <input
            className="search"
            placeholder="חיפוש לפי שם / טלפון / מייל"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <table>
          <thead>
            <tr>
              <th>שם</th>
              <th>טלפון</th>
              <th>אימייל</th>
              <th>כתובת</th>
              <th>הערות</th>
              <th>נוצר</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>{c.full_name}</td>
                <td dir="ltr">{c.phone}</td>
                <td>{c.email}</td>
                <td>{c.address}</td>
                <td className="muted">{c.notes}</td>
                <td>{date(c.created_at)}</td>
                <td className="actions">
                  <button className="small" onClick={() => edit(c)}>
                    עריכה
                  </button>
                  {isAdmin && (
                    <button className="small danger" onClick={() => remove(c)}>
                      מחיקה
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
