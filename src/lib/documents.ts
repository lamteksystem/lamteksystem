import { supabase } from '@/lib/supabase'

/** 24 hours – avoids "exp claim timestamp check failed" when opening links later */
const SIGNED_URL_EXPIRY_SEC = 86400

/**
 * Refresh session so createSignedUrl uses a valid JWT (avoids 400 InvalidJWT / "exp claim timestamp check failed").
 */
async function ensureSession() {
  await supabase.auth.refreshSession()
}

/**
 * Get a URL suitable for viewing/downloading a document.
 * Uses signed URL first (works with private bucket for authenticated users), then falls back to public URL.
 */
export async function getDocumentUrl(filePath: string): Promise<string> {
  if (filePath.startsWith('http')) return filePath
  const { data: signed, error } = await supabase.storage.from('documents').createSignedUrl(filePath, SIGNED_URL_EXPIRY_SEC)
  if (!error && signed?.signedUrl) return signed.signedUrl
  const { data: pub } = supabase.storage.from('documents').getPublicUrl(filePath)
  return pub.publicUrl
}

/**
 * Get view URLs for multiple document rows. Returns a map of document id -> url.
 * Refreshes the auth session once so the JWT is valid (avoids InvalidJWT / exp claim failed).
 */
export async function getDocumentUrls(docs: { id: string; file_path: string }[]): Promise<Record<string, string>> {
  await ensureSession()
  const map: Record<string, string> = {}
  await Promise.all(
    docs.map(async (doc) => {
      map[doc.id] = await getDocumentUrl(doc.file_path)
    })
  )
  return map
}
