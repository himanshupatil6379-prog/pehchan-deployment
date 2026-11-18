import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api.js';
import { useMessages } from '../context/MessagesContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * const request = useApi();
 * const res = await request('/dashboard/', { query: { upcoming_search } });
 * const res = await request('/auth/login/', { method: 'POST', data: { username, password } });
 * const res = await request('/donations/money/', { method: 'POST', formData });
 *
 * Automatically:
 *  - pushes `messages` into the flash-message queue,
 *  - updates the logged-in user when the response carries `user`,
 *  - navigates when the response carries `redirect` (pass { followRedirect: false } to disable).
 * Returns { ok, status, data }.
 */
export function useApi() {
  const navigate = useNavigate();
  const { addMessages } = useMessages();
  const { setUser } = useAuth();

  return useCallback(
    async (path, options = {}) => {
      const { followRedirect = true, ...fetchOptions } = options;
      const res = await apiFetch(path, fetchOptions);
      const d = res.data || {};
      if (res.status >= 500) {
        // handler500 -> render templates/500.html (see App.jsx)
        window.dispatchEvent(new CustomEvent('pehchan:server-error'));
        return res;
      }
      if (Object.prototype.hasOwnProperty.call(d, 'user')) setUser(d.user);
      if (d.messages && d.messages.length) addMessages(d.messages);
      if (followRedirect && d.redirect) {
        if (/^https?:\/\//.test(d.redirect)) window.location.assign(d.redirect);
        else navigate(d.redirect, { replace: !!d.replace });
        res.redirected = true;
      }
      return res;
    },
    [navigate, addMessages, setUser]
  );
}
