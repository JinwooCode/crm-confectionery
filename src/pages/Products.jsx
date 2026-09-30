import { useEffect, useState } from 'react'
import { supabase, BUCKETS, signedUrls, safeFileName } from '../supabaseClient'
import { money } from '../labels'

const EMPTY = { name: '', category: '', description: '', price: '', is_active: true }

export default function Products({ isAdmin }) {
  const [products, setProducts] = useState([])
  const [images, setImages] = useState({})
  const [form, setForm] = useState(EMPTY)
  const [file, setFile] = useState(null)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function load() {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, category, description, price, image_path, is_active')
      .order('name')
    if (error) return setError(error.message)
    setProducts(data)
    try {
      setImages(await signedUrls(BUCKETS.productImages, data.map((p) => p.image_path)))
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      let image_path = editing?.image_path ?? null

      // STORAGE: upload the image to the private bucket (RLS: admins only)
      if (file) {
        const path = `products/${safeFileName(file.name)}`
        const { error: upErr } = await supabase.storage
          .from(BUCKETS.productImages)
          .upload(path, file, { contentType: file.type })
        if (upErr) throw upErr
        if (image_path) await supabase.storage.from(BUCKETS.productImages).remove([image_path])
        image_path = path
      }

      const payload = { ...form, price: Number(form.price), image_path }
      const { error } = editing
        ? await supabase.from('products').update(payload).eq('id', editing.id)
        : await supabase.from('products').insert(payload)
      if (error) throw error

      reset()
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setForm(EMPTY)
    setFile(null)
    setEditing(null)
  }

  function edit(p) {
    setEditing(p)
    setFile(null)
    setForm({
      name: p.name,
      category: p.category ?? '',
      description: p.description ?? '',
      price: p.price,
      is_active: p.is_active,
    })
  }

  async function remove(p) {
    if (!confirm(`למחוק את ${p.name}?`)) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error)
      return setError(
        error.code === '23503' ? 'המוצר מופיע בהזמנות – אפשר לסמן אותו כלא פעיל במקום' : error.message
      )
    if (p.image_path) await supabase.storage.from(BUCKETS.productImages).remove([p.image_path])
    load()
  }

  const field = (name) => ({
    value: form[name],
    onChange: (e) => setForm({ ...form, [name]: e.target.value }),
  })

  return (
    <>
      {isAdmin && (
        <form className="card grid-form" onSubmit={save}>
          <h2>{editing ? 'עריכת מוצר' : 'מוצר חדש'}</h2>
          <label>
            שם
            <input {...field('name')} required />
          </label>
          <label>
            קטגוריה
            <input {...field('category')} placeholder="עוגות, מאפים, קינוחים..." />
          </label>
          <label>
            מחיר (₪)
            <input type="number" min="0" step="0.01" {...field('price')} required />
          </label>
          <label>
            תמונה
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files[0] ?? null)}
            />
          </label>
          <label className="wide">
            תיאור
            <textarea rows={2} {...field('description')} />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            מוצר פעיל
          </label>
          <div className="actions wide">
            <button disabled={busy}>{busy ? 'שומר...' : editing ? 'שמירה' : 'הוספה'}</button>
            {editing && (
              <button type="button" className="secondary" onClick={reset}>
                ביטול
              </button>
            )}
          </div>
        </form>
      )}

      {error && <p className="error">{error}</p>}

      <div className="products">
        {products.map((p) => (
          <div key={p.id} className={p.is_active ? 'card product' : 'card product inactive'}>
            {images[p.image_path] ? (
              <img src={images[p.image_path]} alt={p.name} />
            ) : (
              <div className="placeholder">🍰</div>
            )}
            <h3>{p.name}</h3>
            <p className="muted">{p.category}</p>
            <p>{p.description}</p>
            <strong>{money(p.price)}</strong>
            {!p.is_active && <span className="badge cancelled">לא פעיל</span>}
            {isAdmin && (
              <div className="actions">
                <button className="small" onClick={() => edit(p)}>
                  עריכה
                </button>
                <button className="small danger" onClick={() => remove(p)}>
                  מחיקה
                </button>
              </div>
            )}
          </div>
        ))}
        {products.length === 0 && <p className="muted">אין מוצרים עדיין</p>}
      </div>
    </>
  )
}
