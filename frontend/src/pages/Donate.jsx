import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import PageStyle, { FONTS } from '../components/PageStyle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDisplayedMessages } from '../context/MessagesContext.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import styleCss from '../styles/style.css?inline';
import pageCss from './css/donate.css?inline';

/**
 * React port of templates/donate.html (view `public_donate`, standalone page).
 *
 * The template renders no form at all (the view's signup / login / anonymous_donation
 * POST branches are never reachable from this page), so neither does this port.
 * The UPI id is hard-coded in the template and stays hard-coded here.
 */

const TAB_BTN_STYLE = {
  padding: '12px 30px',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '16px',
  fontWeight: 500,
  transition: 'all 0.3s',
};

// showTab(): inline styles applied to the active / inactive tab buttons.
const TAB_BTN_ACTIVE = {
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  border: 'none',
};
const TAB_BTN_INACTIVE = {
  background: '#f8f9fa',
  color: '#333',
  border: '2px solid #667eea',
};

const MESSAGE_CLASS = { success: 'message-success', error: 'message-error' };

/** static/js/script.js: mobile menu toggle + navbar `.scrolled` on scroll. */
function useNavbarScript() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return {
    menuOpen,
    scrolled,
    toggleMenu: () => setMenuOpen((v) => !v),
    closeMenu: () => setMenuOpen(false),
  };
}

/** static/js/script.js: auto-hide `.message` elements 5 s after they appear. */
function useAutoHide(messages) {
  const [fading, setFading] = useState({});
  const [removed, setRemoved] = useState({});
  const timers = useRef(new Map());
  const idsKey = messages.map((m) => m.id).join(',');

  useEffect(() => {
    messages.forEach((m) => {
      if (timers.current.has(m.id)) return;
      const list = [];
      list.push(
        setTimeout(() => {
          setFading((f) => ({ ...f, [m.id]: true }));
          list.push(setTimeout(() => setRemoved((r) => ({ ...r, [m.id]: true })), 500));
        }, 5000)
      );
      timers.current.set(m.id, list);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((list) => list.forEach(clearTimeout));
      map.clear();
    };
  }, []);

  return { fading, removed };
}

export default function Donate() {
  const { user } = useAuth();
  const location = useLocation();
  const messages = useDisplayedMessages();
  const { fading, removed } = useAutoHide(messages);
  const { menuOpen, scrolled, toggleMenu, closeMenu } = useNavbarScript();
  const [tab, setTab] = useState(() => (location.hash === '#anonymous' ? 'anonymous' : 'donate'));

  useDocumentTitle('Donate - Pehchan');

  // DOMContentLoaded: show the tab matching the URL hash (every page load / navigation).
  useEffect(() => {
    setTab(location.hash === '#anonymous' ? 'anonymous' : 'donate');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const showAnonymous = () => {
    // showTab('anonymous'); window.location.hash = 'anonymous';
    // A same-document fragment navigation: new history entry + scroll to #anonymous,
    // without a router navigation (the page is not reloaded in the original either).
    flushSync(() => setTab('anonymous'));
    if (window.location.hash !== '#anonymous') {
      window.history.pushState(window.history.state, '', '#anonymous');
    }
    const el = document.getElementById('anonymous');
    if (el) el.scrollIntoView();
  };

  const donateHref = user ? '/donate/money/' : '/donate-info/#support';

  return (
    <>
      <PageStyle links={[FONTS.materialIcons, FONTS.poppins]} css={[styleCss, pageCss]} />

      {/* Navbar */}
      <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
        <div className="nav-container">
          <ul className={`nav-links${menuOpen ? ' active' : ''}`}>
            <li><Link to="/" onClick={closeMenu}>HOME</Link></li>
            <li><Link to="/gallery/" onClick={closeMenu}>GALLERY</Link></li>
            <li><Link to="/events/" onClick={closeMenu}>EVENTS</Link></li>
            <li><Link to="/volunteer-info/" onClick={closeMenu}>VOLUNTEER</Link></li>
            <li><Link to="/about/" onClick={closeMenu}>ABOUT US</Link></li>
            {user ? (
              <li><Link to="/dashboard/" onClick={closeMenu}>DASHBOARD</Link></li>
            ) : (
              <>
                <li><Link to="/login/" onClick={closeMenu}>LOGIN</Link></li>
                <li><Link to="/signup/" onClick={closeMenu}>SIGN UP</Link></li>
              </>
            )}
          </ul>
          <Link to={donateHref} className="donate-btn">Donate Now</Link>
          <div className={`mobile-menu-toggle${menuOpen ? ' active' : ''}`} onClick={toggleMenu}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </nav>

      {/* Hero section */}
      <section className="hero-banner">
        <img src="/static/images/background.png" alt="Hero Banner" className="banner-img" />
        <div className="hero-content">
          <img src="/static/images/PEHCHANlogo.png" className="hero-logo" alt="Pehchan Logo" />
          <h1 className="hero-title-green">Pehchan</h1>
          <h2 className="hero-title-blue">YUI Foundation</h2>
          <div className="hero-buttons">
            <Link to={user ? '/volunteer/lifetime/' : '/volunteer-info/'} className="btn-join">JOIN US</Link>
            <Link to={donateHref} className="btn-donate-hero">DONATE</Link>
          </div>
        </div>
      </section>

      {/* Page Title */}
      <section className="page-title" id="support">
        <h1>Support Our Cause</h1>
      </section>

      {/* Messages */}
      {messages.length > 0 && (
        <div className="container" style={{ marginTop: '20px' }}>
          {messages
            .filter((m) => !removed[m.id])
            .map((m) => (
              <div
                key={m.id}
                className={`message ${MESSAGE_CLASS[m.level] || 'message-warning'}`}
                style={{
                  padding: '15px',
                  margin: '10px 0',
                  borderRadius: '5px',
                  ...(fading[m.id] ? { opacity: '0', transition: 'opacity 0.5s ease' } : null),
                }}
              >
                {m.text}
              </div>
            ))}
        </div>
      )}

      {/* Tabs */}
      <section className="donate-tabs-section">
        <div className="container">
          {/* Tab Navigation */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setTab('donate')}
              id="tab-donate"
              className={`tab-btn${tab === 'donate' ? ' active' : ''}`}
              style={{ ...TAB_BTN_STYLE, ...(tab === 'donate' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE) }}
            >
              Login to Donate
            </button>
            <button
              onClick={showAnonymous}
              id="tab-anonymous"
              className={`tab-btn${tab === 'anonymous' ? ' active' : ''}`}
              style={{ ...TAB_BTN_STYLE, ...(tab === 'anonymous' ? TAB_BTN_ACTIVE : TAB_BTN_INACTIVE) }}
            >
              Donate as Anonymous
            </button>
          </div>

          {/* Donate Tab */}
          <div id="donate" className="tab-panel active" style={{ display: tab === 'donate' ? 'block' : 'none' }}>
            <div className="donate-content">
              <h2>Make a Donation</h2>
              <p>Your generous contribution helps us continue our mission</p>

              {/* Login Message */}
              <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '30px', borderRadius: '10px', textAlign: 'center', margin: '30px 0' }}>
                <i className="material-icons" style={{ fontSize: '48px', marginBottom: '15px' }}>volunteer_activism</i>
                <h3 style={{ margin: '15px 0' }}>Want to Make a Donation?</h3>
                <p style={{ fontSize: '18px', margin: '15px 0' }}>
                  Please login to your account to donate. You can choose to donate materials or money as per your wish.
                </p>
              </div>
            </div>
          </div>

          {/* Anonymous Donation Tab */}
          <div id="anonymous" className="tab-panel" style={{ display: tab === 'anonymous' ? 'block' : 'none' }}>
            <div className="donate-content">
              <h2>Donate as Anonymous</h2>
              <p style={{ color: '#666', marginBottom: '30px' }}>
                Support our cause without creating an account. Your contribution makes a difference!
              </p>

              <div className="form-section" style={{ maxWidth: '600px', margin: '0 auto', gridColumn: 'span 2' }}>
                <h3><span className="material-icons">qr_code_scanner</span> Donate via UPI</h3>
                <p style={{ color: '#666', fontSize: '14px', marginBottom: '25px' }}>
                  Scan the QR code or use the UPI ID to make your payment
                </p>

                <div className="qr-code-container">
                  <img
                    src="/static/images/pehchan_QRcode.jpeg"
                    alt="Pehchan QR Code"
                    style={{ maxWidth: '220px', height: 'auto', borderRadius: '8px', display: 'block' }}
                    loading="lazy"
                  />
                  <p style={{ margin: '20px 0 8px 0', fontWeight: 700, color: '#1a1a1a', fontSize: '1.2rem', letterSpacing: '-0.5px' }}>
                    Scan QR Code to Pay
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', color: '#666', fontWeight: 500 }}>Any UPI app works</p>
                </div>

                <div className="upi-id-box">
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>
                    UPI ID: <span style={{ fontFamily: 'monospace', fontSize: '16px' }}>anikshaupadhyay2001@okicici</span>
                  </p>
                </div>

                <div className="note-box">
                  <p>
                    💡 <strong>Note:</strong> For tax benefits and tracking, we recommend creating a free account and using the regular donation process.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-col">
              <img src="/static/images/logos/location_logo.png" alt="Pehchan Location" style={{ height: '80px', marginBottom: '0.5rem' }} loading="lazy" />
            </div>
            <div className="footer-col">
              <h4>Quick Links</h4>
              <ul>
                <li><Link to="/">Home</Link></li>
                <li><Link to="/gallery/">Gallery</Link></li>
                <li><Link to="/events/">Events</Link></li>
                <li><Link to="/volunteer-info/">Volunteer</Link></li>
                <li><Link to="/about/">About Us</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Contact Us</h4>
              <p>Mumbai, Maharashtra, India</p>
              <p>madad@pehchanyui.in</p>
              <p>+91 98928 87992</p>
            </div>
          </div>
        </div>
      </footer>
      <div className="footer-bottom">
        <p>Copyright © Pehchan YUI Foundation. All rights reserved.</p>
      </div>
    </>
  );
}
