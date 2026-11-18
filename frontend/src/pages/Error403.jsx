import { Link } from 'react-router-dom';
import PageStyle, { FONTS } from '../components/PageStyle.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import styleCss from '../styles/style.css?inline';
import pageCss from './css/error-403.css?inline';

/** React port of templates/403.html (standalone document). Must not depend on route params. */
export default function Error403() {
  useDocumentTitle('Access Forbidden (403) - Pehchan');

  return (
    <>
      {/* <head>: style.css, Poppins, inline <style> – in this order */}
      <PageStyle css={styleCss} />
      <PageStyle links={[FONTS.poppins800]} css={pageCss} />

      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-container">
          <ul className="nav-links">
            <li><Link to="/">HOME</Link></li>
            <li><Link to="/gallery/">GALLERY</Link></li>
            <li><Link to="/events/">EVENTS</Link></li>
            <li><Link to="/volunteer-info/">VOLUNTEER</Link></li>
            <li><Link to="/about/">ABOUT US</Link></li>
            <li><Link to="/verify-certificate/">VERIFY CERTIFICATE</Link></li>
          </ul>
          <Link to="/donate-info/" className="donate-btn">Donate Now</Link>
        </div>
      </nav>

      {/* Error Body */}
      <main className="error-page-container">
        <div className="error-card">
          <div className="error-code">403</div>
          <h1 className="error-title">Access Forbidden</h1>
          <p className="error-desc">
            You do not have the required permissions or authentication level to view this page or resource.
          </p>
          <div className="error-actions">
            <Link to="/" className="btn-action-primary">Return to Home</Link>
            <Link to="/login/" className="btn-action-secondary">Log In</Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-col">
              <img
                src="/static/images/logos/location_logo.png"
                alt="Pehchan Location"
                style={{ height: '80px', marginBottom: '0.5rem' }}
                loading="lazy"
              />
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
