import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import { Eyebrow, KpiCard, SkeletonList, StatusChip } from '../components/dashboard/ui.jsx';
import ContactForm from '../components/ContactForm.jsx';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { dateFormat } from '../utils/filters.js';
import pageCss from './css/dashboard.css?inline';

/** request.GET.get(name, '') – Django's QueryDict returns the last value of a repeated key. */
function getParam(searchParams, name) {
  const all = searchParams.getAll(name);
  return all.length ? all[all.length - 1] : '';
}

/** Calendar tile used as the leading element of event rows. */
function DateTile({ value }) {
  const day = dateFormat(value, 'd');
  if (!day) {
    return (
      <span className="md-list-item__leading dash-leading--primary" aria-hidden="true">
        <span className="md-icon">calendar_today</span>
      </span>
    );
  }
  return (
    <span className="dash-date-tile" aria-hidden="true">
      <span className="dash-date-tile__day">{day}</span>
      <span className="dash-date-tile__month">{dateFormat(value, 'M')}</span>
    </span>
  );
}

function CardHeader({ icon, tone, title, subtitle, id }) {
  return (
    <div className="md-card__header">
      <span className={`md-card__icon${tone ? ` dash-icon--${tone}` : ''}`} aria-hidden="true">
        <span className="md-icon">{icon}</span>
      </span>
      <div className="dash-card__heading">
        <h3 className="md-card__title" id={id}>
          {title}
        </h3>
        {subtitle && <p className="md-card__subtitle">{subtitle}</p>}
      </div>
    </div>
  );
}

/**
 * React port of templates/dashboard.html (view `dashboard`).
 *
 * NOTE: three variables in the original template were split over two lines, so Django printed
 * the raw tag text; here the real values are shown instead (intentional fix).
 */
export default function Dashboard() {
  const request = useApi();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [upcomingSearch, setUpcomingSearch] = useState(() => getParam(searchParams, 'upcoming_search').trim());
  const [joinedSearch, setJoinedSearch] = useState(() => getParam(searchParams, 'joined_search').trim());

  // Every navigation to this URL is a new GET of the view.
  useEffect(() => {
    let active = true;
    const upcoming = getParam(searchParams, 'upcoming_search');
    const joined = getParam(searchParams, 'joined_search');
    setUpcomingSearch(upcoming.trim());
    setJoinedSearch(joined.trim());
    request('/dashboard/', { query: { upcoming_search: upcoming, joined_search: joined } }).then((res) => {
      if (active && res.ok) setData(res.data);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // <form method="GET" action="."> – only the submitted field ends up in the query string.
  const submitSearch = (name, value) => (e) => {
    e.preventDefault();
    const search = `?${new URLSearchParams([[name, value]]).toString()}`;
    navigate(`/dashboard/${search}`, {
      replace: location.pathname === '/dashboard/' && location.search === search,
    });
  };

  const displayName = user ? user.full_name || user.username : '';

  return (
    <DashboardLayout title="Dashboard - Pehchan" heading="Dashboard" css={pageCss}>
      {/* Greeting */}
      <section className="dash-hero" aria-labelledby="dash-welcome">
        <div className="dash-hero__text">
          <Eyebrow icon="eco">Pehchan YUI Foundation</Eyebrow>
          <h1 className="dash-hero__title" id="dash-welcome">
            Welcome back, {displayName}
          </h1>
          <p className="dash-hero__lead">
            Your actions nourish communities and keep our planet thriving. Explore fresh opportunities to volunteer,
            donate, and celebrate your impact.
          </p>
        </div>
        <div className="dash-hero__art" aria-hidden="true">
          <img src="/static/images/logos/roundlogo.png" alt="" />
        </div>
      </section>

      {/* Quick Action Navigation */}
      <nav className="dash-quick" aria-label="Quick actions">
        <Link to="/dashboard/events/" className="dash-quick__item">
          <span className="dash-quick__icon" aria-hidden="true">
            <span className="md-icon">event</span>
          </span>
          <span className="dash-quick__label">Browse Events</span>
        </Link>

        <Link to="/donate/material/" className="dash-quick__item">
          <span className="dash-quick__icon" aria-hidden="true">
            <span className="md-icon">inventory_2</span>
          </span>
          <span className="dash-quick__label">Donate Materials</span>
        </Link>

        <Link to="/donate/money/" className="dash-quick__item">
          <span className="dash-quick__icon dash-quick__icon--tertiary" aria-hidden="true">
            <span className="md-icon">payments</span>
          </span>
          <span className="dash-quick__label">Donate Money</span>
        </Link>

        <Link to="/certificates/" className="dash-quick__item">
          <span className="dash-quick__icon" aria-hidden="true">
            <span className="md-icon">verified</span>
          </span>
          <span className="dash-quick__label">My Certificates</span>
        </Link>

        <Link to="/certificates/donor/" className="dash-quick__item">
          <span className="dash-quick__icon dash-quick__icon--tertiary" aria-hidden="true">
            <span className="md-icon">workspace_premium</span>
          </span>
          <span className="dash-quick__label">Donor Certificates</span>
        </Link>

        {data && !data.is_lifetime_volunteer && (
          <Link to="/volunteer/lifetime/" className="dash-quick__item">
            <span className="dash-quick__icon dash-quick__icon--success" aria-hidden="true">
              <span className="md-icon">stars</span>
            </span>
            <span className="dash-quick__label">Lifetime Volunteer</span>
          </Link>
        )}
      </nav>

      {/* Metric Strip / KPI Summary */}
      <section className="md-grid--kpi dash-kpis" aria-label="Your impact at a glance">
        <KpiCard
          icon="event"
          label="Upcoming Events"
          value={data ? data.upcoming_events.length : null}
          hint="Ready to inspire change"
        />
        <KpiCard
          icon="event_available"
          tone="success"
          label="Events Joined"
          value={data ? data.joined_events.length : null}
          hint="Keep growing greener impact"
        />
        <KpiCard
          icon="workspace_premium"
          tone="tertiary"
          label="Certificates Earned"
          value={data ? data.certificates.length + data.donor_certificates.length : null}
          hint="Celebrating your milestones"
        />
        <KpiCard
          icon="volunteer_activism"
          tone="info"
          label="Donations Made"
          value={data ? data.material_donations.length + data.money_donations.length : null}
          hint="Gratitude for your support"
        />
      </section>

      {/* Upcoming Experiences */}
      <section className="dash-section" aria-labelledby="dash-sec-upcoming">
        <div className="dash-section-head">
          <h2 className="md-section__title" id="dash-sec-upcoming">
            Upcoming Experiences
          </h2>
          <p className="dash-section-sub">Seeds of change waiting for your presence</p>
        </div>
        <div className="dash-card-grid">
          {user && user.is_staff && data && data.managed_events && data.managed_events.length > 0 && (
            <article className="md-card dash-card" aria-labelledby="dash-card-managed">
              <CardHeader icon="edit_calendar" tone="secondary" title="Events I've Added" id="dash-card-managed" />
              <div className="dash-card__body">
                <ul className="md-list dash-list">
                  {data.managed_events.map((event) => (
                    <li key={event.id}>
                      <Link to={`/dashboard/events/${event.id}/`} className="md-list-item">
                        <span className="md-list-item__leading dash-leading--secondary" aria-hidden="true">
                          <span className="md-icon">settings</span>
                        </span>
                        <span className="md-list-item__body">
                          <span className="md-list-item__headline" title={event.name}>
                            {event.name}
                          </span>
                          <span className="md-list-item__supporting">{dateFormat(event.event_date)}</span>
                        </span>
                        <span className="md-list-item__trailing">
                          <span className="md-visually-hidden">Status:</span>
                          <StatusChip status={event.status_display}>{event.status_display}</StatusChip>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="dash-card__footer">
                <Link to="/admin/pehchan/event/add/" className="md-btn md-btn--filled md-btn--sm">
                  <span className="md-icon" aria-hidden="true">
                    add
                  </span>
                  Add New Event
                </Link>
              </div>
            </article>
          )}

          <article className="md-card dash-card" aria-labelledby="dash-card-upcoming">
            <CardHeader icon="event" title="Upcoming Events" id="dash-card-upcoming" />
            <form
              method="GET"
              action="."
              role="search"
              className="dash-search"
              onSubmit={submitSearch('upcoming_search', upcomingSearch)}
            >
              <label htmlFor="dash-upcoming-search" className="md-visually-hidden">
                Search upcoming events
              </label>
              <div className="md-search">
                <span className="md-icon" aria-hidden="true">
                  search
                </span>
                <input
                  type="text"
                  name="upcoming_search"
                  id="dash-upcoming-search"
                  placeholder="Search events..."
                  value={upcomingSearch}
                  onChange={(e) => setUpcomingSearch(e.target.value)}
                  className="md-input"
                />
              </div>
              <button type="submit" className="md-icon-btn md-icon-btn--tonal" aria-label="Search upcoming events">
                <span className="md-icon" aria-hidden="true">
                  arrow_forward
                </span>
              </button>
            </form>
            <div className="dash-card__body">
              {!data ? (
                <SkeletonList label="Loading upcoming events" />
              ) : data.upcoming_events.length > 0 ? (
                <ul className="md-list dash-list">
                  {data.upcoming_events.slice(0, 3).map((event) => (
                    <li key={event.id}>
                      <Link to={`/dashboard/events/${event.id}/`} className="md-list-item">
                        <DateTile value={event.event_date} />
                        <span className="md-list-item__body">
                          <span className="md-list-item__headline" title={event.name}>
                            {event.name}
                          </span>
                          <span className="md-list-item__supporting" title={event.location}>
                            {dateFormat(event.event_date)} · {event.location}
                          </span>
                        </span>
                        <span className="md-list-item__trailing">
                          <span className="md-icon" aria-hidden="true">
                            chevron_right
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="md-empty dash-empty">
                  <span className="md-icon" aria-hidden="true">
                    event_busy
                  </span>
                  <p className="md-empty__text">No upcoming events right now. Stay tuned for fresh opportunities!</p>
                </div>
              )}
            </div>
            {data && data.upcoming_events.length > 0 && (
              <div className="dash-card__footer">
                <Link to="/dashboard/events/" className="md-btn md-btn--text">
                  View All Events
                  <span className="md-icon dash-btn-trailing-icon" aria-hidden="true">
                    arrow_forward
                  </span>
                </Link>
              </div>
            )}
          </article>

          <article className="md-card dash-card" aria-labelledby="dash-card-joined">
            <CardHeader icon="check_circle" tone="success" title="My Joined Events" id="dash-card-joined" />
            <form
              method="GET"
              action="."
              role="search"
              className="dash-search"
              onSubmit={submitSearch('joined_search', joinedSearch)}
            >
              <label htmlFor="dash-joined-search" className="md-visually-hidden">
                Search my joined events
              </label>
              <div className="md-search">
                <span className="md-icon" aria-hidden="true">
                  search
                </span>
                <input
                  type="text"
                  name="joined_search"
                  id="dash-joined-search"
                  placeholder="Search my events..."
                  value={joinedSearch}
                  onChange={(e) => setJoinedSearch(e.target.value)}
                  className="md-input"
                />
              </div>
              <button type="submit" className="md-icon-btn md-icon-btn--tonal" aria-label="Search my joined events">
                <span className="md-icon" aria-hidden="true">
                  arrow_forward
                </span>
              </button>
            </form>
            <div className="dash-card__body">
              {!data ? (
                <SkeletonList label="Loading joined events" />
              ) : data.joined_events.length > 0 ? (
                <ul className="md-list dash-list">
                  {data.joined_events.slice(0, 3).map((ev) => (
                    <li key={ev.id}>
                      <Link to={`/dashboard/events/${ev.event.id}/`} className="md-list-item">
                        <span className="md-list-item__leading dash-leading--success" aria-hidden="true">
                          <span className="md-icon">event_available</span>
                        </span>
                        <span className="md-list-item__body">
                          <span className="md-list-item__headline" title={ev.event.name}>
                            {ev.event.name}
                          </span>
                          <span className="md-list-item__supporting" title={ev.event.location}>
                            {dateFormat(ev.event.event_date)} · {ev.event.location}
                          </span>
                        </span>
                        <span className="md-list-item__trailing">
                          <span className="md-visually-hidden">Status:</span>
                          <StatusChip status={ev.status}>{ev.status_display}</StatusChip>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="md-empty dash-empty">
                  <span className="md-icon" aria-hidden="true">
                    travel_explore
                  </span>
                  <p className="md-empty__text">
                    You haven't joined any events yet. Explore new experiences to grow the green movement.
                  </p>
                  <Link to="/dashboard/events/" className="md-btn md-btn--filled">
                    Browse Events
                  </Link>
                </div>
              )}
            </div>
            {data && data.joined_events.length > 0 && (
              <div className="dash-card__footer">
                <Link to="/dashboard/events/" className="md-btn md-btn--text">
                  Browse Events
                  <span className="md-icon dash-btn-trailing-icon" aria-hidden="true">
                    arrow_forward
                  </span>
                </Link>
              </div>
            )}
          </article>
        </div>
      </section>

      {/* Celebrate Your Journey */}
      <section className="dash-section" aria-labelledby="dash-sec-journey">
        <div className="dash-section-head">
          <h2 className="md-section__title" id="dash-sec-journey">
            Celebrate Your Journey
          </h2>
          <p className="dash-section-sub">Track recognition and contributions</p>
        </div>
        <div className="dash-card-grid dash-card-grid--2">
          <article className="md-card dash-card" aria-labelledby="dash-card-certs">
            <CardHeader icon="card_membership" tone="tertiary" title="Volunteer Certificates" id="dash-card-certs" />
            <div className="dash-card__body">
              {!data ? (
                <SkeletonList label="Loading volunteer certificates" />
              ) : data.certificates.length > 0 ? (
                <ul className="md-list dash-list">
                  {data.certificates.slice(0, 3).map((cert) => (
                    <li key={cert.id}>
                      <Link to={`/certificates/${cert.id}/`} className="md-list-item">
                        <span className="md-list-item__leading dash-leading--tertiary" aria-hidden="true">
                          <span className="md-icon">verified</span>
                        </span>
                        <span className="md-list-item__body">
                          <span className="md-list-item__headline">Certificate #{cert.certificate_number || cert.id}</span>
                          <span className="md-list-item__supporting" title={cert.event.name}>
                            {cert.event.name} · Issued {dateFormat(cert.issue_date)}
                          </span>
                        </span>
                        <span className="md-list-item__trailing">
                          <span className="md-icon" aria-hidden="true">
                            chevron_right
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="md-empty dash-empty">
                  <span className="md-icon" aria-hidden="true">
                    emoji_events
                  </span>
                  <p className="md-empty__text">Complete events to unlock certificates.</p>
                </div>
              )}
            </div>
            {data && data.certificates.length > 0 && (
              <div className="dash-card__footer">
                <Link to="/certificates/" className="md-btn md-btn--text">
                  View All
                  <span className="md-icon dash-btn-trailing-icon" aria-hidden="true">
                    arrow_forward
                  </span>
                </Link>
              </div>
            )}
          </article>

          <article className="md-card dash-card" aria-labelledby="dash-card-donor-certs">
            <CardHeader icon="workspace_premium" tone="tertiary" title="Donor Certificates" id="dash-card-donor-certs" />
            <div className="dash-card__body">
              {!data ? (
                <SkeletonList label="Loading donor certificates" />
              ) : data.donor_certificates.length > 0 ? (
                <ul className="md-list dash-list">
                  {data.donor_certificates.slice(0, 3).map((cert) => (
                    <li key={cert.id}>
                      <Link to={`/certificates/donor/${cert.id}/`} className="md-list-item">
                        <span className="md-list-item__leading dash-leading--tertiary" aria-hidden="true">
                          <span className="md-icon">card_giftcard</span>
                        </span>
                        <span className="md-list-item__body">
                          <span className="md-list-item__headline" title={cert.certificate_number}>
                            {cert.certificate_number}
                          </span>
                          <span className="md-list-item__supporting">
                            {cert.donation_type_display} · {dateFormat(cert.issue_date)}
                          </span>
                        </span>
                        <span className="md-list-item__trailing">
                          <span className="md-icon" aria-hidden="true">
                            chevron_right
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="md-empty dash-empty">
                  <span className="md-icon" aria-hidden="true">
                    card_giftcard
                  </span>
                  <p className="md-empty__text">Make donations to receive appreciation certificates.</p>
                </div>
              )}
            </div>
            {data && data.donor_certificates.length > 0 && (
              <div className="dash-card__footer">
                <Link to="/certificates/donor/" className="md-btn md-btn--text">
                  View All
                  <span className="md-icon dash-btn-trailing-icon" aria-hidden="true">
                    arrow_forward
                  </span>
                </Link>
              </div>
            )}
          </article>
        </div>
      </section>

      {/* Your Contributions */}
      <section className="dash-section" aria-labelledby="dash-sec-contrib">
        <div className="dash-section-head">
          <h2 className="md-section__title" id="dash-sec-contrib">
            Your Contributions
          </h2>
          <p className="dash-section-sub">Making a difference through donations</p>
        </div>
        <div className="dash-contrib-grid">
          <article className="md-card dash-card" aria-labelledby="dash-card-donations">
            <CardHeader icon="volunteer_activism" tone="info" title="Donation History" id="dash-card-donations" />
            <div className="dash-donations">
              <div className="dash-donations__col">
                <h4 className="dash-donations__title">
                  <span className="md-icon" aria-hidden="true">
                    inventory_2
                  </span>
                  Material Donations
                </h4>
                {!data ? (
                  <SkeletonList rows={2} label="Loading material donations" />
                ) : data.material_donations.length > 0 ? (
                  <ul className="md-list dash-list dash-list--compact">
                    {data.material_donations.slice(0, 3).map((donation) => (
                      <li key={donation.id} className="md-list-item">
                        <span className="md-list-item__body">
                          <span className="md-list-item__headline" title={`${donation.item_name} (${donation.quantity})`}>
                            {donation.item_name} ({donation.quantity})
                          </span>
                        </span>
                        <span className="md-list-item__trailing">
                          <span className="md-visually-hidden">Status:</span>
                          <StatusChip status={donation.status}>{donation.status_display}</StatusChip>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="dash-donations__empty">No material donations yet.</p>
                )}
              </div>
              <div className="dash-donations__col">
                <h4 className="dash-donations__title">
                  <span className="md-icon" aria-hidden="true">
                    payments
                  </span>
                  Money Donations
                </h4>
                {!data ? (
                  <SkeletonList rows={2} label="Loading money donations" />
                ) : data.money_donations.length > 0 ? (
                  <ul className="md-list dash-list dash-list--compact">
                    {data.money_donations.slice(0, 3).map((donation) => (
                      <li key={donation.id} className="md-list-item">
                        <span className="md-list-item__body">
                          <span className="md-list-item__headline dash-amount">₹{donation.amount}</span>
                        </span>
                        <span className="md-list-item__trailing dash-muted">{dateFormat(donation.created_at, 'M d, Y')}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="dash-donations__empty">No money donations yet.</p>
                )}
              </div>
            </div>
          </article>

          {/* Lifetime Volunteer Section */}
          {data && !data.is_lifetime_volunteer && (
            <article className="md-card dash-card" aria-labelledby="dash-card-lifetime">
              <CardHeader icon="stars" tone="tertiary" title="Lifetime Volunteer" id="dash-card-lifetime" />
              <div className="md-card__content dash-lifetime">
                {data.lifetime_volunteer ? (
                  data.lifetime_volunteer.status === 'pending' ? (
                    <div className="dash-note dash-note--warning">
                      <span className="md-icon" aria-hidden="true">
                        hourglass_empty
                      </span>
                      <div className="dash-note__body">
                        <h4 className="dash-note__title">Application Under Review</h4>
                        <p>
                          Thank you for applying to become a lifetime volunteer. Your application is currently under review
                          and will be processed soon.
                        </p>
                      </div>
                    </div>
                  ) : data.lifetime_volunteer.status === 'rejected' ? (
                    <div className="dash-note dash-note--error">
                      <span className="md-icon" aria-hidden="true">
                        cancel
                      </span>
                      <div className="dash-note__body">
                        <h4 className="dash-note__title">Application Not Approved</h4>
                        <p>
                          We regret to inform you that your lifetime volunteer application has not been approved at this
                          time. If you have any questions, please contact our team.
                        </p>
                      </div>
                    </div>
                  ) : null
                ) : (
                  <div className="dash-lifetime__promo">
                    <span className="dash-lifetime__badge" aria-hidden="true">
                      <span className="md-icon">local_florist</span>
                    </span>
                    <h4 className="dash-lifetime__title">Become a Lifetime Volunteer</h4>
                    <p className="dash-lifetime__text">
                      Join our core team and make a lasting commitment to creating positive change in our community.
                    </p>
                    <Link to="/volunteer/lifetime/" className="md-btn md-btn--filled">
                      <span className="md-icon" aria-hidden="true">
                        stars
                      </span>
                      Apply Now
                    </Link>
                  </div>
                )}
              </div>
            </article>
          )}

          {data && data.is_lifetime_volunteer && (
            <article className="md-card dash-card" aria-labelledby="dash-card-lifetime">
              <CardHeader icon="emoji_events" tone="success" title="Lifetime Volunteer" id="dash-card-lifetime" />
              <div className="md-card__content dash-lifetime">
                <div className="dash-note dash-note--success">
                  <span className="md-icon" aria-hidden="true">
                    local_florist
                  </span>
                  <div className="dash-note__body">
                    <h4 className="dash-note__title">Application has been verified</h4>
                    <p>
                      Your lifetime commitment keeps Pehchan rooted in purpose and flourishing with possibilities. Thank you
                      for nurturing hope!
                    </p>
                  </div>
                </div>
              </div>
            </article>
          )}
        </div>
      </section>

      {/* Contact Section */}
      <section className="md-card dash-contact-card" aria-labelledby="dash-contact-title">
        <div className="dash-contact-card__intro">
          <span className="md-card__icon dash-icon--secondary" aria-hidden="true">
            <span className="md-icon">contact_support</span>
          </span>
          <h2 className="dash-contact-card__title" id="dash-contact-title">
            Send us a message
          </h2>
          <p className="dash-contact-card__text">
            Have a question or feedback? We'd love to hear from you. Our team will get back to you as soon as possible.
          </p>
        </div>
        <div className="dash-contact">
          <ContactForm source="dashboard" />
        </div>
      </section>
    </DashboardLayout>
  );
}
