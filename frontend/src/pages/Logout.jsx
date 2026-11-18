import { useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi.js';

/** pehchan.views.logout_view – logs out, flashes a message and redirects home. */
export default function Logout() {
  const request = useApi();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    request('/auth/logout/', { method: 'POST' });
  }, [request]);
  return null;
}
