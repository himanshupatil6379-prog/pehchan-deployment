import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageStyle, { FONTS } from '../components/PageStyle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import styleCss from '../styles/style.css?inline';
import aboutCss from './css/about.css?inline';

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

/** templates/about.html (view `about`). */
export default function About() {
  const { user } = useAuth();
  const { menuOpen, scrolled, toggleMenu, closeMenu } = useSiteScript();
  useDocumentTitle('About Us - Pehchan');

  return (
    <>
      <PageStyle links={[FONTS.poppins]} css={[styleCss, aboutCss]} />

      {/* Navbar */}
      <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
        <div className="nav-container">

          <ul className={`nav-links${menuOpen ? ' active' : ''}`}>
            <li><Link to="/" onClick={closeMenu}>HOME</Link></li>
            <li><Link to="/gallery/" onClick={closeMenu}>GALLERY</Link></li>
            <li><Link to="/events/" onClick={closeMenu}>EVENTS</Link></li>
            <li><Link to="/volunteer-info/" onClick={closeMenu}>VOLUNTEER</Link></li>
            <li><Link to="/about/" className="active" onClick={closeMenu}>ABOUT US</Link></li>
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
      <section className="about-hero-new">
        <div className="container">

          <h1 className="section-title-dark georgia-brand">Pehchan</h1>
          <h2 className="section-subtitle-dark georgia-brand">YUI Foundation</h2>

          {/* Official Trust Registration Details */}
          <div
            style={{ background: '#ffffff', borderRadius: '16px', border: '1.5px solid #e2e8f0', boxShadow: '0 8px 25px rgba(10, 26, 74, 0.08)', maxWidth: '620px', margin: '25px auto', overflow: 'hidden', textAlign: 'center' }}>
            <div
              style={{ background: 'linear-gradient(135deg, #0A1A4A 0%, #1e3a8a 100%)', padding: '16px 20px', color: 'white' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '0.5px' }}>
                Pehchan YUI Foundation
              </div>
            </div>

            <div
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', padding: '22px 24px', background: '#f8fafc' }}>
              <div
                style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px' }}>
                <div
                  style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#64748b', fontWeight: '600', letterSpacing: '0.5px' }}>
                  Registration / Certificate No.
                </div>
                <div
                  style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ea580c', fontFamily: 'monospace', marginTop: '4px' }}>
                  E-0015289 (THN)
                </div>
              </div>
              <div
                style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px' }}>
                <div
                  style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#64748b', fontWeight: '600', letterSpacing: '0.5px' }}>
                  Date of Registration / Issue
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: '700', color: '#16a34a', marginTop: '4px' }}>
                  7 September 2026
                </div>
              </div>
            </div>
          </div>

          <img src="/static/images/logos/roundlogo.png" alt="Pehchan Logo" className="about-hero-logo-new"
            style={{ display: 'block', margin: '20px auto', maxWidth: '300px', height: 'auto', borderRadius: '50%' }} />
          <p className="about-hero-text">We are a purpose-driven NGO committed to creating meaningful change at the
            grassroots level. Our mission is to uplift underprivileged communities through access to education,
            empower women to lead independent and dignified lives, and provide essential relief to those in need. At
            the heart of our work lies a deep respect for nature — we actively engage in environmental preservation
            to ensure a sustainable future for generations to come. Through compassion, collaboration, and tireless
            dedication, we strive to build a world where equality, opportunity, and harmony with the Earth are not
            just ideals, but realities for all.</p>
        </div>
      </section>

      {/* Gallery Banner */}
      <section className="about-gallery-new">
        <img src="/static/images/aboutus/39.png" alt="Pehchan Team" className="gallery-bg" loading="lazy" />
      </section>

      {/* Who We Are */}
      <section className="who-we-are-new">
        <div className="container">
          <h2>Who We Are</h2>
          <h3>Our Vision</h3>
          <p>Here at <strong>Pehchan YUI Foundation</strong>, we know that sometimes all it takes to change the
            world is a little support. Since our start in 2020, we have been determined to make an impact. The core
            of our efforts is to bring our team's fresh ideas and passion to the range of activities we're involved
            in. <strong>Pehchan YUI Foundation</strong> is a registered public trust working for social welfare,
            formed by <strong>Aniksha Upadhyay</strong> and team in April 2020. Registered under the Public Trusts
            Registration Act with Certificate Registration No. <strong>E-0015289 (THN)</strong> and Date of
            Registration / Issue: <strong>7 September 2026</strong>. It works on several causes including Awareness,
            Children Education, Environment, Animals, helpless people, and Community Welfare.</p>
          <p>Our team is dedicated to service for poor public welfare and animal welfare.</p>
          <p className="jai-hind">जय हिन्द..🇮🇳</p>
        </div>
      </section>


      {/* Founder Section */}
      <section className="founder-section-new">
        <div className="container">
          <h2>Our Founder</h2>
          <div className="founder-content-new">
            <img src="/static/images/Members/Aniksha__1_-removebg-preview.png" alt="Founder"
              className="founder-img-new" loading="lazy" />
            <h3 className="founder-name">ANIKSHA UPADHYAY</h3>
            <p className="founder-title-new">Founder</p>
          </div>
        </div>
      </section>


      {/* Team Section */}
      <section className="team-section-new">
        <div className="container">
          <h2>OUR TEAM</h2>
          <div className="team-grid-new">
            <div className="team-card-new">
              <img src="/static/images/Members/aj1.png" alt="Team Member" className="team-img-new" loading="lazy" />
              <h3>ADITYA JHA</h3>
              <p className="team-role-new">PROGRAMME<br />MANAGEMENT</p>
            </div>
            <div className="team-card-new">
              <img src="/static/images/Members/Pallavi.jpg" alt="PALLAVI THAKUR" className="team-img-new" loading="lazy" />
              <h3>PALLAVI THAKUR</h3>
              <p className="team-role-new">ADMINISTRATIVE<br />MANAGER</p>
            </div>
            <div className="team-card-new">
              <img src="/static/images/Members/shilpapg-removebg-preview.png" alt="Team Member"
                className="team-img-new" loading="lazy" />
              <h3>SHILPA DUBEY</h3>
              <p className="team-role-new">TREASURER</p>
            </div>
          </div>
        </div>
      </section>


      {/* Ex-Member Section (commented out in the original template) */}


      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-col">
              <img src="/static/images/logos/location_logo.png" alt="Pehchan Location"
                style={{ height: '80px', marginBottom: '0.8rem' }} loading="lazy" />
              <p style={{ fontWeight: '700', color: '#F9A826', marginBottom: '4px' }}>Pehchan YUI Foundation</p>
              <p style={{ fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '2px' }}><strong>Reg. No:</strong> E-0015289 (THN)</p>
              <p style={{ fontSize: '0.9rem', lineHeight: '1.5' }}><strong>Date of Registration / Issue:</strong> 7 September 2026</p>
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
        <div style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '6px', letterSpacing: '0.3px' }}>
          <span>Registration No: <strong>E-0015289 (THN)</strong></span> &nbsp;•&nbsp;{' '}
          <span>Date of Registration / Issue: <strong>7 September 2026</strong></span>
        </div>
        <p style={{ margin: '0' }}>Copyright © Pehchan YUI Foundation. All rights reserved.</p>
      </div>
    </>
  );
}
