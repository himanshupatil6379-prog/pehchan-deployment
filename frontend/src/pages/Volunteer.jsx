import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageStyle, { FONTS } from '../components/PageStyle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import styleCss from '../styles/style.css?inline';
import volunteerCss from './css/volunteer.css?inline';

/** The <style> block that sits inside .volunteer-hero-text in the template. */
const joinUsCss = `
                        @keyframes pulse {

                            0%,
                            100% {
                                transform: scale(1);
                            }

                            50% {
                                transform: scale(1.2);
                            }
                        }

                        .join-us-btn::before {
                            content: '';
                            position: absolute;
                            top: 50%;
                            left: 50%;
                            width: 0;
                            height: 0;
                            border-radius: 50%;
                            background: rgba(255, 255, 255, 0.3);
                            transform: translate(-50%, -50%);
                            transition: width 0.6s, height 0.6s;
                        }

                        .join-us-btn:hover::before {
                            width: 300px;
                            height: 300px;
                        }
                    `;

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

const joinUsBtnStyle = {
  display: 'inline-block',
  marginTop: '30px',
  padding: '20px 50px',
  fontSize: '24px',
  fontWeight: '700',
  textDecoration: 'none',
  borderRadius: '50px',
  background: 'linear-gradient(135deg, #F9A826 0%, #FF6B4A 100%)',
  color: 'white',
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  boxShadow: '0 10px 30px rgba(249, 168, 38, 0.4)',
  textTransform: 'uppercase',
  letterSpacing: '2px',
  fontFamily: "'Poppins', sans-serif",
  position: 'relative',
  overflow: 'hidden',
};

// onmouseover / onmouseout handlers of the JOIN US button
function joinUsOver(e) {
  e.currentTarget.style.transform = 'translateY(-8px) scale(1.05)';
  e.currentTarget.style.boxShadow = '0 20px 50px rgba(249, 168, 38, 0.6)';
  e.currentTarget.style.background = 'linear-gradient(135deg, #FF6B4A 0%, #F9A826 100%)';
}
function joinUsOut(e) {
  e.currentTarget.style.transform = 'translateY(0) scale(1)';
  e.currentTarget.style.boxShadow = '0 10px 30px rgba(249, 168, 38, 0.4)';
  e.currentTarget.style.background = 'linear-gradient(135deg, #F9A826 0%, #FF6B4A 100%)';
}

const infoCardStyle = { background: 'white', padding: '30px', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', textAlign: 'center' };
const listItemStyle = { fontSize: '18px', margin: '12px 0' };

/** templates/volunteer.html (view `public_volunteer`). */
export default function Volunteer() {
  const { user } = useAuth();
  const { menuOpen, scrolled, toggleMenu, closeMenu } = useSiteScript();
  useDocumentTitle('Volunteer - Pehchan');

  return (
    <>
      <PageStyle links={[FONTS.materialIcons, FONTS.poppins]} css={[styleCss, volunteerCss]} />

      {/* Navbar */}
      <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
        <div className="nav-container">

          <ul className={`nav-links${menuOpen ? ' active' : ''}`}>
            <li><Link to="/" onClick={closeMenu}>HOME</Link></li>
            <li><Link to="/gallery/" onClick={closeMenu}>GALLERY</Link></li>
            <li><Link to="/events/" onClick={closeMenu}>EVENTS</Link></li>
            <li><Link to="/volunteer-info/" className="active" onClick={closeMenu}>VOLUNTEER</Link></li>
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

      {/* Hero Section */}
      <section className="volunteer-hero"
        style={{ background: 'var(--primary-800)', color: 'var(--text-on-primary)', padding: '40px 0' }}>
        <div className="container">
          <div className="volunteer-hero-content">
            <div className="volunteer-hero-text">
              <h1>Become a Volunteer</h1>
              <p>Join your team and change lives</p>
              <Link to="/login/" className="join-us-btn" style={joinUsBtnStyle} onMouseOver={joinUsOver} onMouseOut={joinUsOut}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '28px', animation: 'pulse 2s infinite' }}>🚀</span>
                  JOIN US
                </span>
              </Link>
              <PageStyle css={joinUsCss} />
            </div>
            <div className="volunteer-hero-info">
              <h3>Why Volunteer with us?</h3>
              <ul>
                <li>Make a real impact in your community</li>
                <li>Gain valuable experience</li>
                <li>Meet like-minded people</li>
                <li>Develop new skills</li>
                <li>Be part of social change</li>
                <li>Personal growth opportunities</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="volunteer-benefits">
        <div className="container">
          <div className="benefits-grid">
            <div className="benefit-item">
              <div className="benefit-icon">🎯</div>
              <h4>Make an Impact</h4>
              <p>Create positive change</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon">👥</div>
              <h4>Meet People</h4>
              <p>Connect with community</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon">📚</div>
              <h4>Learn Skills</h4>
              <p>Develop new abilities</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon">⭐</div>
              <h4>Personal Growth</h4>
              <p>Grow as a person</p>
            </div>
          </div>
        </div>
      </section>

      {/* Volunteer Login Message Section */}
      <section className="volunteer-form-section">
        <div className="container">
          <div
            style={{ background: '#E1F5FE', color: '#0A1A4A', padding: '60px 40px', borderRadius: '15px', textAlign: 'center', boxShadow: '0 10px 30px rgba(10, 26, 74, 0.1)' }}>
            <i className="material-icons"
              style={{ fontSize: '80px', marginBottom: '20px', animation: 'bounce 2s infinite' }}>volunteer_activism</i>
            <h2 style={{ fontSize: '36px', margin: '20px 0', fontWeight: 'bold' }}>Join Our Volunteer Community!</h2>
            <p style={{ fontSize: '20px', margin: '25px auto', maxWidth: '800px', lineHeight: '1.6' }}>Want to make a
              difference in your community? Login to your account to join as a volunteer and be part of our
              mission to empower communities and change lives.</p>

            <div
              style={{ background: 'rgba(255,255,255,0.6)', padding: '25px', borderRadius: '10px', margin: '30px auto', maxWidth: '700px', boxShadow: '0 4px 15px rgba(10, 26, 74, 0.05)' }}>
              <h3 style={{ fontSize: '24px', marginBottom: '15px' }}>As a Volunteer, You Can:</h3>
              <ul style={{ listStyle: 'none', padding: '0', margin: '0' }}>
                <li style={listItemStyle}>✓ Join upcoming events and activities</li>
                <li style={listItemStyle}>✓ Become a lifetime volunteer</li>
                <li style={listItemStyle}>✓ Earn certificates for your contributions</li>
                <li style={listItemStyle}>✓ Track your volunteer history</li>
                <li style={listItemStyle}>✓ Make a real impact in the community</li>
              </ul>
            </div>

            <div style={{ marginTop: '40px' }}>
              <Link to="/login/"
                style={{ background: 'var(--primary-500)', color: 'var(--text-on-primary)', padding: '15px 40px', borderRadius: '30px', textDecoration: 'none', fontWeight: 'bold', fontSize: '18px', margin: '0 15px', display: 'inline-block', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', transition: 'all 0.3s' }}>Login
                to Join</Link>
              <Link to="/signup/"
                style={{ background: 'transparent', color: 'var(--primary-500)', padding: '15px 40px', borderRadius: '30px', textDecoration: 'none', fontWeight: 'bold', fontSize: '18px', border: '3px solid var(--primary-500)', margin: '0 15px', display: 'inline-block', transition: 'all 0.3s' }}>Sign
                Up Now</Link>
            </div>

            <p style={{ marginTop: '30px', fontSize: '16px', opacity: '0.9' }}>Don't have an account? Sign up to get
              started!</p>
          </div>

          {/* Additional Info Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '25px', marginTop: '40px' }}>
            <div
              style={infoCardStyle}>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>🎯</div>
              <h4 style={{ color: '#333', marginBottom: '10px' }}>Event Volunteering</h4>
              <p style={{ color: '#666' }}>Participate in specific events and activities that match your interests and
                schedule.</p>
            </div>
            <div
              style={infoCardStyle}>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>⭐</div>
              <h4 style={{ color: '#333', marginBottom: '10px' }}>Lifetime Volunteer</h4>
              <p style={{ color: '#666' }}>Commit to our cause long-term and become a core member of the Pehchan
                family.</p>
            </div>
            <div
              style={infoCardStyle}>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>🏆</div>
              <h4 style={{ color: '#333', marginBottom: '10px' }}>Earn Certificates</h4>
              <p style={{ color: '#666' }}>Receive official certificates for your volunteer work that you can download
                and verify.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Volunteer Illustration */}
      <section className="volunteer-illustration">
        <div className="container">
          <img src="/static/images/volunteer.png" alt="Volunteers" className="volunteer-img" loading="lazy" />
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
