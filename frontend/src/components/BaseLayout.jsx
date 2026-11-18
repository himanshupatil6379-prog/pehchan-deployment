import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PageStyle, { FONTS } from './PageStyle.jsx';
import Messages from './Messages.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import styleCss from '../styles/style.css?inline';
import baseCss from '../styles/base.css?inline';

/**
 * React port of templates/base.html.
 *
 * Props:
 *   title     – `{% block title %}` (defaults to "Pehchan - Empowering Communities")
 *   extraCss  – `{% block extra_css %}` inline CSS string (or array of strings)
 *   extraLinks– extra <link rel="stylesheet"> URLs from `{% block extra_css %}`
 *   children  – `{% block content %}`
 */
export default function BaseLayout({ title, extraCss, extraLinks, children }) {
  const { user } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const navRef = useRef(null);
  const toggleRef = useRef(null);

  useDocumentTitle(title || 'Pehchan - Empowering Communities');

  // Mobile drawer: close when clicking outside (base.html extra_js)
  useEffect(() => {
    function onDocClick(e) {
      if (navRef.current && !navRef.current.contains(e.target) && toggleRef.current && !toggleRef.current.contains(e.target)) {
        setNavOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  // Material Icons fallback detection (base.html extra_js)
  useEffect(() => {
    const timer = setTimeout(() => {
      const check = (cls) => {
        const el = document.createElement('span');
        el.className = cls;
        el.style.position = 'absolute';
        el.style.visibility = 'hidden';
        el.innerHTML = 'home';
        document.body.appendChild(el);
        const ff = window.getComputedStyle(el).getPropertyValue('font-family');
        document.body.removeChild(el);
        return ff.includes(cls === 'material-icons' ? 'Material Icons' : 'Material Icons Round');
      };
      if (!check('material-icons') && !check('material-icons-round')) {
        console.warn('Material Icons not loading, using fallbacks');
        document.body.classList.add('no-material-icons');
      }
    }, 1000);
    return () => {
      clearTimeout(timer);
      document.body.classList.remove('no-material-icons');
    };
  }, []);

  const closeNav = () => setNavOpen(false);

  return (
    <>
      <PageStyle
        links={[FONTS.materialIcons, FONTS.materialIconsRound, FONTS.interJakarta, ...(extraLinks || [])]}
        css={[styleCss, baseCss, ...(Array.isArray(extraCss) ? extraCss : extraCss ? [extraCss] : [])]}
      />

      {/* Header */}
      <header className="mdl-layout__header primary-app-bar">
        <div className="mdl-layout__header-row">
          <div className="mdl-layout-title">
            <Link to="/">
              <img
                src="/static/images/logos/roundlogo.png"
                alt="Pehchan"
                style={{ height: '42px', width: 'auto', border: 'none', borderRadius: '50%' }}
              />
              <span>Pehchan</span>
            </Link>
          </div>

          <div className="mdl-layout-spacer"></div>
          <button
            ref={toggleRef}
            className="base-mobile-toggle"
            aria-label="Toggle navigation"
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-800)', padding: '8px' }}
            onClick={(e) => {
              e.stopPropagation();
              setNavOpen((v) => !v);
            }}
          >
            <span className="material-icons-round" style={{ fontSize: '28px' }}>menu</span>
          </button>
          <nav ref={navRef} className={`mdl-navigation${navOpen ? ' active' : ''}`} id="baseNavMenu">
            <Link className="mdl-navigation__link" to="/" onClick={closeNav}>
              <span className="material-icons-round">home</span>
              Home
            </Link>
            <Link className="mdl-navigation__link" to="/gallery/" onClick={closeNav}>
              <span className="material-icons-round">collections</span>
              Gallery
            </Link>
            <Link className="mdl-navigation__link" to="/verify-certificate/" onClick={closeNav}>
              <span className="material-icons-round">verified_user</span>
              Verify Certificate
            </Link>
            {user ? (
              <>
                <Link className="mdl-navigation__link" to="/dashboard/" onClick={closeNav}>
                  <span className="material-icons-round">dashboard</span>
                  Dashboard
                </Link>
                <Link className="mdl-navigation__link" to="/dashboard/events/" onClick={closeNav}>
                  <span className="material-icons-round">event</span>
                  Events
                </Link>
                <Link className="mdl-navigation__link" to="/certificates/" onClick={closeNav}>
                  <span className="material-icons-round">verified</span>
                  Certificates
                </Link>
                <Link className="mdl-navigation__link" to="/logout/" onClick={closeNav}>
                  <span className="material-icons-round">logout</span>
                  Logout ({user.username})
                </Link>
              </>
            ) : (
              <>
                <Link className="mdl-navigation__link" to="/login/" onClick={closeNav}>
                  <span className="material-icons-round">login</span>
                  Login
                </Link>
                <Link className="mdl-navigation__link" to="/signup/" onClick={closeNav}>
                  <span className="material-icons-round">person_add</span>
                  Sign Up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Messages */}
      <Messages />

      {/* Main Content */}
      <main className="page-content1">{children}</main>

      {/* Footer */}
      <footer className="footer">
        <p className="georgia-brand">
          &copy; 2025 Pehchan - Empowering Communities, Nurturing Hope. All rights reserved.
        </p>
      </footer>
    </>
  );
}
