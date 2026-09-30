import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error('חסרים VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY בקובץ .env.local')
}

export const supabase = createClient(url, key)

// While true, App ignores auth events. Sign-up briefly signs the user in
// (email confirmation is off); we sign them out so they log in themselves.
export const authFlags = { registering: false }

export const BUCKETS = {
  productImages: 'product-images',
  orderFiles: 'order-files',
}

// Turn storage paths into short-lived signed URLs (buckets are private).
export async function signedUrls(bucket, paths, expiresIn = 3600) {
  const clean = paths.filter(Boolean)
  if (clean.length === 0) return {}
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(clean, expiresIn)
  if (error) throw error
  return Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]))
}

// Keep only safe characters in uploaded file names.
export function safeFileName(name) {
  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : ''
  return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`
}
