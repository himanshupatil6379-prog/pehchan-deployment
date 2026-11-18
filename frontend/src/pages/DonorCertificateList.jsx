import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import { PageHeader, Pagination } from '../components/dashboard/ui.jsx';
import { useApi } from '../hooks/useApi.js';
import { dateFormat, MONTHS } from '../utils/filters.js';
import Error404 from './Error404.jsx';
import pageCss from './css/dashboard-certificates.css?inline';

/** QueryDict.get(): last value of a key, or `fallback` when the key is absent. */
function getParam(searchParams, key, fallback) {
  const all = searchParams.getAll(key);
  return all.length ? all[all.length - 1] : fallback;
}

/** React port of templates/donor_certificate_list.html (DonorCertificateListView, 5 per page). */
export default function DonorCertificateList() {
  const request = useApi();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // get_context_data(): search_query / current_month / current_sort
  const searchQuery = getParam(searchParams, 'search', '');
  const currentMonth = getParam(searchParams, 'month', '');
  const currentSort = getParam(searchParams, 'sort', 'newest');

  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState({ search: searchQuery, month: currentMonth, sort: currentSort });

  useEffect(() => {
    // A GET form re-renders the page with the values coming from the URL.
    setForm({ search: searchQuery, month: currentMonth, sort: currentSort });

    const controller = new AbortController();
    let active = true;
    request(`/certificates/donor/${location.search}`, { signal: controller.signal })
      .then((res) => {
        if (!active || res.redirected) return;
        if (res.status === 404) {
          setNotFound(true);
        } else if (res.ok) {
          setNotFound(false);
          setData(res.data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, location.search]);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // <form method="GET" action=".">
  const onSubmit = (e) => {
    e.preventDefault();
    const qs = new URLSearchParams();
    for (const [k, v] of new FormData(e.currentTarget).entries()) qs.append(k, v);
    const url = `${location.pathname}?${qs.toString()}`;
    navigate(url, { replace: url === location.pathname + location.search });
  };

  if (notFound) return <Error404 />;

  const donorCertificates = data ? data.donor_certificates || [] : null;
  const isPaginated = data ? data.is_paginated : false;
  const pageObj = (data && data.page_obj) || {};
  const filtered = !!(searchQuery || currentMonth || currentSort !== 'newest');

  // Same (unencoded) query string the template builds for the pagination links.
  const extra =
    (searchQuery ? `&search=${searchQuery}` : '') +
    (currentMonth ? `&month=${currentMonth}` : '') +
    (currentSort ? `&sort=${currentSort}` : '');

  return (
    <DashboardLayout title="Donor Certificates - Pehchan" heading="Donor Certificates" css={pageCss}>
      <PageHeader
        eyebrow="Donor Recognition"
        eyebrowIcon="card_giftcard"
        title="Your Donor Certificates"
        subtitle="Thank you for your generous contributions. Each certificate represents your commitment to making a difference in our community."
        actions={
          <Link to="/dashboard/verify-certificate/" className="md-btn md-btn--tonal">
            <span className="md-icon" aria-hidden="true">
              verified_user
            </span>
            Verify a Certificate
          </Link>
        }
      />

      {/* Filters & Search Section */}
      <section className="md-card md-card--flat cert-filter-card" aria-label="Search and filter donor certificates">
        <form method="GET" action="." onSubmit={onSubmit} className="dash-filter" role="search">
          {/* Search */}
          <div className="md-field">
            <label className="md-field__label" htmlFor="cert-filter-search">
              Search
            </label>
            <div className="dash-input-icon">
              <span className="md-icon" aria-hidden="true">
                search
              </span>
              <input
                type="text"
                name="search"
                id="cert-filter-search"
                className="md-input"
                value={form.search}
                onChange={onChange}
                placeholder="Cert No. or Donation Item"
              />
            </div>
          </div>

          {/* Month Filter */}
          <div className="md-field">
            <label className="md-field__label" htmlFor="cert-filter-month">
              Filter by Month
            </label>
            <select name="month" id="cert-filter-month" className="md-select" value={form.month} onChange={onChange}>
              <option value="">All Months</option>
              {MONTHS.map(([mVal, mName]) => (
                <option key={mVal} value={mVal}>
                  {mName}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="md-field">
            <label className="md-field__label" htmlFor="cert-filter-sort">
              Sort by
            </label>
            <select name="sort" id="cert-filter-sort" className="md-select" value={form.sort} onChange={onChange}>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>

          {/* Actions */}
          <div className="dash-filter__actions">
            <button type="submit" className="md-btn md-btn--filled">
              <span className="md-icon" aria-hidden="true">
                filter_list
              </span>
              Apply
            </button>
            {filtered && (
              <Link to={location.pathname} className="md-icon-btn" title="Clear Filters" aria-label="Clear Filters">
                <span className="md-icon" aria-hidden="true">
                  refresh
                </span>
              </Link>
            )}
          </div>
        </form>
      </section>

      <section className="cert-results" aria-labelledby="cert-results-title">
        {!donorCertificates ? (
          <div className="md-card dash-table-card">
            <div className="md-card__header">
              <h2 className="md-card__title" id="cert-results-title">
                Donor Certificates
              </h2>
            </div>
            <div className="cert-skeleton" role="status" aria-label="Loading donor certificates">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="md-skeleton cert-skeleton__row" aria-hidden="true" />
              ))}
            </div>
          </div>
        ) : donorCertificates.length ? (
          <>
            <div className="md-card dash-table-card">
              <div className="md-card__header">
                <span className="md-card__icon dash-icon--tertiary" aria-hidden="true">
                  <span className="md-icon">workspace_premium</span>
                </span>
                <div className="dash-card__heading">
                  <h2 className="md-card__title" id="cert-results-title">
                    Donor Certificates
                  </h2>
                  {typeof pageObj.count === 'number' && (
                    <p className="md-card__subtitle">
                      {pageObj.start_index}–{pageObj.end_index} of {pageObj.count}
                    </p>
                  )}
                </div>
              </div>
              <div className="md-table-wrap dash-table-stack">
                <table className="md-table cert-table">
                  <thead>
                    <tr>
                      <th scope="col">Serial No.</th>
                      <th scope="col">Certificate No.</th>
                      <th scope="col">Donation Type</th>
                      <th scope="col">Issue Date</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {donorCertificates.map((cert, i) => (
                      <tr key={cert.id}>
                        <td data-label="Serial No." className="dash-num">
                          {(pageObj.start_index || 0) + i}
                        </td>
                        <td data-label="Certificate No.">
                          <span className="dash-code">{cert.certificate_number}</span>
                        </td>
                        <td data-label="Donation Type">
                          <strong className="dash-cell-strong">{cert.donation_type_display}</strong>
                        </td>
                        <td data-label="Issue Date" className="cert-nowrap">
                          {dateFormat(cert.issue_date, 'M d, Y')}
                        </td>
                        <td data-label="Actions">
                          <Link to={`/certificates/donor/${cert.id}/`} className="md-btn md-btn--text md-btn--sm cert-view">
                            <span className="md-icon" aria-hidden="true">
                              visibility
                            </span>
                            View Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {isPaginated && <Pagination pageObj={pageObj} suffix={extra} label="Donor certificate pages" />}
          </>
        ) : (
          <div className="md-card md-card--flat">
            <h2 className="md-visually-hidden" id="cert-results-title">
              Donor Certificates
            </h2>
            <div className="md-empty dash-empty--page cert-empty">
              <span className="md-icon" aria-hidden="true">
                card_giftcard
              </span>
              <h3 className="md-empty__title">No Donor Certificates Yet</h3>
              <p className="md-empty__text">
                You haven't received any donor certificates yet. Make a donation to receive recognition for your generous
                contribution!
              </p>
              <div className="cert-empty__actions">
                <Link to="/donate/material/" className="md-btn md-btn--filled">
                  <span className="md-icon" aria-hidden="true">
                    inventory_2
                  </span>
                  Donate Materials
                </Link>
                <Link to="/donate/money/" className="md-btn md-btn--tonal">
                  <span className="md-icon" aria-hidden="true">
                    payments
                  </span>
                  Donate Money
                </Link>
              </div>
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
