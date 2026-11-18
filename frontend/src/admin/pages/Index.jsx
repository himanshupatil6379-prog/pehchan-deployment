import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminLayout from '../AdminLayout.jsx';
import { useAdmin, useAdminPage } from '../AdminContext.jsx';
import AppList from '../components/AppList.jsx';
import { errorPageFor } from './Errors.jsx';
import { capfirst } from '../utils.js';

const FLAGS = {
  1: { className: 'addlink', label: 'Added', tone: 'success', icon: 'add' },
  2: { className: 'changelink', label: 'Changed', tone: 'info', icon: 'edit' },
  3: { className: 'deletelink', label: 'Deleted', tone: 'error', icon: 'delete' },
};

/** {% block sidebar %} of admin/index.html – "Recent actions" card. */
function RecentActions({ actions }) {
  const list = actions || [];
  return (
    <aside id="content-related" className="adm-recent-col">
      <section className="md-card adm-recent module" id="recent-actions-module" aria-labelledby="recent-actions-heading">
        <div className="md-card__header">
          <span className="md-card__icon" aria-hidden="true">
            <span className="md-icon">history</span>
          </span>
          <div>
            <h2 className="md-card__title" id="recent-actions-heading">
              Recent actions
            </h2>
            <h3 className="md-card__subtitle adm-recent__sub">My actions</h3>
          </div>
        </div>
        {!list.length ? (
          <div className="md-empty adm-recent__empty">
            <span className="md-icon" aria-hidden="true">
              history_toggle_off
            </span>
            <p className="md-empty__text">None available</p>
          </div>
        ) : (
          <ul className="actionlist adm-recent__list">
            {list.map((entry, i) => {
              const flag = FLAGS[Number(entry.action_flag)] || null;
              const linked = Number(entry.action_flag) !== 3 && entry.url;
              return (
                <li key={i} className={`adm-recent__item ${flag ? flag.className : ''}`}>
                  <span className={`adm-recent__icon adm-recent__icon--${flag ? flag.tone : 'neutral'}`} aria-hidden="true">
                    <span className="md-icon">{flag ? flag.icon : 'info'}</span>
                  </span>
                  <div className="adm-recent__body">
                    <span className="md-visually-hidden">{flag ? `${flag.label}:` : ''}</span>{' '}
                    {linked ? (
                      <Link to={entry.url} className="adm-recent__title" title={entry.object_repr}>
                        {entry.object_repr}
                      </Link>
                    ) : (
                      <span className="adm-recent__title" title={entry.object_repr}>
                        {entry.object_repr}
                      </span>
                    )}
                    <span className="adm-recent__meta">
                      {flag ? (
                        <span className={`md-chip md-chip--${flag.tone} adm-chip--xs`} aria-hidden="true">
                          {flag.label}
                        </span>
                      ) : null}
                      <span className="mini quiet">{entry.content_type_name ? capfirst(entry.content_type_name) : 'Unknown content'}</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </aside>
  );
}

/** admin/index.html */
export function IndexPage() {
  const page = useAdminPage();
  const { setAppList, session, theme, user } = useAdmin();
  const data = page.data || {};

  useEffect(() => {
    if (page.ok && Array.isArray(data.app_list)) setAppList(data.app_list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.version]);

  const err = errorPageFor(page);
  if (err) return err;
  const shortName = user ? user.first_name || user.username : '';
  const showRecent = theme.recent_actions_visible !== false;

  return (
    <AdminLayout
      title={data.title || session.index_title || 'Site administration'}
      subtitle={shortName ? `Welcome, ${shortName}.` : null}
      bodyClass="dashboard"
      breadcrumbs={false}
      pending={!page.data}
    >
      <div className={`adm-dashboard${showRecent ? ' has-recent' : ''}`}>
        <div id="content-main" className="adm-dashboard__main">
          <AppList appList={data.app_list} showChangeLinks />
        </div>
        {showRecent ? <RecentActions actions={data.recent_actions} /> : null}
      </div>
    </AdminLayout>
  );
}

/** admin/app_index.html */
export function AppIndexPage() {
  const { app } = useParams();
  const page = useAdminPage();
  const data = page.data || {};

  const err = errorPageFor(page);
  if (err) return err;
  const apps = data.app_list || [];

  return (
    <AdminLayout
      title={data.title}
      bodyClass={`dashboard app-${app}`}
      breadcrumbs={apps.length ? [[apps.map((a) => a.name).join(' ')]] : []}
      pending={!page.data}
    >
      <div className="adm-dashboard">
        <div id="content-main" className="adm-dashboard__main">
          <AppList appList={apps} showChangeLinks />
        </div>
      </div>
    </AdminLayout>
  );
}
