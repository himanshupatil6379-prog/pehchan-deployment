import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDisplayedMessages } from '../context/MessagesContext.jsx';
import { useAdmin, useAdminRequest } from './AdminContext.jsx';
import { themeBodyClasses } from './theme.js';
import { capfirst, SERVER_UTC_OFFSET } from './utils.js';
import { BRAND_LOGO, messageTone } from './icons.js';
import NavSidebar from './components/NavSidebar.jsx';

const NAV_OPEN_KEY = 'django.admin.navSidebarIsOpen';
const DESKTOP_QUERY = '(min-width: 1200px)';

/** Read the stored colour theme (admin/js/theme.js initTheme()). */
export function storedThemeMode() {
  let mode = 'auto';
  try {
    mode = localStorage.getItem('theme') || 'auto';
  } catch {
    /* ignore */
  }
  return mode === 'light' || mode === 'dark' || mode === 'auto' ? mode : 'auto';
}

function useMediaQuery(query) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : true);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);
  return matches;
}

/**
 * Material Design 3 admin shell (port of admin/base.html + base_site.html).
 *
 * Props (≈ template blocks):
 *   title          {{ title }} – page <h1> and <title>
 *   heading        visual <h1> text when it differs from `title`
 *   overline       small label above the <h1>
 *   docTitle       {% block title %} override (full document title)
 *   subtitle       {{ subtitle }} – text under the title
 *   actions        page header actions ({% block object-tools %})
 *   bodyClass      extra {% block bodyclass %} classes
 *   breadcrumbs    false (none) | array of [label, href?] after "Home"
 *   navSidebar     show the navigation drawer (default true, staff only)
 *   variant        'shell' (default) | 'center' (login / logged out card pages)
 *   contentTitle   false → no page header
 *   userTools      'default' | 'password' (registration/password_change_*.html) | false
 *   sidebar        {% block sidebar %}
 *   extraCss       inline <style> from {% block extrastyle %}
 *   pending        page data still loading (render the chrome only)
 */
export default function AdminLayout({
  title,
  heading,
  overline,
  docTitle,
  subtitle,
  actions = null,
  bodyClass = '',
  breadcrumbs,
  navSidebar = true,
  variant = 'shell',
  contentTitle = true,
  userTools = 'default',
  sidebar = null,
  extraCss = null,
  pending = false,
  children,
}) {
  const { theme, session, isPopup, isStaff } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();

  // ---- <body class="…" data-admin-utc-offset="…"> ----
  const classes = useMemo(() => {
    const list = [];
    if (isPopup) list.push('popup');
    list.push(...themeBodyClasses(theme));
    String(bodyClass || '')
      .split(/\s+/)
      .filter(Boolean)
      .forEach((c) => list.push(c));
    return list;
  }, [isPopup, theme, bodyClass]);
  const classKey = classes.join(' ');
  useLayoutEffect(() => {
    const body = document.body;
    const added = classes.filter((c) => !body.classList.contains(c));
    added.forEach((c) => body.classList.add(c));
    return () => added.forEach((c) => body.classList.remove(c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classKey]);
  useEffect(() => {
    document.body.setAttribute('data-admin-utc-offset', String(SERVER_UTC_OFFSET));
    return () => document.body.removeAttribute('data-admin-utc-offset');
  }, []);

  // ---- <title> ----
  const siteTitle = theme.title || session.site_title || 'Django administration';
  const fullTitle = docTitle || (title ? `${title} | ${siteTitle}` : siteTitle);
  useEffect(() => {
    if (!pending) document.title = fullTitle;
  }, [fullTitle, pending]);

  // ---- navigation drawer ----
  // Desktop: collapsible drawer, state persisted like admin/js/nav_sidebar.js.
  // Tablet (rail) / mobile (modal): temporary drawer that closes on navigation / Escape / scrim.
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [navOpen, setNavOpen] = useState(() => {
    try {
      return (localStorage.getItem(NAV_OPEN_KEY) ?? 'true') === 'true';
    } catch {
      return true;
    }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuBtnRef = useRef(null);

  const toggleNav = useCallback(() => {
    setNavOpen((open) => {
      const next = !open;
      try {
        localStorage.setItem(NAV_OPEN_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const onMenuClick = () => {
    const desktop = window.matchMedia ? window.matchMedia(DESKTOP_QUERY).matches : true;
    if (desktop) toggleNav();
    else setDrawerOpen((o) => !o);
  };

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.key]);
  useEffect(() => {
    if (isDesktop) setDrawerOpen(false);
  }, [isDesktop]);
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const nav = document.getElementById('nav-sidebar');
    const first = nav && nav.querySelector('a[href], button, input');
    if (first) first.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        if (menuBtnRef.current) menuBtnRef.current.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // Plain <a href="/admin/..."> links (server-rendered HTML cells, deleted objects,
  // readonly displays…) navigate inside the SPA like a normal page load would.
  const onContainerClick = useCallback(
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      const raw = a.getAttribute('href');
      if (!raw || raw.startsWith('#')) return;
      if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      let url;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin || !url.pathname.startsWith('/admin/')) return;
      e.preventDefault();
      navigate(`${url.pathname}${url.search}${url.hash}`);
    },
    [navigate]
  );

  const crumbs = breadcrumbs === undefined ? (title ? [[title]] : []) : breadcrumbs;
  const siteHeader = theme.title || session.site_header || 'Django administration';

  const pageHeader =
    contentTitle && title ? (
      <div className="md-page-header adm-page-header">
        <div className="md-page-header__text">
          {overline ? <p className="md-overline adm-page-header__overline">{overline}</p> : null}
          <h1 className="md-page-header__title">{heading || title}</h1>
          {subtitle ? <h2 className="md-page-header__subtitle adm-page-header__subtitle">{subtitle}</h2> : null}
        </div>
        {actions ? <div className="md-page-header__actions">{actions}</div> : null}
      </div>
    ) : null;

  const body = pending ? (
    <PageSkeleton />
  ) : (
    <>
      {pageHeader}
      {children}
      {sidebar}
    </>
  );

  // ---- related-object popup (iframe / window): content only ----
  if (isPopup) {
    return (
      <>
        {extraCss ? <style>{extraCss}</style> : null}
        <div id="container" className="adm-root adm-popup" onClick={onContainerClick}>
          <main id="main" className="adm-popup__main">
            <div id="content-start" className="adm-popup__content" tabIndex={-1}>
              <MessageList />
              <div id="content" className="adm-content">
                {body}
              </div>
            </div>
          </main>
        </div>
      </>
    );
  }

  // ---- centred card pages (login, logged out) ----
  if (variant === 'center') {
    return (
      <>
        {extraCss ? <style>{extraCss}</style> : null}
        <div id="container" className="adm-root adm-center" onClick={onContainerClick}>
          <main id="main" className="adm-center__main">
            <div id="content-start" className="adm-center__inner" tabIndex={-1}>
              <MessageList />
              <div id="content" className="adm-center__content">
                {pending ? (
                  <div className="adm-center__pending" role="status" aria-live="polite">
                    <span className="md-spinner" aria-hidden="true"></span>
                    <span className="md-visually-hidden">Loading…</span>
                  </div>
                ) : (
                  <>
                    {pageHeader}
                    {children}
                  </>
                )}
              </div>
            </div>
          </main>
        </div>
      </>
    );
  }

  const showDrawer = navSidebar && isStaff;
  const expanded = isDesktop ? navOpen : drawerOpen;
  const containerClass = [
    'adm-root',
    'md-app',
    'adm-app',
    showDrawer ? '' : 'adm-app--no-drawer',
    showDrawer && !navOpen ? 'is-nav-collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {extraCss ? <style>{extraCss}</style> : null}
      <a
        href="#content-start"
        className="adm-skip-link skip-to-content-link"
        onClick={(e) => {
          e.preventDefault();
          const el = document.getElementById('content-start');
          if (el) el.focus();
        }}
      >
        Skip to main content
      </a>
      {/* Container */}
      <div id="container" className={containerClass} onClick={onContainerClick}>
        {showDrawer ? <NavSidebar open={drawerOpen} /> : null}
        {showDrawer ? <div className="md-scrim" aria-hidden="true" onClick={closeDrawer}></div> : null}

        <header id="header" className="md-top-app-bar md-app__bar adm-bar">
          {showDrawer ? (
            <button
              ref={menuBtnRef}
              type="button"
              id="toggle-nav-sidebar"
              className="md-icon-btn md-top-app-bar__menu-btn adm-bar__menu"
              aria-label="Toggle navigation"
              aria-controls="nav-sidebar"
              aria-expanded={expanded ? 'true' : 'false'}
              onClick={onMenuClick}
            >
              <span className="md-icon" aria-hidden="true">
                {isDesktop && navOpen ? 'menu_open' : 'menu'}
              </span>
            </button>
          ) : (
            <Link to="/admin/" className="adm-bar__brand" aria-label={`${siteHeader} – home`}>
              <img src={BRAND_LOGO} alt="" width="32" height="32" />
              <span className="adm-bar__brand-name">Pehchan</span>
            </Link>
          )}
          {breadcrumbs !== false ? (
            <Breadcrumbs crumbs={crumbs} />
          ) : (
            <p className="md-top-app-bar__title adm-bar__title">{title || siteHeader}</p>
          )}
          <div className="md-top-app-bar__spacer"></div>
          <UserTools mode={userTools} />
        </header>

        <main id="main" className="md-app__main adm-main">
          <div id="content-start" className="md-app__content" tabIndex={-1}>
            <MessageList />
            {/* Content */}
            <div id="content" className="adm-content">
              {body}
            </div>
            {/* END Content */}
          </div>
        </main>
      </div>
      {/* END Container */}
    </>
  );
}

/** Breadcrumb trail in the top app bar ("Home › App › Model › Object"). */
function Breadcrumbs({ crumbs }) {
  const last = crumbs.length - 1;
  return (
    <nav aria-label="Breadcrumbs" className="adm-crumbs">
      <ol className="breadcrumbs">
        <li>
          <Link to="/admin/" className="adm-crumbs__home" aria-current={last < 0 ? 'page' : undefined}>
            <span className="md-icon" aria-hidden="true">
              home
            </span>
            <span className="adm-crumbs__home-label">Home</span>
          </Link>
        </li>
        {crumbs.map(([label, href], i) => (
          <li key={i}>
            <span className="md-icon adm-crumbs__sep" aria-hidden="true">
              chevron_right
            </span>
            {href ? (
              <Link to={href} title={typeof label === 'string' ? label : undefined}>
                {label}
              </Link>
            ) : (
              <span className="adm-crumbs__current" aria-current={i === last ? 'page' : undefined} title={typeof label === 'string' ? label : undefined}>
                {label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Loading placeholder for the content area while the page JSON loads. */
function PageSkeleton() {
  return (
    <div className="adm-loading" role="status" aria-live="polite" aria-busy="true">
      <span className="md-visually-hidden">Loading…</span>
      <span className="md-skeleton adm-skel adm-skel--overline"></span>
      <span className="md-skeleton adm-skel adm-skel--title"></span>
      <span className="md-skeleton adm-skel adm-skel--card"></span>
      <span className="md-skeleton adm-skel adm-skel--card adm-skel--short"></span>
    </div>
  );
}

/** {% block messages %} as M3 alerts. */
function MessageList() {
  const messages = useDisplayedMessages();
  if (!messages.length) return null;
  return (
    <ul className="messagelist md-alerts adm-messages" aria-live="polite">
      {messages.map((m) => {
        const { tone, icon } = messageTone(m.level);
        return (
          <li key={m.id} className={`md-alert md-alert--${tone}${m.level ? ` ${m.level}` : ''}`} role={tone === 'error' ? 'alert' : 'status'}>
            <span className="md-icon" aria-hidden="true">
              {icon}
            </span>
            <div className="md-alert__body">{capfirst(m.text)}</div>
          </li>
        );
      })}
    </ul>
  );
}

/** {% block usertools %}: environment label, View site, theme toggle and the account menu. */
function UserTools({ mode }) {
  const { theme, session, isStaff, user } = useAdmin();
  const show = mode !== false && isStaff && user;
  if (!show) return null;
  const shortName = user.first_name || user.username;
  const usable = user.has_usable_password !== false;
  const siteUrl = session.site_url || '/';

  return (
    <div id="user-tools" className="adm-user-tools">
      {theme.env_visible_in_header && theme.env_name ? (
        <span className={`environment-label adm-env-label ${theme.env_name}`} style={theme.env_color ? { '--adm-env-color': theme.env_color } : undefined}>
          {theme.env_name}
        </span>
      ) : null}
      {mode !== 'password' ? (
        <Link to={siteUrl} className="md-btn md-btn--text adm-bar__site adm-hide-sm">
          <span className="md-icon" aria-hidden="true">
            public
          </span>
          View site
        </Link>
      ) : null}
      <ThemeToggle />
      <AccountMenu user={user} shortName={shortName} usable={usable} mode={mode} siteUrl={siteUrl} />
    </div>
  );
}

function AccountMenu({ user, shortName, usable, mode, siteUrl }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const initial = String(shortName || '?').trim().charAt(0) || '?';

  useEffect(() => {
    setOpen(false);
  }, [location.key]);

  useEffect(() => {
    if (!open) return undefined;
    const items = () =>
      Array.from(menuRef.current ? menuRef.current.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])') : []).filter(
        (el) => el.getClientRects().length > 0
      );
    const first = items()[0];
    if (first) first.focus({ preventScroll: true });
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        if (btnRef.current) btnRef.current.focus();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const list = items();
        if (!list.length) return;
        e.preventDefault();
        const idx = list.indexOf(document.activeElement);
        const next = e.key === 'ArrowDown' ? (idx + 1) % list.length : (idx - 1 + list.length) % list.length;
        list[next].focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="md-menu-anchor adm-account" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className="adm-account__btn"
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls="adm-account-menu"
        aria-label={`Account menu for ${shortName}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="md-avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="adm-account__name adm-hide-sm">{shortName}</span>
        <span className="md-icon adm-account__caret" aria-hidden="true">
          expand_more
        </span>
      </button>
      <div className="md-menu adm-account__menu" id="adm-account-menu" role="menu" aria-label="Account" ref={menuRef} hidden={!open}>
        <div className="md-menu__header adm-account__header" role="presentation">
          <span className="md-avatar" aria-hidden="true">
            {initial}
          </span>
          <div className="adm-account__who">
            <p className="adm-account__welcome">
              Welcome, <strong>{shortName}</strong>.
            </p>
            {user.email || user.username !== shortName ? (
              <p className="adm-account__meta">{user.email || user.username}</p>
            ) : null}
          </div>
        </div>
        {mode !== 'password' ? (
          <Link to={siteUrl} className="md-menu-item adm-show-sm" role="menuitem">
            <span className="md-icon" aria-hidden="true">
              public
            </span>
            View site
          </Link>
        ) : null}
        {mode === 'password' ? (
          <span className="md-menu-item adm-account__current" role="menuitem" aria-disabled="true" aria-current="page">
            <span className="md-icon" aria-hidden="true">
              password
            </span>
            Change password
          </span>
        ) : usable ? (
          <Link to="/admin/password_change/" className="md-menu-item" role="menuitem">
            <span className="md-icon" aria-hidden="true">
              password
            </span>
            Change password
          </Link>
        ) : null}
        <LogoutForm />
      </div>
    </div>
  );
}

/** Django 5: "Log out" is a POST form. */
function LogoutForm() {
  const request = useAdminRequest();
  const navigate = useNavigate();
  const { setAdminUser } = useAdmin();
  const onSubmit = async (e) => {
    e.preventDefault();
    await request('/api/admin/logout/', { method: 'POST', followRedirect: false, handle401: false, pushMessages: false });
    setAdminUser(null);
    navigate('/admin/logout/', { state: { loggedOut: true } });
  };
  return (
    <form id="logout-form" className="adm-account__logout" method="post" action="/admin/logout/" onSubmit={onSubmit} role="none">
      <button type="submit" className="md-menu-item" role="menuitem">
        <span className="md-icon" aria-hidden="true">
          logout
        </span>
        Log out
      </button>
    </form>
  );
}

const THEME_ICONS = { auto: 'brightness_auto', light: 'light_mode', dark: 'dark_mode' };

/** admin/color_theme_toggle.html + admin/js/theme.js (cycles auto → light/dark). */
function ThemeToggle() {
  const [mode, setMode] = useState(() => (typeof window === 'undefined' ? 'auto' : storedThemeMode()));
  const cycle = () => {
    let current = 'auto';
    try {
      current = localStorage.getItem('theme') || 'auto';
    } catch {
      /* ignore */
    }
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    let next;
    if (prefersDark) next = current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto';
    else next = current === 'auto' ? 'dark' : current === 'dark' ? 'light' : 'auto';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* ignore */
    }
    setMode(next);
  };
  const label = `Toggle theme (current theme: ${mode})`;
  return (
    <button type="button" className="md-icon-btn theme-toggle" onClick={cycle} aria-label={label} title={label}>
      <span className="md-icon" aria-hidden="true">
        {THEME_ICONS[mode] || THEME_ICONS.auto}
      </span>
    </button>
  );
}
