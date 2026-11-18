import { Link, useParams } from 'react-router-dom';
import AdminLayout from '../AdminLayout.jsx';
import { useAdmin, useAdminPage } from '../AdminContext.jsx';
import { errorPageFor } from './Errors.jsx';
import { appVerboseName, capfirst, findModel, formatDateTime, queryHref, truncatewords } from '../utils.js';

function entryKind(message) {
  const m = String(message || '').trim();
  if (/^added/i.test(m)) return { tone: 'add', icon: 'add' };
  if (/^deleted/i.test(m)) return { tone: 'delete', icon: 'delete' };
  return { tone: 'change', icon: 'edit' };
}

/** admin/object_history.html as a timeline card. */
export default function HistoryPage() {
  const { app, model, id } = useParams();
  const page = useAdminPage();
  const { appList } = useAdmin();

  const err = errorPageFor(page);
  if (err) return err;
  const data = page.data || {};
  const actions = data.actions || data.action_list || [];
  const m = data.model || {};
  const entry = findModel(appList, app, model);
  const moduleName = capfirst(m.verbose_name_plural || (entry ? entry.name : model));
  const objectRepr = data.object_repr || '';
  const pg = data.pagination || null;
  const count = pg && pg.count != null ? pg.count : actions.length;
  const pathname = `/admin/${app}/${model}/${id}/history/`;

  return (
    <AdminLayout
      title={data.title || `Change history: ${objectRepr}`}
      overline={moduleName}
      breadcrumbs={[
        [appVerboseName(appList, app), `/admin/${app}/`],
        [moduleName, `/admin/${app}/${model}/`],
        [truncatewords(objectRepr, 18), `/admin/${app}/${model}/${id}/change/`],
        ['History'],
      ]}
      pending={!page.data}
    >
      <div id="content-main">
        <section id="change-history" className="module md-card adm-history" aria-label="Change history">
          {actions.length ? (
            <>
              <ol className="adm-timeline">
                {actions.map((a, i) => {
                  const kind = entryKind(a.change_message);
                  return (
                    <li key={i} className="adm-timeline__item">
                      <span className={`adm-timeline__dot adm-timeline__dot--${kind.tone}`} aria-hidden="true">
                        <span className="md-icon">{kind.icon}</span>
                      </span>
                      <div className="adm-timeline__body">
                        <p className="adm-timeline__msg">
                          <span className="md-visually-hidden">Action: </span>
                          {a.change_message || '—'}
                        </p>
                        <p className="adm-timeline__meta">
                          <span className="adm-timeline__when">
                            <span className="md-icon" aria-hidden="true">
                              schedule
                            </span>
                            <span className="md-visually-hidden">Date/time: </span>
                            <time dateTime={a.action_time}>{formatDateTime(a.action_time)}</time>
                          </span>
                          <span className="adm-timeline__who">
                            <span className="md-icon" aria-hidden="true">
                              person
                            </span>
                            <span className="md-visually-hidden">User: </span>
                            {a.user}
                            {a.user_full_name ? ` (${a.user_full_name})` : ''}
                          </span>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="adm-history__footer">
                {pg && pg.multi_page && pg.pages ? (
                  <nav className="paginator adm-paginator" aria-label="Pagination">
                    {pg.pages.map((p, i) =>
                      p.ellipsis ? (
                        <span key={`e${i}`} className="adm-paginator__gap" aria-hidden="true">
                          …
                        </span>
                      ) : p.current ? (
                        <span key={p.number} className="this-page" aria-current="page">
                          {p.number}
                        </span>
                      ) : (
                        <Link
                          key={p.number}
                          to={queryHref(pathname, p.query || `?p=${p.number}`)}
                          className={p.number === pg.num_pages ? 'end' : undefined}
                          aria-label={`Page ${p.number}`}
                        >
                          {p.number}
                        </Link>
                      )
                    )}
                  </nav>
                ) : null}
                <p className="adm-history__count">
                  {count} {count === 1 ? 'entry' : 'entries'}
                </p>
              </div>
            </>
          ) : (
            <div className="md-empty">
              <span className="md-icon" aria-hidden="true">
                history_toggle_off
              </span>
              <p className="md-empty__text">This object doesn’t have a change history. It probably wasn’t added via this admin site.</p>
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
