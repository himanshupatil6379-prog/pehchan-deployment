import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import { KpiCard, PageHeader, StatusChip } from '../components/dashboard/ui.jsx';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { dateFormat } from '../utils/filters.js';
import pageCss from './css/admin-dashboard.css?inline';

/** Management shortcuts (the links of the original admin sidebar). */
const SHORTCUTS = [
  { to: '/admin/auth/user/', label: 'Users', icon: 'people' },
  { to: '/admin/pehchan/eventvolunteer/', label: 'Volunteers', icon: 'volunteer_activism' },
  { to: '/admin/pehchan/event/', label: 'Events', icon: 'event' },
  { to: '/admin/pehchan/moneydonation/', label: 'Donations', icon: 'card_giftcard' },
  { to: '/admin/pehchan/certificate/', label: 'Certificates', icon: 'workspace_premium' },
  { to: '/admin/', label: 'Django Admin', icon: 'settings' },
];

function SkeletonRows({ cols, rows = 3 }) {
  return Array.from({ length: rows }, (_, r) => (
    <tr key={`sk-${r}`} aria-hidden="true">
      {Array.from({ length: cols }, (__, c) => (
        <td key={c}>
          <span className="md-skeleton adm-skel-cell" />
        </td>
      ))}
    </tr>
  ));
}

/** React port of templates/admin_dashboard.html (view `admin_dashboard`). */
export default function AdminDashboard() {
  const request = useApi();
  const { user } = useAuth();
  const location = useLocation();
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    // Non-staff: message "Access denied. Admin privileges required." + redirect to /dashboard/ (handled by useApi).
    request('/admin-dashboard/').then((res) => {
      if (active && res.ok) setData(res.data);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // The view never renders this template for non-staff users – show nothing until the redirect happens.
  if (!data && !(user && user.is_staff)) return null;

  const username = user ? user.username : '';
  const usersCount = data && data.recent_users ? data.recent_users.length : 0;
  const eventsCount = data && data.recent_events ? data.recent_events.length : 0;

  return (
    <DashboardLayout title="Admin Dashboard - Pehchan" heading="Admin Overview" css={pageCss}>
      <PageHeader
        eyebrow={`Pehchan Admin · ${username}`}
        eyebrowIcon="admin_panel_settings"
        title="Dashboard Overview"
        subtitle="Welcome back! Here's what's happening with your organization today."
        actions={
          <>
            <Link to="/dashboard/" className="md-btn md-btn--outlined">
              <span className="md-icon" aria-hidden="true">
                home
              </span>
              User Dashboard
            </Link>
            <Link to="/admin/" className="md-btn md-btn--filled">
              <span className="md-icon" aria-hidden="true">
                settings
              </span>
              Django Admin
            </Link>
          </>
        }
      />

      {/* Stats Cards */}
      <section className="md-grid--kpi" aria-label="Organization statistics">
        <KpiCard icon="people" label="Total Users" value={data ? data.total_users_count : null} hint="Registered accounts" />
        <KpiCard
          icon="volunteer_activism"
          tone="success"
          label="Active Volunteers"
          value={data ? data.active_volunteers_count : null}
          hint="Approved event volunteers"
        />
        <KpiCard
          icon="event"
          tone="info"
          label="Upcoming Events"
          value={data ? data.upcoming_events_count : null}
          hint="Scheduled initiatives"
        />
        <KpiCard
          icon="payments"
          tone="tertiary"
          label="Total Donations"
          value={data ? data.money_display : null}
          hint="Total contributions"
        />
      </section>

      {/* Management shortcuts */}
      <section className="dash-section" aria-labelledby="adm-manage-title">
        <div className="dash-section-head">
          <h2 className="md-section__title" id="adm-manage-title">
            Management
          </h2>
          <p className="dash-section-sub">Jump straight to the records you manage in the admin panel</p>
        </div>
        <nav className="adm-shortcuts" aria-labelledby="adm-manage-title">
          {SHORTCUTS.map((s) => (
            <Link key={s.to} to={s.to} className="adm-shortcut">
              <span className="adm-shortcut__icon" aria-hidden="true">
                <span className="md-icon">{s.icon}</span>
              </span>
              <span className="adm-shortcut__label">{s.label}</span>
              <span className="md-icon adm-shortcut__go" aria-hidden="true">
                arrow_forward
              </span>
            </Link>
          ))}
        </nav>
      </section>

      {/* Charts */}
      <section className="dash-section md-grid--2 adm-charts" aria-label="Analytics">
        <article className="md-card dash-card" aria-labelledby="adm-chart-users">
          <div className="md-card__header">
            <span className="md-card__icon" aria-hidden="true">
              <span className="md-icon">show_chart</span>
            </span>
            <div className="dash-card__heading">
              <h3 className="md-card__title" id="adm-chart-users">
                User Growth
              </h3>
              <p className="md-card__subtitle">Monthly user registration trends</p>
            </div>
          </div>
          <div className="adm-chart-placeholder">
            <span className="md-icon" aria-hidden="true">
              insert_chart_outlined
            </span>
            <span>Chart: User Growth Over Time</span>
          </div>
        </article>

        <article className="md-card dash-card" aria-labelledby="adm-chart-donations">
          <div className="md-card__header">
            <span className="md-card__icon dash-icon--tertiary" aria-hidden="true">
              <span className="md-icon">donut_large</span>
            </span>
            <div className="dash-card__heading">
              <h3 className="md-card__title" id="adm-chart-donations">
                Donation Analytics
              </h3>
              <p className="md-card__subtitle">Revenue breakdown by category</p>
            </div>
          </div>
          <div className="adm-chart-placeholder">
            <span className="md-icon" aria-hidden="true">
              pie_chart_outline
            </span>
            <span>Chart: Donation Distribution</span>
          </div>
        </article>
      </section>

      {/* Recent Users Table */}
      <section className="md-card dash-table-card dash-section" aria-labelledby="adm-users-title">
        <div className="md-card__header">
          <span className="md-card__icon" aria-hidden="true">
            <span className="md-icon">group</span>
          </span>
          <div className="dash-card__heading adm-table-heading">
            <h3 className="md-card__title" id="adm-users-title">
              Recent Users
            </h3>
            <span className="md-chip md-chip--neutral">{usersCount} users</span>
          </div>
          <div className="md-card__header-actions">
            <Link to="/admin/auth/user/add/" className="md-btn md-btn--tonal md-btn--sm">
              <span className="md-icon" aria-hidden="true">
                add
              </span>
              Add User
            </Link>
          </div>
        </div>
        <div className="md-table-wrap dash-table-stack">
          <table className="md-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Joined</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <SkeletonRows cols={6} />
              ) : data.recent_users.length > 0 ? (
                data.recent_users.map((u) => {
                  const name = u.full_name || u.username;
                  const initial = Array.from(name || '').slice(0, 1).join('').toUpperCase();
                  return (
                    <tr key={u.id}>
                      <td data-label="Name">
                        <span className="adm-user-cell">
                          <span className="md-avatar adm-avatar" aria-hidden="true">
                            {initial}
                          </span>
                          <strong className="adm-truncate" title={name}>
                            {name}
                          </strong>
                        </span>
                      </td>
                      <td data-label="Email">
                        {u.email ? (
                          <span className="adm-truncate" title={u.email}>
                            {u.email}
                          </span>
                        ) : (
                          <span className="dash-muted">—</span>
                        )}
                      </td>
                      <td data-label="Role">
                        <span className={`md-chip ${u.is_staff ? 'md-chip--primary' : 'md-chip--neutral'}`}>
                          {u.is_staff ? 'Admin' : 'Volunteer'}
                        </span>
                      </td>
                      <td data-label="Status">
                        <StatusChip status="active">Active</StatusChip>
                      </td>
                      <td data-label="Joined" className="adm-nowrap">
                        {dateFormat(u.date_joined, 'M Y')}
                      </td>
                      <td data-label="Actions">
                        <Link
                          to={`/admin/auth/user/${u.id}/change/`}
                          className="md-icon-btn adm-row-action"
                          title="Edit user"
                          aria-label={`Edit user ${name}`}
                        >
                          <span className="md-icon" aria-hidden="true">
                            edit
                          </span>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="dash-td-full">
                    <div className="md-empty dash-empty">
                      <span className="md-icon" aria-hidden="true">
                        group_off
                      </span>
                      <p className="md-empty__text">No users found.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent Events Table */}
      <section className="md-card dash-table-card dash-section" aria-labelledby="adm-events-title">
        <div className="md-card__header">
          <span className="md-card__icon dash-icon--info" aria-hidden="true">
            <span className="md-icon">event</span>
          </span>
          <div className="dash-card__heading adm-table-heading">
            <h3 className="md-card__title" id="adm-events-title">
              Recent Events
            </h3>
            <span className="md-chip md-chip--neutral">{eventsCount} events</span>
          </div>
          <div className="md-card__header-actions">
            <Link to="/admin/pehchan/event/add/" className="md-btn md-btn--tonal md-btn--sm">
              <span className="md-icon" aria-hidden="true">
                add
              </span>
              Create Event
            </Link>
          </div>
        </div>
        <div className="md-table-wrap dash-table-stack">
          <table className="md-table">
            <thead>
              <tr>
                <th scope="col">Image</th>
                <th scope="col">Event Name</th>
                <th scope="col">Date</th>
                <th scope="col">Location</th>
                <th scope="col" className="is-numeric">
                  Participants
                </th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <SkeletonRows cols={7} />
              ) : data.recent_events.length > 0 ? (
                data.recent_events.map((event) => (
                  <tr key={event.id}>
                    <td data-label="Image">
                      {event.image ? (
                        <img src={event.image} alt={event.name} className="adm-thumb" loading="lazy" />
                      ) : (
                        <span className="adm-thumb adm-thumb--empty" aria-label="No image" role="img">
                          <span className="md-icon" aria-hidden="true">
                            image
                          </span>
                        </span>
                      )}
                    </td>
                    <td data-label="Event Name">
                      <strong className="adm-truncate" title={event.name}>
                        {event.name}
                      </strong>
                    </td>
                    <td data-label="Date" className="adm-nowrap">
                      {dateFormat(event.event_date, 'M d, Y')}
                    </td>
                    <td data-label="Location">
                      <span className="dash-inline-icon">
                        <span className="md-icon" aria-hidden="true">
                          place
                        </span>
                        <span className="adm-truncate" title={event.location}>
                          {event.location}
                        </span>
                      </span>
                    </td>
                    <td data-label="Participants" className="is-numeric">
                      <span className="dash-inline-icon">
                        <span className="md-icon" aria-hidden="true">
                          group
                        </span>
                        <span>{event.volunteers_count}</span>
                      </span>
                    </td>
                    <td data-label="Status">
                      <StatusChip status={event.status_display}>{event.status_display}</StatusChip>
                    </td>
                    <td data-label="Actions">
                      <Link
                        to={`/dashboard/events/${event.id}/`}
                        className="md-icon-btn adm-row-action"
                        title="View event details"
                        aria-label={`View event details: ${event.name}`}
                      >
                        <span className="md-icon" aria-hidden="true">
                          visibility
                        </span>
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="dash-td-full">
                    <div className="md-empty dash-empty">
                      <span className="md-icon" aria-hidden="true">
                        event_busy
                      </span>
                      <p className="md-empty__text">No events found.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}
