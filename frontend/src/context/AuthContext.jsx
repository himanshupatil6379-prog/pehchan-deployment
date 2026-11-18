import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api.js';

/**
 * Current user (Django's `request.user`).
 * user = null when anonymous, otherwise:
 * { id, username, email, first_name, last_name, full_name, is_staff, is_superuser, is_active,
 *   date_joined, last_login }
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await apiFetch('/auth/me/');
    setUser(res.data?.user ?? null);
    setLoading(false);
    return res.data?.user ?? null;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ user, setUser, loading, refresh, isAuthenticated: !!user }),
    [user, loading, refresh]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
