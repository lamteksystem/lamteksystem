/**
 * Static files from `public/` (copied to dist under Vite `base`).
 * @example publicAsset('marketing/kitchen.png')
 */
export function publicAsset(path: string): string {
  const p = path.replace(/^\/+/, '')
  return `${import.meta.env.BASE_URL}${p}`
}

/**
 * Same-origin path for `href` when the browser resolves from the host root
 * (e.g. `<a target="_blank">`), including GitHub Pages project sites under `/<repo>/`.
 */
export function withBasePath(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '')
  if (!base) return p
  return `${base}${p}`
}
