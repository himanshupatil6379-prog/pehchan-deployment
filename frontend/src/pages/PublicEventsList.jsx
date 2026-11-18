import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import PageStyle, { FONTS } from '../components/PageStyle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../hooks/useApi.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { dateFormat } from '../utils/filters.js';
import styleCss from '../styles/style.css?inline';
import pageCss from './css/public-events-list.css?inline';

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

/** React port of templates/public_events_list.html (view `public_events_list`, standalone page). */
export default function PublicEventsList() {
  const request = useApi();
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [events, setEvents] = useState(null);
  const { menuOpen, scrolled, toggleMenu, closeMenu } = useNavbarScript();

  useDocumentTitle('Upcoming Events - Pehchan');

  // value="{{ search_query }}" – reset on every page load / navigation.
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery, location.key]);

  useEffect(() => {
    let cancelled = false;
    request('/events/public/', { query: { search: searchQuery } }).then((res) => {
      if (cancelled) return;
      if (res.ok) setEvents(res.data.events || []);
    });
    return () => {
      cancelled = true;
    };
  }, [request, searchQuery, location.key]);

  // <form action="{% url 'public_events' %}" method="get">
  const onSubmit = (e) => {
    e.preventDefault();
    setSearchParams({ search: searchInput });
  };

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

      {/* Page Title */}
      <section className="page-title">
        <h1>UPCOMING EVENTS</h1>
      </section>

      <div className="container">
        {/* Search */}
        <div className="search-container">
          <form action="/events/" method="get" className="search-form" onSubmit={onSubmit}>
            <input
              type="text"
              name="search"
              placeholder="Search events by name, location..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="search-btn">SEARCH</button>
          </form>
        </div>

        {events !== null &&
          (events.length > 0 ? (
            <div className="events-grid">
              {events.map((event) => (
                <div className="event-card" key={event.id}>
                  {event.image ? (
                    <img src={event.image} alt={event.name} className="event-image" loading="lazy" />
                  ) : (
                    <img src="/static/images/background.png" alt={event.name} className="event-image" loading="lazy" />
                  )}
                  <div className="event-info">
                    <span className={`event-status status-${event.status}`}>{event.status_display}</span>
                    <h3>{event.name}</h3>
                    <div className="event-meta">
                      <div>📅 {dateFormat(event.event_date)}</div>
                      <div>📍 {event.location}</div>
                    </div>
                    <p className="event-description">{event.description}</p>
                    <Link to={`/events/${event.id}/`} className="view-details-btn">VIEW DETAILS</Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-events">
              <h2>No upcoming events found.</h2>
              <p>
                Check back later or explore our{' '}
                <Link to="/gallery/" style={{ color: '#0A1A4A', fontWeight: 600 }}>Gallery</Link> to see our past activities.
              </p>
              {searchQuery && (
                <Link to="/events/" className="pill-button" style={{ marginTop: '1rem' }}>View All Events</Link>
              )}
            </div>
          ))}
      </div>

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
