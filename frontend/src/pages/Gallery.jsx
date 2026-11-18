import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageStyle, { FONTS } from '../components/PageStyle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import styleCss from '../styles/style.css?inline';
import galleryCss from './css/gallery.css?inline';

/**
 * Port of static/js/script.js (mobile menu toggle, navbar `.scrolled` on scroll,
 * auto-hide `.message` / `.alert-success` / `.alert-error` after 5 s).
 */
function useSiteScript() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Header scroll effect
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-hide alerts after 5 seconds
  useEffect(() => {
    const timers = [];
    document.querySelectorAll('.message, .alert-success, .alert-error').forEach((alert) => {
      timers.push(
        setTimeout(() => {
          alert.style.opacity = '0';
          alert.style.transition = 'opacity 0.5s ease';
          // alert.remove() in the original – hidden instead so React keeps ownership of the node
          timers.push(setTimeout(() => { alert.style.display = 'none'; }, 500));
        }, 5000)
      );
    });
    console.log('Pehchan UI Initialized');
    return () => timers.forEach(clearTimeout);
  }, []);

  return {
    menuOpen,
    scrolled,
    toggleMenu: () => setMenuOpen((v) => !v),
    // Close mobile menu when a link is clicked
    closeMenu: () => setMenuOpen(false),
  };
}

/** templates/gallery.html (view `public_gallery`). */
export default function Gallery() {
  const { user } = useAuth();
  const { menuOpen, scrolled, toggleMenu, closeMenu } = useSiteScript();
  useDocumentTitle('Gallery - Pehchan');

  return (
    <>
      <PageStyle links={[FONTS.poppins]} css={[styleCss, galleryCss]} />

      {/* Navbar */}
      <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
        <div className="nav-container">

          <ul className={`nav-links${menuOpen ? ' active' : ''}`}>
            <li><Link to="/" onClick={closeMenu}>HOME</Link></li>
            <li><Link to="/gallery/" className="active" onClick={closeMenu}>GALLERY</Link></li>
            <li><Link to="/events/" onClick={closeMenu}>EVENTS</Link></li>
            <li><Link to="/volunteer-info/" onClick={closeMenu}>VOLUNTEER</Link></li>
            <li><Link to="/about/" onClick={closeMenu}>ABOUT US</Link></li>
            <li><Link to="/verify-certificate/" onClick={closeMenu}>VERIFY CERTIFICATE</Link></li>
            {user ? (
              <li><Link to="/dashboard/" onClick={closeMenu}>DASHBOARD</Link></li>
            ) : (
              <>
                <li><Link to="/login/" onClick={closeMenu}>LOGIN</Link></li>
                <li><Link to="/signup/" onClick={closeMenu}>SIGN UP</Link></li>
              </>
            )}
          </ul>
          <Link to={user ? '/donate/money/' : '/donate-info/#support'} className="donate-btn">Donate Now</Link>
          <div className={`mobile-menu-toggle${menuOpen ? ' active' : ''}`} onClick={toggleMenu}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </nav>

      {/* Page Title */}
      <section className="page-title">
        <h1>GALLERY</h1>
      </section>

      {/* Gallery Sections */}
      <section className="gallery-section">
        <div className="container">
          {/* Drawing Competition */}
          {/* Drawing Competition section removed due to missing static files causing 500 errors */}

          {/* Best Out of Waste */}
          <div className="gallery-category">
            <h2>RATION DISTRIBUTION DRIVE</h2>
            <div className="gallery-grid-3">
              <img src="/static/images/events/poverty/53.png" alt="Ration Distribution" loading="lazy" />
              <img src="/static/images/events/poverty/50.png" alt="Ration Distribution" loading="lazy" />
              <img src="/static/images/events/poverty/51.png" alt="Ration Distribution" loading="lazy" />
              <img src="/static/images/events/poverty/41.png" alt="Ration Distribution" loading="lazy" />
              <img src="/static/images/events/poverty/49.png" alt="Ration Distribution" loading="lazy" />
              <img src="/static/images/events/poverty/4.png" alt="Ration Distribution" loading="lazy" />
            </div>
          </div>

          {/* Education for All */}
          <div className="gallery-category">
            <h2>EDUCATION FOR ALL</h2>
            <div className="gallery-grid-3">
              <img src="/static/images/events/education/16.jpg" alt="Education" loading="lazy" />
              <img src="/static/images/events/education/18.png" alt="Education" loading="lazy" />
              <img src="/static/images/events/education/20.png" alt="Education" loading="lazy" />
              <img src="/static/images/events/education/21.png" alt="Education" loading="lazy" />
              <img src="/static/images/events/education/23.png" alt="Education" loading="lazy" />
              <img src="/static/images/events/education/24.png" alt="Education" loading="lazy" />

            </div>
          </div>

          {/* Environment Protection */}
          <div className="gallery-category">
            <h2>ENVIRONMENT PROTECTION</h2>
            <div className="gallery-grid-3">
              <img src="/static/images/events/environments/2.png" alt="Environment" loading="lazy" />
              <img src="/static/images/events/environments/7.png" alt="Environment" loading="lazy" />
              <img src="/static/images/events/environments/15.png" alt="Environment" loading="lazy" />
              <img src="/static/images/events/environments/14.png" alt="Environment" loading="lazy" />
              <img src="/static/images/events/environments/11.png" alt="Environment" loading="lazy" />
              <img src="/static/images/events/environments/3.png" alt="Environment" loading="lazy" />


            </div>
          </div>

          {/* Pehchan Utsav */}
          <div className="gallery-category">
            <h2>PEHCHAN UTSAV</h2>
            <div className="gallery-grid-3">
              <img src="/static/images/events/utsav/37.png" alt="Pehchan Utsav" loading="lazy" />
              <img src="/static/images/events/utsav/40.png" alt="Pehchan Utsav" loading="lazy" />
              <img src="/static/images/events/utsav/41.png" alt="Pehchan Utsav" loading="lazy" />
              <img src="/static/images/events/utsav/43.png" alt="Pehchan Utsav" loading="lazy" />
              <img src="/static/images/events/utsav/44.png" alt="Pehchan Utsav" loading="lazy" />
              <img src="/static/images/celebrate1.png" alt="Pehchan Utsav" loading="lazy" />
            </div>
          </div>

          {/* Poverty Alleviation */}
          <div className="gallery-category">
            <h2>POVERTY ALLEVIATION</h2>
            <div className="gallery-grid-3">
              <img src="/static/images/events/poverty/40.png" alt="Poverty Alleviation" loading="lazy" />
              <img src="/static/images/events/poverty/1.png" alt="Poverty Alleviation" loading="lazy" />
              <img src="/static/images/events/poverty/2.png" alt="Poverty Alleviation" loading="lazy" />

            </div>
          </div>

          {/* Your Memorable Day */}
          <div className="gallery-category">
            <h2>YOUR MEMORABLE DAY</h2>
            <div className="gallery-grid-3">
              <img src="/static/images/events/memorable/8.png" alt="Memorable Day" loading="lazy" />
              <img src="/static/images/events/memorable/30.png" alt="Memorable Day" loading="lazy" />
              <img src="/static/images/events/memorable/10.png" alt="Memorable Day" loading="lazy" />
              <img src="/static/images/events/memorable/29.png" alt="Memorable Day" loading="lazy" />
              <img src="/static/images/events/memorable/23.png" alt="Memorable Day" loading="lazy" />
              <img src="/static/images/events/memorable/33.png" alt="Memorable Day" loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-col">
              <img src="/static/images/logos/location_logo.png" alt="Pehchan Location"
                style={{ height: '80px', marginBottom: '0.5rem' }} loading="lazy" />
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
