import { Link } from 'react-router-dom';
import PageStyle, { FONTS } from '../components/PageStyle.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import styleCss from '../styles/style.css?inline';
import pageCss from './css/error-400.css?inline';

/** React port of templates/400.html (standalone document). */
export default function Error400() {
  useDocumentTitle('Bad Request (400) - Pehchan');

  return (
    <>
      {/* <head>: style.css, Poppins, inline <style> – in this order */}
      <PageStyle css={styleCss} />
      <PageStyle links={[FONTS.poppins800]} css={pageCss} />

      <header className="header">
        <nav className="navbar">
          <div className="nav-container">
            <Link to="/" className="nav-logo">
              <img src="/static/images/logo.png" alt="Pehchan Logo" loading="lazy" />
            </Link>
          </div>
        </nav>
      </header>

      <main className="error-page-container">
        <div className="error-card">
          <div className="error-code">400</div>
          <h1 className="error-title">Bad Request</h1>
          <p className="error-desc">
            The server could not understand the request or the domain/host is not recognized. If you believe this is an error, please reach out to our team.
          </p>
          <div className="error-actions">
            <Link to="/" className="btn-action-primary">Return to Homepage</Link>
            <Link to="/about/" className="btn-action-secondary">About Us</Link>
          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="footer-container">
          <div className="footer-content">
            <div className="footer-section">
              <h3>Contact Us</h3>
              <p>madad@pehchanyui.in</p>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2026 Pehchan - The Street School. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
