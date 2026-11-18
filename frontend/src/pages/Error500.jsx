import { Link } from 'react-router-dom';
import PageStyle, { FONTS } from '../components/PageStyle.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import styleCss from '../styles/style.css?inline';
import pageCss from './css/error-500.css?inline';

/** React port of templates/500.html (standalone document). Must not depend on route params. */
export default function Error500() {
  useDocumentTitle('Server Error (500) - Pehchan');

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
          <div className="error-code">500</div>
          <h1 className="error-title">Unexpected Server Error</h1>
          <p className="error-desc">
            We are experiencing an internal issue and our technical team has been notified. Please try again shortly or return to our homepage.
          </p>
          <div className="error-actions">
            <Link to="/" className="btn-action-primary">Return to Home</Link>
            <Link to="/volunteer-info/" className="btn-action-secondary">Contact Support</Link>
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
