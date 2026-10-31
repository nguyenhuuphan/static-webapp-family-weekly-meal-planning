// Cloudflare is the default. A retired Netlify deploy can explicitly override this at build time.
const base = (import.meta.env.VITE_API_BASE || "/api").replace(/\/$/, "");
export const apiEndpoint = (name: string) => `${base}/${name}`;
