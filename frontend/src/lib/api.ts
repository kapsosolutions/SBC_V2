/**
 * Central helper for talking to the SBC backend API.
 *
 * In the split architecture the backend runs as a separate service
 * (Render), so every request must target its absolute base URL. This is
 * read from `NEXT_PUBLIC_API_BASE_URL` at build time.
 *
 * If the variable is empty we fall back to a same-origin relative path,
 * which keeps local development working when the backend is proxied.
 */
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || ""
).replace(/\/$/, "");

/**
 * Build a fully-qualified API URL.
 * @param path A path beginning with "/api/...".
 */
export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}
