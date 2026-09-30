import { useEffect, useState } from 'react'
import { supabase, BUCKETS, safeFileName } from '../supabaseClient'
import { ORDER_STATUS, DELIVERY, money, date } from '../labels'

const EMPTY_ORDER = { customer_id: '', due_date: '', delivery_method: 'pickup', notes: '' }

export default function Orders({ isAdmin }) {
  const [orders, setOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [statusFilter, setStatusFilter] = useState('open')
  const [form, setForm] = useState(EMPTY_ORDER)
  const [items, setItems] = useState([{ product_id: '', quantity: 1 }])
  const [openId, setOpenId] = useState(null)
  const [error, setError] = useState(null)

  async function load() {
    let q = supabase
      .from('orders')
      .select(
        'id, status, due_date, delivery_method, notes, total, created_at, customers(full_name, phone), profiles(full_name)'
      )
      .order('due_date')
    if (statusFilter === 'open') q = q.in('status', ['new', 'in_progress', 'ready'])
    else if (statusFilter !== 'all') q = q.eq('status', statusFilter)
    const { data, error } = await q
    if (error) setError(error.message)
    else setOrders(data)
  }

  useEffect(() => {
    load()
  }, [statusFilter])

  useEffect(() => {
    supabase
      .from('customers')
      .select('id, full_name')
      .order('full_name')
      .then(({ data }) => setCustomers(data ?? []))
    supabase
      .from('products')
      .select('id, name, price')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setProducts(data ?? []))
  }, [])

  const priceOf = (id) => products.find((p) => p.id === Number(id))?.price ?? 0
  const draftTotal = items.reduce((sum, i) => sum + priceOf(i.product_id) * i.quantity, 0)

  async function create(e) {
    e.preventDefault()
    setError(null)
    const validItems = items
      .filter((i) => i.product_id && i.quantity > 0)
      .map((i) => ({ product_id: Number(i.product_id), quantity: Number(i.quantity) }))
    if (validItems.length === 0) return setError('יש להוסיף לפחות מוצר אחד')

    const { error } = await supabase.rpc('create_order', {
      p_customer_id: Number(form.customer_id),
      p_due_date: form.due_date,
      p_delivery_method: form.delivery_method,
      p_notes: form.notes,
      p_items: validItems,
    })
    if (error) return setError(error.message)
    setForm(EMPTY_ORDER)
    setItems([{ product_id: '', quantity: 1 }])
    load()
  }

  async function setStatus(order, status) {
    const { error } = await supabase.from('orders').update({ status }).eq('id', order.id)
    if (error) setError(error.message)
    else load()
  }

  async function remove(order) {
    if (!confirm(`למחוק את הזמנה #${order.id}?`)) return
    const { data: files } = await supabase.storage.from(BUCKETS.orderFiles).list(String(order.id))
    if (files?.length)
      await supabase.storage.from(BUCKETS.orderFiles).remove(files.map((f) => `${order.id}/${f.name}`))
    const { error } = await supabase.from('orders').delete().eq('id', order.id)
    if (error) setError(error.message)
    else load()
  }

  const updateItem = (idx, patch) =>
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  return (
    <>
      <form className="card grid-form" onSubmit={create}>
        <h2>הזמנה חדשה</h2>
        <label>
          לקוח
          <select
            value={form.customer_id}
            onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
            required
          >
            <option value="">בחר לקוח...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          תאריך מסירה
          <input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            required
          />
        </label>
        <label>
          אופן מסירה
          <select
            value={form.delivery_method}
            onChange={(e) => setForm({ ...form, delivery_method: e.target.value })}
          >
            {Object.entries(DELIVERY).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="wide">
          הערות (כיתוב על העוגה, אלרגיות...)
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </label>

        <div className="wide items">
          <strong>פריטים</strong>
          {items.map((it, idx) => (
            <div key={idx} className="item-row">
              <select
                value={it.product_id}
                onChange={(e) => updateItem(idx, { product_id: e.target.value })}
              >
                <option value="">בחר מוצר...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} – {money(p.price)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                value={it.quantity}
                onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
              />
              {items.length > 1 && (
                <button
                  type="button"
                  className="small secondary"
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="small secondary"
            onClick={() => setItems([...items, { product_id: '', quantity: 1 }])}
          >
            + הוספת פריט
          </button>
        </div>

        <div className="actions wide">
          <button>יצירת הזמנה</button>
          <span>סה״כ משוער: {money(draftTotal)}</span>
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="card">
        <div className="row">
          <h2>הזמנות</h2>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="open">פתוחות</option>
            <option value="all">הכל</option>
            {Object.entries(ORDER_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>לקוח</th>
              <th>מסירה</th>
              <th>סטטוס</th>
              <th>סכום</th>
              <th>נוצר ע״י</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                open={openId === o.id}
                onToggle={() => setOpenId(openId === o.id ? null : o.id)}
                onStatus={(s) => setStatus(o, s)}
                onDelete={isAdmin ? () => remove(o) : null}
                onError={setError}
              />
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <p className="muted">אין הזמנות</p>}
      </div>
    </>
  )
}

function OrderRow({ order, open, onToggle, onStatus, onDelete, onError }) {
  return (
    <>
      <tr>
        <td>{order.id}</td>
        <td>
          {order.customers?.full_name}
          <div className="muted" dir="ltr">
            {order.customers?.phone}
          </div>
        </td>
        <td>
          {date(order.due_date)}
          <div className="muted">{DELIVERY[order.delivery_method]}</div>
        </td>
        <td>
          <select
            className={`badge ${order.status}`}
            value={order.status}
            onChange={(e) => onStatus(e.target.value)}
          >
            {Object.entries(ORDER_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </td>
        <td>{money(order.total)}</td>
        <td className="muted">{order.profiles?.full_name}</td>
        <td className="actions">
          <button className="small" onClick={onToggle}>
            {open ? 'סגירה' : 'פרטים'}
          </button>
          {onDelete && (
            <button className="small danger" onClick={onDelete}>
              מחיקה
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr className="details">
          <td colSpan={7}>
            <OrderDetails order={order} onError={onError} />
          </td>
        </tr>
      )}
    </>
  )
}

function OrderDetails({ order, onError }) {
  const [items, setItems] = useState([])
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const folder = String(order.id)

  async function loadFiles() {
    const { data, error } = await supabase.storage.from(BUCKETS.orderFiles).list(folder)
    if (error) onError(error.message)
    else setFiles(data.filter((f) => f.id))
  }

  useEffect(() => {
    supabase
      .from('order_items')
      .select('id, quantity, unit_price, products(name)')
      .eq('order_id', order.id)
      .then(({ data, error }) => (error ? onError(error.message) : setItems(data)))
    loadFiles()
  }, [order.id])

  // STORAGE: attach a reference photo / design to the order
  async function upload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const { error } = await supabase.storage
      .from(BUCKETS.orderFiles)
      .upload(`${folder}/${safeFileName(file.name)}`, file, { contentType: file.type })
    setUploading(false)
    e.target.value = ''
    if (error) onError(error.message)
    else loadFiles()
  }

  async function openFile(name) {
    const { data, error } = await supabase.storage
      .from(BUCKETS.orderFiles)
      .createSignedUrl(`${folder}/${name}`, 300)
    if (error) onError(error.message)
    else window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function removeFile(name) {
    const { error } = await supabase.storage.from(BUCKETS.orderFiles).remove([`${folder}/${name}`])
    if (error) onError(error.message)
    else loadFiles()
  }

  return (
    <div className="order-details">
      <div>
        <h4>פריטים</h4>
        <ul>
          {items.map((i) => (
            <li key={i.id}>
              {i.products?.name} × {i.quantity} – {money(i.unit_price * i.quantity)}
            </li>
          ))}
        </ul>
        {order.notes && <p className="muted">הערות: {order.notes}</p>}
      </div>
      <div>
        <h4>קבצים מצורפים</h4>
        <ul>
          {files.map((f) => (
            <li key={f.id}>
              <a onClick={() => openFile(f.name)}>{f.name}</a>{' '}
              <button className="small secondary" onClick={() => removeFile(f.name)}>
                ✕
              </button>
            </li>
          ))}
          {files.length === 0 && <li className="muted">אין קבצים</li>}
        </ul>
        <label className="upload">
          {uploading ? 'מעלה...' : 'העלאת תמונה / PDF'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={upload}
            disabled={uploading}
          />
        </label>
      </div>
    </div>
  )
}
