/**
 * Low-level API client.
 *
 * Every backend endpoint lives under /api and answers with a JSON "envelope"
 * that mirrors what a Django view used to do:
 *   {
 *     ok:        boolean,
 *     messages?: [{ level: 'success'|'error'|'warning'|'info', text }],  // django.contrib.messages
 *     redirect?: '/dashboard/',                                         // HttpResponseRedirect
 *     user?:     {...} | null,                                          // auth state changed
 *     errors?:   { field: ['msg', ...], __all__: ['msg'] },             // form.errors
 *     ...page data
 *   }
 * Use the `useApi()` hook (hooks/useApi.js) inside components – it applies
 * messages / redirect / user automatically.
 */

export async function apiFetch(path, { method = 'GET', data, formData, query, signal } = {}) {
  let url = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? '' : '/'}${path}`;
  if (query) {
    const qs = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    const s = qs.toString();
    if (s) url += (url.includes('?') ? '&' : '?') + s;
  }

  const headers = { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' };
  let body;
  if (formData) {
    body = formData;
  } else if (data !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(data);
  }

  let response;
  try {
    response = await fetch(url, { method, headers, body, credentials: 'same-origin', signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    return {
      ok: false,
      status: 0,
      data: { ok: false, messages: [{ level: 'error', text: 'Network error. Please check your connection and try again.' }] },
      response: null,
    };
  }

  const contentType = response.headers.get('content-type') || '';
  let payload = {};
  if (contentType.includes('application/json')) {
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }
  }
  return { ok: response.ok && payload.ok !== false, status: response.status, data: payload, response };
}

/** Build a FormData object from a plain object (File values are kept as files). */
export function toFormData(obj) {
  const fd = new FormData();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === 'boolean') fd.append(k, v ? 'on' : '');
    else fd.append(k, v);
  });
  return fd;
}

/** Trigger a browser download for a fetch Response (used by admin exports). */
export async function downloadResponse(response, fallbackName = 'download') {
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const filename = match ? decodeURIComponent(match[1]) : fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
