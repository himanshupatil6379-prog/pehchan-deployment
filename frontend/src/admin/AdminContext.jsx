import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api.js';
import { useMessages } from '../context/MessagesContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { normalizeTheme } from './theme.js';
import { apiPathFor, fullPath, loginUrl, normalizeMessages } from './utils.js';

/**
 * Admin-wide state: the admin session (GET /api/admin/session/), the active
 * django-admin-interface theme, the cached app_list used by the nav sidebar,
 * the page-specific stylesheets and the "is popup" flag (?_popup=1).
 */
const AdminContext = createContext(null);

const DEFAULT_SESSION = {
  user: null,
  site_header: 'Django administration',
  site_title: 'Django site admin',
  index_title: 'Site administration',
  site_url: '/',
};

function isStaff(user) {
  return !!(user && user.is_staff && user.is_active !== false);
}

export function AdminProvider({ children }) {
  const location = useLocation();
  const auth = useAuth();
  const setSiteUser = auth && auth.setUser;
  const [session, setSession] = useState(null);
  const [theme, setTheme] = useState(() => normalizeTheme(null));
  const [appList, setAppList] = useState(null);
  const [pageStyles, setPageStylesState] = useState([]);
  const appListRequest = useRef(0);

  useEffect(() => {
    let active = true;
    apiFetch('/api/admin/session/').then((res) => {
      if (!active) return;
      const d = res.data || {};
      if (res.status === 200 && d.ok !== false) {
        setSession({ ...DEFAULT_SESSION, ...d, user: d.user || null });
        setTheme(normalizeTheme(d.theme));
      } else {
        setSession({ ...DEFAULT_SESSION });
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const refreshAppList = useCallback(async () => {
    const reqId = ++appListRequest.current;
    const res = await apiFetch('/api/admin/');
    if (reqId !== appListRequest.current) return;
    if (res.ok && res.data && Array.isArray(res.data.app_list)) setAppList(res.data.app_list);
  }, []);

  const user = session ? session.user : null;
  const staff = isStaff(user);

  useEffect(() => {
    if (staff && appList === null) refreshAppList();
    if (!staff && appList !== null) setAppList(null);
  }, [staff, appList, refreshAppList]);

  const setAdminUser = useCallback(
    (u) => {
      setSession((s) => ({ ...(s || DEFAULT_SESSION), user: u || null }));
      if (setSiteUser) setSiteUser(u || null);
      if (!u) setAppList(null);
    },
    [setSiteUser]
  );

  const setPageStyles = useCallback((list) => {
    setPageStylesState((prev) => {
      const next = [...new Set(list || [])];
      return prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next;
    });
  }, []);

  const isPopup = new URLSearchParams(location.search).get('_popup') === '1';

  const value = useMemo(
    () => ({
      session: session || DEFAULT_SESSION,
      sessionLoaded: session !== null,
      user,
      isStaff: staff,
      theme,
      appList,
      setAppList,
      refreshAppList,
      setAdminUser,
      pageStyles,
      setPageStyles,
      isPopup,
    }),
    [session, user, staff, theme, appList, refreshAppList, setAdminUser, pageStyles, setPageStyles, isPopup]
  );
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  return useContext(AdminContext);
}

/** Tell the parent window (related-object modal) that the popup finished. */
export function notifyPopupParent(payload) {
  const msg = { type: 'pehchan-admin-popup', ...payload };
  try {
    if (window.parent && window.parent !== window) {
      // related modal (iframe)
      window.parent.postMessage(msg, window.location.origin);
      return true;
    }
    if (window.opener && window.opener !== window) {
      // classic popup window (related_modal_active = False)
      window.opener.postMessage({ ...msg, name: window.name }, window.location.origin);
      window.close();
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * POST/GET helper for admin forms – the admin flavour of hooks/useApi.js:
 *  - 401 → admin login page with ?next=<current page>,
 *  - pushes `messages`, applies `user`, follows `redirect`,
 *  - refreshes the cached app_list after successful writes (add links depend on data).
 */
export function useAdminRequest() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addMessages } = useMessages();
  const { setAdminUser, refreshAppList, isPopup } = useAdmin();

  return useCallback(
    async (path, options = {}) => {
      const { followRedirect = true, pushMessages = true, handle401 = true, ...fetchOptions } = options;
      const res = await apiFetch(path, fetchOptions);
      const d = res.data || {};
      if (handle401 && (res.status === 401 || d.login_required)) {
        setAdminUser(null);
        navigate(loginUrl(location));
        res.handled = true;
        return res;
      }
      if (Object.prototype.hasOwnProperty.call(d, 'user')) setAdminUser(d.user);
      const method = (fetchOptions.method || 'GET').toUpperCase();
      if (method !== 'GET' && res.ok) refreshAppList();
      if (isPopup && method !== 'GET' && res.ok && d.redirect && notifyPopupParent({ event: 'saved', redirect: d.redirect })) {
        res.redirected = true;
        return res;
      }
      if (pushMessages && d.messages && d.messages.length) addMessages(normalizeMessages(d.messages));
      if (followRedirect && d.redirect) {
        if (/^https?:\/\//.test(d.redirect)) window.location.assign(d.redirect);
        else navigate(d.redirect, { replace: !!d.replace });
        res.redirected = true;
      }
      return res;
    },
    [navigate, location, addMessages, setAdminUser, refreshAppList, isPopup]
  );
}

/** Django's "redirect to request.get_full_path()" after a POST. */
export function useReloadPage() {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => navigate(fullPath(location), { replace: true }), [navigate, location]);
}

/**
 * Loads the JSON for the current admin page (API path = "/api" + page path + query).
 * Re-fetches on every navigation (location.key), so redirecting to the same URL
 * after a POST reloads the page like Django does.
 * Returns { loading, data, status, version, reload }.
 */
export function useAdminPage(apiPath) {
  const location = useLocation();
  const navigate = useNavigate();
  const { addMessages } = useMessages();
  const { setAdminUser } = useAdmin();
  const path = apiPath || apiPathFor(location);
  const [state, setState] = useState({ loading: true, data: null, status: 0, ok: false, version: 0 });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    let active = true;
    setState((s) => ({ ...s, loading: true }));
    apiFetch(path, { signal: ctrl.signal })
      .then((res) => {
        if (!active) return;
        const d = res.data || {};
        if (res.status === 401 || d.login_required) {
          setAdminUser(null);
          navigate(loginUrl(location), { replace: true });
          return;
        }
        if (d.messages && d.messages.length) addMessages(normalizeMessages(d.messages));
        if (d.redirect) {
          if (/^https?:\/\//.test(d.redirect)) window.location.assign(d.redirect);
          else navigate(d.redirect, { replace: true });
          return;
        }
        setState((s) => ({ loading: false, data: d, status: res.status, ok: res.ok, version: s.version + 1 }));
      })
      .catch((err) => {
        if (err && err.name === 'AbortError') return;
        if (active) setState((s) => ({ ...s, loading: false, status: 500, ok: false, version: s.version + 1 }));
      });
    return () => {
      active = false;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, location.key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
