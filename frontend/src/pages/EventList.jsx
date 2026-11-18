import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import { PageHeader, Pagination, SkeletonCard, StatusChip } from '../components/dashboard/ui.jsx';
import { useApi } from '../hooks/useApi.js';
import { dateFormat } from '../utils/filters.js';
import Error404 from './Error404.jsx';
import pageCss from './css/dashboard-events.css?inline';

/** request.GET.get(name, '') – Django's QueryDict returns the last value of a repeated key. */
function getParam(searchParams, name) {
  const all = searchParams.getAll(name);
  return all.length ? all[all.length - 1] : '';
}

/** Django |truncatewords:n – Truncator(value).words(n, truncate=" …") */
function truncatewords(value, n) {
  const words = String(value ?? '').split(/\s+/).filter(Boolean);
  if (words.length > n) return `${words.slice(0, n).join(' ')} …`;
  return words.join(' ');
}

/** React port of templates/event_list.html (EventListView, paginate_by = 3). */
export default function EventList() {
  const request = useApi();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlSearch = getParam(searchParams, 'search');
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [searchInput, setSearchInput] = useState(urlSearch);

  useEffect(() => {
    let active = true;
    const search = getParam(searchParams, 'search');
    setSearchInput(search);
    request('/events/', { query: { search, page: getParam(searchParams, 'page') } }).then((res) => {
      if (!active) return;
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (res.ok) {
        setNotFound(false);
        setData(res.data);
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // <form method="GET" action="{% url 'event_list' %}">
  const onSearch = (e) => {
    e.preventDefault();
    const search = `?${new URLSearchParams([['search', searchInput]]).toString()}`;
    navigate(`/dashboard/events/${search}`, {
      replace: location.pathname === '/dashboard/events/' && location.search === search,
    });
  };

  if (notFound) return <Error404 />;

  const searchQuery = data ? data.search_query ?? '' : urlSearch;
  const events = data ? data.events : null;
  const pageObj = data ? data.page_obj : null;
  // href="?page=N{% if search_query %}&search={{ search_query }}{% endif %}" (not URL-encoded, like the template)
  const searchSuffix = searchQuery ? `&search=${searchQuery}` : '';

  return (
    <DashboardLayout title="Events - Pehchan" heading="Events" css={pageCss}>
      <PageHeader
        eyebrow="Volunteer Opportunities"
        eyebrowIcon="event"
        title="Upcoming Events"
        subtitle="Choose a gathering that lets you plant new hope and make a lasting impact in the community."
      />

      {/* Search */}
      <div className="md-card md-card--flat ev-search-card">
        <form method="GET" action="/dashboard/events/" role="search" className="ev-search" onSubmit={onSearch}>
          <label htmlFor="ev-search-input" className="md-visually-hidden">
            Search events
          </label>
          <div className="md-search ev-search__field">
            <span className="md-icon" aria-hidden="true">
              search
            </span>
            <input
              type="text"
              name="search"
              id="ev-search-input"
              className="md-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search events by name, location or keyword..."
            />
          </div>
          <div className="ev-search__actions">
            <button type="submit" className="md-btn md-btn--filled">
              Search
            </button>
            {searchQuery && (
              <Link to="/dashboard/events/" className="md-btn md-btn--outlined">
                Clear
              </Link>
            )}
          </div>
        </form>
      </div>

      <section className="ev-results" aria-label="Events" aria-busy={events ? undefined : 'true'}>
        {searchQuery && (
          <h2 className="ev-results__title">
            Showing results for "{searchQuery}"
          </h2>
        )}

        {!events ? (
          <div className="ev-grid">
            <SkeletonCard media lines={3} label="Loading events" />
            <SkeletonCard media lines={3} label="Loading events" />
            <SkeletonCard media lines={3} label="Loading events" />
          </div>
        ) : events.length > 0 ? (
          <>
            <div className="ev-grid">
              {events.map((event) => (
                <article key={event.id} className="md-card md-card--interactive ev-card" aria-labelledby={`ev-title-${event.id}`}>
                  <div className={`ev-card__media${event.image ? '' : ' ev-card__media--empty'}`}>
                    {event.image ? (
                      <img src={event.image} alt={event.name} loading="lazy" />
                    ) : (
                      <span className="md-icon" aria-hidden="true">
                        celebration
                      </span>
                    )}
                    <span className="ev-card__status">
                      <StatusChip status={event.status_display}>{event.status_display}</StatusChip>
                    </span>
                  </div>
                  <div className="md-card__content ev-card__body">
                    <h2 className="ev-card__title" id={`ev-title-${event.id}`} title={event.name}>
                      {event.name}
                    </h2>
                    <ul className="ev-meta">
                      <li>
                        <span className="md-icon" aria-hidden="true">
                          event
                        </span>
                        <span>{dateFormat(event.event_date, 'F d, Y')}</span>
                      </li>
                      <li>
                        <span className="md-icon" aria-hidden="true">
                          location_on
                        </span>
                        <span>{event.location}</span>
                      </li>
                    </ul>
                    <p className="ev-card__desc">{truncatewords(event.description, 24)}</p>
                  </div>
                  <div className="ev-card__actions">
                    <Link to={`/dashboard/events/${event.id}/`} className="md-btn md-btn--tonal">
                      <span className="md-icon" aria-hidden="true">
                        arrow_forward
                      </span>
                      View Details
                      <span className="md-visually-hidden">: {event.name}</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>

            {data.is_paginated && pageObj && <Pagination pageObj={pageObj} suffix={searchSuffix} label="Events pages" />}
          </>
        ) : (
          <div className="md-card md-card--flat">
            <div className="md-empty dash-empty--page">
              <span className="md-icon" aria-hidden="true">
                {searchQuery ? 'search_off' : 'event_busy'}
              </span>
              <h2 className="md-empty__title">{searchQuery ? 'No matches found' : 'No Upcoming Events'}</h2>
              <p className="md-empty__text">
                {searchQuery
                  ? `We couldn't find any events matching "${searchQuery}". Try a different keyword.`
                  : 'New experiences will bloom soon. Check back later for exciting volunteer opportunities!'}
              </p>
              <Link to="/dashboard/events/" className="md-btn md-btn--outlined ev-empty-btn">
                <span className="md-icon" aria-hidden="true">
                  {searchQuery ? 'refresh' : 'arrow_back'}
                </span>
                {searchQuery ? 'Show All Events' : 'Back to Events'}
              </Link>
            </div>
          </div>
        )}
      </section>

      <div className="dash-back-row">
        <Link to="/dashboard/" className="md-btn md-btn--text">
          <span className="md-icon" aria-hidden="true">
            home
          </span>
          Back to Dashboard
        </Link>
      </div>
    </DashboardLayout>
  );
}
