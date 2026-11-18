import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import PageStyle, { FONTS } from '../components/PageStyle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../hooks/useApi.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { dateFormat } from '../utils/filters.js';
import styleCss from '../styles/style.css?inline';
import pageCss from './css/public-event-detail.css?inline';
import Error404 from './Error404.jsx';

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

/** Python truthiness of a DecimalField value ("0.00" and null are falsy). */
const decimalTruthy = (v) => v !== null && v !== undefined && v !== '' && Number(v) !== 0;

/**
 * React port of templates/public_event_detail.html (view `public_event_detail`, standalone page).
 * The template has no volunteer form: logged-in users get a link to the dashboard event page
 * (`event_detail`), anonymous users get LOGIN / SIGN UP links.
 */
export default function PublicEventDetail() {
  const { pk } = useParams();
  const request = useApi();
  const { user } = useAuth();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [barWidth, setBarWidth] = useState(null);
  const { menuOpen, scrolled, toggleMenu, closeMenu } = useNavbarScript();

  const event = data?.event;
  useDocumentTitle(event ? `${event.name} - Pehchan` : null);

  // A different event is a different page: start from scratch.
  useEffect(() => {
    setData(null);
    setNotFound(false);
    setBarWidth(null);
  }, [pk]);

  useEffect(() => {
    let cancelled = false;
    request(`/events/public/${pk}/`).then((res) => {
      if (cancelled) return;
      if (res.status === 404) setNotFound(true);
      else if (res.ok) setData(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [request, pk, location.key, user?.id]);

  // Progress bar: apply the width after a tiny delay to trigger the CSS transition.
  const hasGoal = !!event && decimalTruthy(event.fundraising_goal);
  const progress = data?.progress_percentage;
  useEffect(() => {
    if (!hasGoal) return undefined;
    const timer = setTimeout(() => setBarWidth(`${progress}%`), 100);
    return () => clearTimeout(timer);
  }, [hasGoal, progress, event?.id]);

  if (notFound) return <Error404 />;

  return (
    <>
      <PageStyle links={[FONTS.poppins]} css={[styleCss, pageCss]} />

      {/* Navbar */}
      <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
        <div className="nav-container">
          <ul className={`nav-links${menuOpen ? ' active' : ''}`}>
            <li><Link to="/" onClick={closeMenu}>HOME</Link></li>
            <li><Link to="/gallery/" onClick={closeMenu}>GALLERY</Link></li>
            <li><Link to="/events/" className="active" onClick={closeMenu}>EVENTS</Link></li>
            <li><Link to="/volunteer-info/" onClick={closeMenu}>VOLUNTEER</Link></li>
            <li><Link to="/about/" onClick={closeMenu}>ABOUT US</Link></li>
            <li><Link to="/verify-certificate/" onClick={closeMenu}>VERIFY CERTIFICATE</Link></li>
            {user ? (
              <li><Link to="/dashboard/" onClick={closeMenu}>DASHBOARD</Link></li>
            ) : (
              <>
                <li><Link to="/login/" onClick={closeMenu}>Login</Link></li>
                <li><Link to="/signup/" onClick={closeMenu}>Sign Up</Link></li>
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

      {event && (
        <div className="container event-detail-container">
          <div className="event-header">
            <span className={`event-status status-${event.status}`}>{event.status_display}</span>
            <h1>{event.name}</h1>
          </div>

          <div className="event-main-content">
            <div className="event-visual-section">
              <div className="image-container">
                {event.image ? (
                  <img src={event.image} alt={event.name} className="event-banner" />
                ) : (
                  <img src="/static/images/background.png" alt={event.name} className="event-banner" />
                )}
                <div className="image-overlay-decoration"></div>
              </div>
            </div>

            <div className="event-body">
              <div className="event-info-strip">
                <div className="info-item">
                  <div className="info-icon">📅</div>
                  <div className="info-text">
                    <strong>Date</strong>
                    <span>{dateFormat(event.event_date, 'F d, Y')}</span>
                  </div>
                </div>
                <div className="info-item">
                  <div className="info-icon">📍</div>
                  <div className="info-text">
                    <strong>Location</strong>
                    <span>{event.location}</span>
                  </div>
                </div>
              </div>

              {hasGoal && (
                <div className="progress-section">
                  <div className="progress-header">
                    <span>Fundraising Progress</span>
                    <span>{data.progress_percentage}%</span>
                  </div>
                  <div className="progress-bar-container">
                    <div
                      className="progress-bar-fill"
                      id="eventProgressBar"
                      data-progress={data.progress_percentage}
                      style={barWidth !== null ? { width: barWidth } : undefined}
                    ></div>
                  </div>
                  <div className="progress-target">
                    Raised <strong>₹{data.total_raised}</strong> of ₹{event.fundraising_goal} goal
                  </div>
                </div>
              )}

              <div className="event-description-section">
                <h2>Event Description</h2>
                <p>{event.description}</p>
              </div>

              <div className="action-section">
                {data.already_joined ? (
                  <div className="joined-badge">
                    <span style={{ fontSize: '1.5rem' }}>✨</span>
                    You have already joined this event
                  </div>
                ) : user ? (
                  <div className="action-box">
                    <h3>Be the change.</h3>
                    <p>
                      Your participation can transform lives. Join our team for this event and create a lasting impact today.
                    </p>
                    <Link to={`/dashboard/events/${event.id}/`} className="btn-large btn-primary">
                      🚀 JOIN AS VOLUNTEER
                    </Link>
                  </div>
                ) : (
                  <div className="action-box">
                    <h3>Ready to make an impact?</h3>
                    <p>
                      Login to your account to register for this event. Not a member yet? Join the Pehchan family today!
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <Link to="/login/" className="btn-large btn-primary">
                        🔑 LOGIN TO JOIN
                      </Link>
                      <Link
                        to="/signup/"
                        className="btn-large"
                        style={{ border: '2px solid var(--pehchan-orange)', color: 'var(--pehchan-blue)', background: '#fff' }}
                      >
                        ✨ SIGN UP
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <Link
              to="/events/"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: '#666', fontWeight: 600 }}
            >
              ← BACK TO ALL EVENTS
            </Link>
          </div>
        </div>
      )}

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
