import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import { PageHeader, SkeletonCard, StatusChip } from '../components/dashboard/ui.jsx';
import { useApi } from '../hooks/useApi.js';
import { dateFormat } from '../utils/filters.js';
import Error404 from './Error404.jsx';
import pageCss from './css/dashboard-events.css?inline';

/** React port of templates/event_detail.html (EventDetailView + join_event). */
export default function EventDetail() {
  const { pk } = useParams();
  const request = useApi();
  const location = useLocation();
  const validPk = /^[0-9]+$/.test(pk || ''); // <int:pk>
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [contactNumber, setContactNumber] = useState('');
  const submittingRef = useRef(false);

  // join_event always redirects back to this URL: re-fetch on every navigation (location.key).
  useEffect(() => {
    if (!validPk) return undefined;
    let active = true;
    request(`/events/${pk}/`).then((res) => {
      if (!active) return;
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (res.ok) {
        setNotFound(false);
        setData(res.data);
        setContactNumber(''); // fresh, unbound EventVolunteerForm
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pk, location.key]);

  // <form method="POST" action="{% url 'join_event' event.pk %}">
  const onJoin = async (e) => {
    e.preventDefault();
    if (submittingRef.current || !data) return;
    submittingRef.current = true;
    try {
      await request(`/events/${data.event.id}/join/`, { method: 'POST', data: { contact_number: contactNumber } });
    } finally {
      submittingRef.current = false;
    }
  };

  if (!validPk || notFound) return <Error404 />;

  const event = data ? data.event : null;

  return (
    <DashboardLayout title={event ? `${event.name} - Pehchan` : undefined} heading="Event Details" css={pageCss}>
      {!event ? (
        <div className="ev-detail" aria-busy="true">
          <div className="ev-detail__main">
            <SkeletonCard media lines={5} label="Loading event" />
          </div>
          <div className="ev-detail__aside">
            <SkeletonCard lines={2} label="Loading event" />
          </div>
        </div>
      ) : (
        <>
          <PageHeader
            eyebrow="Volunteer Opportunity"
            eyebrowIcon="celebration"
            title={event.name}
            actions={
              <Link to="/dashboard/events/" className="md-btn md-btn--outlined">
                <span className="md-icon" aria-hidden="true">
                  arrow_back
                </span>
                Back to Events
              </Link>
            }
          />

          <div className="ev-detail">
            <article className="md-card ev-detail__main" aria-label="Event information">
              {event.image && (
                <div className="ev-hero-media">
                  <img src={event.image} alt={event.name} loading="lazy" />
                </div>
              )}

              <div className="md-card__content ev-detail__content">
                {/* Event Info Grid */}
                <div className="dash-info-grid">
                  <div className="dash-info-tile">
                    <span className="dash-info-tile__label">
                      <span className="md-icon" aria-hidden="true">
                        event
                      </span>
                      Event Date
                    </span>
                    <p className="dash-info-tile__value">{dateFormat(event.event_date, 'F d, Y')}</p>
                  </div>

                  <div className="dash-info-tile">
                    <span className="dash-info-tile__label">
                      <span className="md-icon" aria-hidden="true">
                        location_on
                      </span>
                      Location
                    </span>
                    <p className="dash-info-tile__value">{event.location}</p>
                  </div>

                  <div className="dash-info-tile">
                    <span className="dash-info-tile__label">
                      <span className="md-icon" aria-hidden="true">
                        info
                      </span>
                      Status
                    </span>
                    <div>
                      <StatusChip status={event.status_display}>{event.status_display}</StatusChip>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <section className="ev-about" aria-labelledby="ev-about-title">
                  <h2 className="ev-about__title" id="ev-about-title">
                    <span className="md-icon" aria-hidden="true">
                      description
                    </span>
                    About This Event
                  </h2>
                  <p className="ev-about__text">{event.description}</p>
                </section>
              </div>

              {/* Metadata */}
              <div className="md-card__footer ev-meta-footer">
                <span className="md-icon" aria-hidden="true">
                  schedule
                </span>
                <span>
                  Created: {dateFormat(event.created_at, 'M d, Y')} | Last Updated: {dateFormat(event.updated_at, 'M d, Y')}
                </span>
              </div>
            </article>

            <aside className="ev-detail__aside" aria-label="Volunteer">
              <section className="md-card ev-join-card" aria-labelledby="ev-join-title">
                <div className="md-card__header">
                  <span className="md-card__icon dash-icon--success" aria-hidden="true">
                    <span className="md-icon">volunteer_activism</span>
                  </span>
                  <h2 className="md-card__title" id="ev-join-title">
                    Volunteer for this event
                  </h2>
                </div>
                <div className="md-card__content">
                  {data.already_joined ? (
                    <div className="ev-joined">
                      <button className="md-btn md-btn--block md-btn--lg" disabled>
                        <span className="md-icon" aria-hidden="true">
                          check_circle
                        </span>
                        Already Joined
                      </button>
                    </div>
                  ) : (
                    <form method="POST" onSubmit={onJoin} className="dash-form ev-join-form">
                      <div className="md-field">
                        <label className="md-field__label" htmlFor="id_contact_number">
                          <span className="md-icon" aria-hidden="true">
                            phone
                          </span>
                          Contact Number{' '}
                          <span className="md-required" aria-hidden="true">
                            *
                          </span>
                        </label>
                        <input
                          type="text"
                          name="contact_number"
                          className="md-input"
                          placeholder="Contact Number (10 digits)"
                          pattern="[0-9]{10}"
                          title="Please enter exactly 10 digits"
                          maxLength={10}
                          minLength={10}
                          required
                          id="id_contact_number"
                          inputMode="numeric"
                          aria-describedby="id_contact_number_helptext"
                          value={contactNumber}
                          onChange={(e) => setContactNumber(e.target.value)}
                        />
                        <p className="md-field__helper" id="id_contact_number_helptext">
                          Enter your 10-digit number to join this event
                        </p>
                        {/* volunteer_form is always unbound (join_event redirects), so its errors block never renders. */}
                      </div>
                      <button type="submit" className="md-btn md-btn--filled md-btn--lg md-btn--block">
                        <span className="md-icon" aria-hidden="true">
                          volunteer_activism
                        </span>
                        Join as Volunteer
                      </button>
                    </form>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
