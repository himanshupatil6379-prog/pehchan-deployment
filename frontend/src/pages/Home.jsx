import { useEffect, useLayoutEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import PageStyle, { FONTS } from '../components/PageStyle.jsx';
import ContactForm from '../components/ContactForm.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import styleCss from '../styles/style.css?inline';
import homeCss from './css/home.css?inline';

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

/** templates/home.html (view `home`): authenticated users are sent to the dashboard. */
export default function Home() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard/" replace />;
  return <HomePage />;
}

function HomePage() {
  const { user } = useAuth();
  const { menuOpen, scrolled, toggleMenu, closeMenu } = useSiteScript();
  useDocumentTitle('Pehchan YUI Foundation');

  // <body class="home">
  useLayoutEffect(() => {
    document.body.classList.add('home');
    return () => document.body.classList.remove('home');
  }, []);

  const donateHref = user ? '/donate/money/' : '/donate-info/#support';

  return (
    <>
      <PageStyle links={[FONTS.poppins]} css={[styleCss, homeCss]} />

      {/* Navbar */}
      <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
        <div className="nav-container">

          <ul className={`nav-links${menuOpen ? ' active' : ''}`}>
            <li><Link to="/" className="active" onClick={closeMenu}>HOME</Link></li>
            <li><Link to="/gallery/" onClick={closeMenu}>GALLERY</Link></li>
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

      {/* About Section */}
      <section className="about-home">
        <img src="/static/images/pink_leaf.png" className="leaf-decor leaf-top-left" alt="" loading="lazy" />
        <img src="/static/images/blue_leaf.png" className="leaf-decor leaf-top-right" alt="" loading="lazy" />
        <img src="/static/images/pink_leaf.png" className="leaf-decor leaf-bottom-left" alt="" loading="lazy" />
        <img src="/static/images/blue_leaf.png" className="leaf-decor leaf-bottom-right" alt="" loading="lazy" />
        <div className="container">
          <p className="about-intro">Established in 2020, Pehchan YUI Foundation is a non-profit organisation
            focused on the education of underprivileged children and helping the homeless.</p>
        </div>
      </section>

      {/* Our Cause */}
      <section className="our-cause">
        <img src="/static/images/blue_leaf.png" className="leaf-decor leaf-cause-left" alt="" loading="lazy" />
        <img src="/static/images/pink_leaf.png" className="leaf-decor leaf-cause-right" alt="" loading="lazy" />
        <div className="container">
          <h2 className="section-title-orange">OUR CAUSE</h2>
          <div className="cause-grid">
            <div className="cause-card">
              <img src="/static/images/home/education/screenshot_education_1.png" alt="Education" loading="lazy" />
            </div>
            <div className="cause-card">
              <img src="/static/images/home/education/screenshot_education_2.png" alt="Education" loading="lazy" />
            </div>
            <div className="cause-card">
              <img src="/static/images/home/education/17.png" alt="Community" loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      {/* Pehchan Utsav */}
      <section className="activity-section">
        <div className="container">
          <div className="activity-content">
            <div className="activity-text">
              <h2 className="section-title-orange">Celebrations</h2>
              <p>Throughout the year, we celebrate national and cultural festivals with underprivileged children
                and communities, spreading smiles and fostering togetherness.</p>
            </div>
            <div className="activity-images">
              <div className="activity-images-row">
                <img src="/static/images/events/utsav/36.png" alt="Ration Distribution" loading="lazy" />
                <img src="/static/images/events/utsav/38.png" alt="Ration Distribution" loading="lazy" />
              </div>
              <div className="activity-images-row">
                <img src="/static/images/events/utsav/39.png" alt="Ration Distribution" loading="lazy" />
                <img src="/static/images/events/utsav/42.png" alt="Ration Distribution" loading="lazy" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Best Out of Waste */}
      <section className="activity-section">
        <div className="container">
          <div className="activity-content">
            <div className="activity-text">
              <h2>Environment Protection</h2>
              <p>At Pehchan, we believe that taking care of the environment is essential to our mission of helping
                the underprivileged. We organize this by planting trees and cleaning up beaches, and by
                promoting environmentally friendly practices in our community.</p>
            </div>
            <div className="activity-images">

              <div className="activity-images-row">
                <img src="/static/images/events/environments/11.png" alt="Environment Protection" loading="lazy" />
                <img src="/static/images/events/environments/2.png" alt="Environment Protection" loading="lazy" />
              </div>
              <div className="activity-images-row">
                <img src="/static/images/events/environments/15.png" alt="Environment Protection" loading="lazy" />
                <img src="/static/images/events/environments/14.png" alt="Environment Protection" loading="lazy" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ration Distribution Drive */}
      <section className="activity-section">
        <div className="container">
          <div className="activity-content reverse">
            <div className="activity-text">
              <h2>Ration Distribution Drive</h2>
              <p>We distributed dry ration kits among the needy and destitute people in Mumbai and Navi Mumbai.
                This drive aimed to provide essential food items to those who require them the most.</p>
            </div>
            <div className="activity-images">
              <div className="activity-images-row">
                <img src="/static/images/events/poverty/4.png" alt="Ration Distribution" loading="lazy" />
                <img src="/static/images/events/poverty/50.png" alt="Ration Distribution" loading="lazy" />
              </div>
              <div className="activity-images-row">
                <img src="/static/images/events/poverty/51.png" alt="Ration Distribution" loading="lazy" />
                <img src="/static/images/events/poverty/53.png" alt="Ration Distribution" loading="lazy" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Education for All */}
      <section className="activity-section bg-light-blue">
        <div className="container">
          <div className="activity-content">
            <div className="activity-text">
              <h2>Education for All</h2>
              <h3>Spreading Awareness on Importance of Education</h3>
              <p>We believe that education is the key to unlocking a better future for the underprivileged. We
                conducted a campaign to spread awareness about the importance of education and motivated parents
                to send their children to school. We also spent quality time with the children, teaching them
                the basics and providing them with educational materials as per donations received. Our aim is
                to distribute basic educational items such as books, stationery, and uniforms to support the
                education of underprivileged children.</p>
            </div>
            <div className="activity-images">
              <div className="activity-images-row">
                <img src="/static/images/events/education/17.png" alt="Walk for Homeless" loading="lazy" />
                <img src="/static/images/events/education/19.png" alt="Walk for Homeless" loading="lazy" />
              </div>
              <div className="activity-images-row">
                <img src="/static/images/events/education/22.png" alt="Walk for Homeless" loading="lazy" />
                <img src="/static/images/events/education/25.jpg" alt="Walk for Homeless" loading="lazy" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Your Memorable Day */}
      <section className="activity-section">
        <div className="container">
          <div className="activity-content reverse">
            <div className="activity-text">
              <h2>Your Memorable Day</h2>
              <p>Make your special occasions more meaningful by celebrating with those in need. Whether it's a
                birthday, anniversary, or any memorable event, you can make a difference!</p>

              <div
                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '25px', borderRadius: '12px', marginTop: '25px' }}>
                <h3 style={{ color: 'white', marginBottom: '15px', fontSize: '20px' }}>🎉 Celebrate With Us!</h3>
                <p style={{ marginBottom: '20px', fontSize: '15px', lineHeight: '1.6' }}>For your memorable day
                  events, you can contact us through:</p>

                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>📞</span>
                    <span><strong>Phone:</strong> +91 98928 87992</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>✉️</span>
                    <span><strong>Email:</strong> madad@pehchanyui.in</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>📱</span>
                    <span><strong>Instagram:</strong> @PEHCHAN_YUI</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>💬</span>
                    <span><strong>Message Box:</strong> Use the contact form below</span>
                  </div>
                </div>

                <a href="#contact"
                  style={{ display: 'inline-block', marginTop: '20px', padding: '12px 30px', background: 'white', color: '#667eea', textDecoration: 'none', borderRadius: '8px', fontWeight: '600', transition: 'transform 0.3s' }}
                  onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}>
                  Contact Us Now →
                </a>
              </div>
            </div>
            <div className="activity-images">
              <div className="activity-images-row">
                <img src="/static/images/events/memorable/30.png" alt="Memorable Day" loading="lazy" />
                <img src="/static/images/events/memorable/10.png" alt="Memorable Day" loading="lazy" />
              </div>
              <div className="activity-images-row">
                <img src="/static/images/events/memorable/34.png" alt="Memorable Day" loading="lazy" />
                <img src="/static/images/events/memorable/35.png" alt="Memorable Day" loading="lazy" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="contact-section" id="contact">
        <div className="container">
          <div className="contact-wrapper">
            <div className="contact-map">
              <h3>Location</h3>
              <div
                style={{ background: '#f0f0f0', padding: '2rem', borderRadius: '8px', textAlign: 'center', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '1rem' }}>📍 Mumbai, Maharashtra, India
                </p>
                <p style={{ color: '#888' }}>We are located in Mumbai, working to make a difference in the community.
                </p>
              </div>
            </div>
            <div className="contact-form">
              <h3>Send us a message</h3>

              <ContactForm source="home" />
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
