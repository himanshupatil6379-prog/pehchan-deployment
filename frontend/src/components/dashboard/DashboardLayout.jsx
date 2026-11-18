import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PageStyle, { FONTS } from '../PageStyle.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDisplayedMessages } from '../../context/MessagesContext.jsx';
import useDocumentTitle from '../../hooks/useDocumentTitle.js';
import md3Css from '../../styles/md3.css?inline';
import layoutCss from './dashboard-layout.css?inline';

/**
 * Material Design 3 app shell for the logged-in User Dashboard area.
 * Replaces BaseLayout for those pages only (navigation drawer / rail / modal drawer,
 * top app bar with account menu, flash messages, footer).
 *
 * Props:
 *   title        – document title (same values BaseLayout received; default "Pehchan - Empowering Communities")
 *   heading      – short page name shown in the top app bar
 *   css          – page CSS string (or array) rendered after md3.css + the shell CSS
 *   variant      – 'app' (default, drawer + account menu) | 'public' (anonymous visitors: top app bar with
 *                  Home / Gallery / Login / Sign Up, no drawer)
 *   hideMessages – the page renders the flash messages itself (they are still consumed here, exactly like
 *                  BaseLayout's <Messages/>, but not shown twice)
 *   children     – page content
 */

const NAV_SECTIONS = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { to: '/dashboard/', label: 'Dashboard', icon: 'dashboard' },
      { to: '/dashboard/events/', label: 'Events', icon: 'event' },
      { to: '/certificates/', label: 'My Certificates', icon: 'verified' },
      { to: '/certificates/donor/', label: 'Donor Certificates', icon: 'workspace_premium' },
    ],
  },
  {
    id: 'contribute',
    label: 'Contribute',
    items: [
      { to: '/donate/material/', label: 'Donate Items', icon: 'inventory_2' },
      { to: '/donate/money/', label: 'Donate Money', icon: 'payments' },
      { to: '/volunteer/lifetime/', label: 'Lifetime Volunteer', icon: 'stars' },
    ],
  },
  {
    id: 'staff',
    label: 'Staff',
    staffOnly: true,
    items: [
      { to: '/admin-dashboard/', label: 'Admin Overview', icon: 'insights' },
      { to: '/admin/', label: 'Admin Panel', icon: 'admin_panel_settings' },
    ],
  },
  {
    id: 'website',
    label: 'Website',
    items: [
      { to: '/', label: 'Home', icon: 'home' },
      { to: '/gallery/', label: 'Gallery', icon: 'collections' },
      // The same page is also mounted at /dashboard/verify-certificate/.
      { to: '/verify-certificate/', label: 'Verify Certificate', icon: 'verified_user', also: ['/dashboard/verify-certificate/'] },
    ],
  },
];

const PUBLIC_LINKS = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/gallery/', label: 'Gallery', icon: 'collections' },
  { to: '/login/', label: 'Login', icon: 'login' },
  { to: '/signup/', label: 'Sign Up', icon: 'person_add' },
];

const MESSAGE_ICONS = { success: 'check_circle', error: 'error', warning: 'warning', info: 'info' };

/** django.contrib.messages level/tags → md-alert tone. */
export function messageTone(level) {
  const l = String(level || '').toLowerCase();
  if (l.includes('error') || l.includes('danger')) return 'error';
  if (l.includes('warning')) return 'warning';
  if (l.includes('success')) return 'success';
  return 'info';
}

/** Flash messages as M3 alerts. */
export function MessageAlerts({ messages, className = '' }) {
  if (!messages.length) return null;
  return (
    <div className={`md-alerts ${className}`.trim()}>
      {messages.map((m) => {
        const tone = messageTone(m.level);
        return (
          <div key={m.id} className={`md-alert md-alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
            <span className="md-icon" aria-hidden="true">
              {MESSAGE_ICONS[tone]}
            </span>
            <div className="md-alert__body">{m.text}</div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The nav item whose path (or alias) is the longest prefix of the current path ("/" only matches itself).
 * Returns { to, exact } or null.
 */
function activeTarget(pathname, items) {
  let best = null;
  items.forEach((it) => {
    [it.to, ...(it.also || [])].forEach((prefix) => {
      const match = prefix === '/' ? pathname === '/' : pathname.startsWith(prefix);
      if (match && (!best || prefix.length > best.length)) best = { to: it.to, length: prefix.length, exact: pathname === prefix };
    });
  });
  return best;
}

// Several dashboard pages can mount/unmount within one commit: only drop the body class
// when the last one is gone.
let bodyClassUsers = 0;
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export default function DashboardLayout({ title, heading, css, variant = 'app', hideMessages = false, children }) {
  const { user } = useAuth();
  const location = useLocation();
  // Always consumed here (same queue/consume behaviour as BaseLayout's <Messages/>).
  const messages = useDisplayedMessages();
  const isPublic = variant === 'public';
  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const drawerRef = useRef(null);
  const navBtnRef = useRef(null);
  const menuBtnRef = useRef(null);
  const menuRef = useRef(null);

  useDocumentTitle(title || 'Pehchan - Empowering Communities');

  // <body class="md3-body"> while a dashboard page is mounted (before paint, no flash).
  useIsoLayoutEffect(() => {
    bodyClassUsers += 1;
    document.body.classList.add('md3-body');
    return () => {
      bodyClassUsers -= 1;
      if (bodyClassUsers <= 0) {
        bodyClassUsers = 0;
        document.body.classList.remove('md3-body');
      }
    };
  }, []);

  // Close the drawer and the menus on navigation.
  useEffect(() => {
    setNavOpen(false);
    setMenuOpen(false);
  }, [location.key]);

  const closeNav = useCallback((restoreFocus) => {
    setNavOpen(false);
    if (restoreFocus && navBtnRef.current) navBtnRef.current.focus();
  }, []);

  // Modal drawer: Escape closes, focus moves into the drawer, page scroll is locked.
  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeNav(true);
    };
    document.addEventListener('keydown', onKey);
    const first = drawerRef.current && drawerRef.current.querySelector('a[href], button');
    if (first) first.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [navOpen, closeNav]);

  // The modal drawer only exists below 840px – close it when the window grows past that.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(min-width: 840px)');
    const onChange = (e) => {
      if (e.matches) setNavOpen(false);
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  // Account / site menu: outside click, Escape and Tab close it; focus goes to the first item.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointer = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && menuBtnRef.current && !menuBtnRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        if (menuBtnRef.current) menuBtnRef.current.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    const first = menuRef.current && menuRef.current.querySelector('[role="menuitem"]');
    if (first) first.focus();
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const onMenuKeyDown = (e) => {
    const items = Array.from(menuRef.current ? menuRef.current.querySelectorAll('[role="menuitem"]') : []);
    if (!items.length) return;
    const idx = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length].focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1].focus();
    } else if (e.key === 'Tab') {
      setMenuOpen(false);
    }
  };

  const sections = NAV_SECTIONS.filter((s) => !s.staffOnly || (user && user.is_staff));
  const active = activeTarget(
    location.pathname,
    sections.flatMap((s) => s.items)
  );

  const displayName = user ? user.full_name || user.username : '';
  const initial = Array.from(displayName || '').slice(0, 1).join('').toUpperCase() || 'P';
  const cssList = Array.isArray(css) ? css : css ? [css] : [];

  const main = (
    <main className="md-app__main" id="dash-main" tabIndex={-1}>
      <div className="md-app__content">
        {!hideMessages && <MessageAlerts messages={messages} className="dash-messages" />}

        {children}

        <footer className="dash-footer">
          <p>&copy; 2025 Pehchan - Empowering Communities, Nurturing Hope. All rights reserved.</p>
        </footer>
      </div>
    </main>
  );

  return (
    <>
      <PageStyle links={[FONTS.interJakarta, FONTS.materialIconsRound, FONTS.materialIcons]} css={[md3Css, layoutCss, ...cssList]} />

      {/* Focus is moved by hand: a "#hash" navigation would be a router navigation (re-fetch, messages dropped). */}
      <a
        className="dash-skip-link"
        href="#dash-main"
        onClick={(e) => {
          e.preventDefault();
          const el = document.getElementById('dash-main');
          if (el) el.focus();
        }}
      >
        Skip to main content
      </a>

      {isPublic ? (
        <div className="md-app dash-app dash-app--public">
          <header className="md-top-app-bar md-app__bar dash-topbar dash-topbar--public">
            <Link to="/" className="dash-public-brand">
              <img src="/static/images/logos/roundlogo.png" alt="" width="36" height="36" />
              <span>Pehchan</span>
            </Link>
            <div className="md-top-app-bar__spacer" />
            <nav className="dash-public-nav" aria-label="Site">
              {PUBLIC_LINKS.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`md-btn ${l.to === '/signup/' ? 'md-btn--filled' : l.to === '/login/' ? 'md-btn--outlined' : 'md-btn--text'}`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="md-menu-anchor dash-public-more">
              <button
                ref={menuBtnRef}
                type="button"
                className="md-icon-btn"
                aria-label="Open site menu"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls="dash-site-menu"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <span className="md-icon" aria-hidden="true">
                  {menuOpen ? 'close' : 'menu'}
                </span>
              </button>
              {menuOpen && (
                <div ref={menuRef} id="dash-site-menu" className="md-menu" role="menu" aria-label="Site" onKeyDown={onMenuKeyDown}>
                  {PUBLIC_LINKS.map((l) => (
                    <Link key={l.to} to={l.to} className="md-menu-item" role="menuitem" onClick={() => setMenuOpen(false)}>
                      <span className="md-icon" aria-hidden="true">
                        {l.icon}
                      </span>
                      {l.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </header>
          {main}
        </div>
      ) : (
        <div className="md-app dash-app">
          {/* Navigation drawer (rail on tablet, modal drawer on mobile) */}
          <nav
            ref={drawerRef}
            id="dash-nav-drawer"
            className={`md-nav-drawer md-app__drawer dash-drawer${navOpen ? ' is-open' : ''}`}
            aria-label="Dashboard navigation"
          >
            <div className="dash-drawer__head">
              <Link to="/dashboard/" className="md-nav-drawer__brand dash-drawer__brand" onClick={() => closeNav(false)}>
                <img src="/static/images/logos/roundlogo.png" alt="" width="36" height="36" />
                <span>
                  Pehchan
                  <small>User Dashboard</small>
                </span>
              </Link>
              <button type="button" className="md-icon-btn dash-drawer__close" aria-label="Close navigation menu" onClick={() => closeNav(true)}>
                <span className="md-icon" aria-hidden="true">
                  close
                </span>
              </button>
            </div>

            {sections.map((section) => (
              <div className="dash-nav-group" role="group" aria-labelledby={`dash-nav-${section.id}`} key={section.id}>
                <div className="md-nav-section" id={`dash-nav-${section.id}`}>
                  {section.label}
                </div>
                {section.items.map((item) => {
                  const isActive = !!active && active.to === item.to;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`md-nav-item${isActive ? ' is-active' : ''}`}
                      aria-current={isActive ? (active.exact ? 'page' : 'true') : undefined}
                      title={item.label}
                      onClick={() => closeNav(false)}
                    >
                      <span className="md-icon" aria-hidden="true">
                        {item.icon}
                      </span>
                      <span className="md-nav-item__label">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="md-scrim" onClick={() => closeNav(true)} aria-hidden="true" />

          {/* Top app bar */}
          <header className="md-top-app-bar md-app__bar dash-topbar">
            <button
              ref={navBtnRef}
              type="button"
              className="md-icon-btn md-top-app-bar__menu-btn"
              aria-label="Open navigation menu"
              aria-controls="dash-nav-drawer"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
            >
              <span className="md-icon" aria-hidden="true">
                menu
              </span>
            </button>
            <Link to="/dashboard/" className="dash-topbar__logo" aria-label="Pehchan dashboard">
              <img src="/static/images/logos/roundlogo.png" alt="" width="32" height="32" />
            </Link>
            <p className="md-top-app-bar__title dash-topbar__title">{heading}</p>
            <div className="md-top-app-bar__spacer" />

            {user && (
              <div className="md-menu-anchor">
                <button
                  ref={menuBtnRef}
                  type="button"
                  className="dash-account-btn"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-controls="dash-account-menu"
                  aria-label={`Account menu for ${displayName}`}
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <span className="md-avatar" aria-hidden="true">
                    {initial}
                  </span>
                  <span className="dash-account-btn__name" aria-hidden="true">
                    {displayName}
                  </span>
                  <span className="md-icon dash-account-btn__caret" aria-hidden="true">
                    expand_more
                  </span>
                </button>
                {menuOpen && (
                  <div
                    ref={menuRef}
                    id="dash-account-menu"
                    className="md-menu dash-account-menu"
                    role="menu"
                    aria-label="Account"
                    onKeyDown={onMenuKeyDown}
                  >
                    <div className="md-menu__header dash-account-menu__header" role="presentation">
                      <span className="md-avatar dash-account-menu__avatar" aria-hidden="true">
                        {initial}
                      </span>
                      <div className="dash-account-menu__who">
                        <p className="dash-account-menu__name" title={displayName}>
                          {displayName}
                        </p>
                        <p className="dash-account-menu__meta" title={user.username}>
                          @{user.username}
                        </p>
                        {user.email && (
                          <p className="dash-account-menu__meta" title={user.email}>
                            {user.email}
                          </p>
                        )}
                      </div>
                    </div>
                    <Link to="/logout/" className="md-menu-item" role="menuitem" onClick={() => setMenuOpen(false)}>
                      <span className="md-icon" aria-hidden="true">
                        logout
                      </span>
                      Logout
                    </Link>
                  </div>
                )}
              </div>
            )}
          </header>

          {main}
        </div>
      )}
    </>
  );
}
