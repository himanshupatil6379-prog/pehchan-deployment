/** Small helpers to build the JSON envelope described in docs/API.md */

export const msg = (level, text) => ({ level, text });
export const success = (text) => msg('success', text);
export const error = (text) => msg('error', text);
export const warning = (text) => msg('warning', text);
export const info = (text) => msg('info', text);

/** Wrap async route handlers so rejections reach the error middleware. */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function notFound(res) {
  return res.status(404).json({ ok: false, not_found: true });
}

export function clientIp(req, { forwarded = true } = {}) {
  if (forwarded) {
    const xff = req.headers['x-forwarded-for'];
    if (xff) return String(xff).split(',')[0].trim();
  }
  const ip = req.socket?.remoteAddress || null;
  return ip && ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

/** Parse a positive integer route param (Django <int:pk>) – returns null when invalid. */
export function intParam(value) {
  return /^\d+$/.test(String(value)) ? Number(value) : null;
}
