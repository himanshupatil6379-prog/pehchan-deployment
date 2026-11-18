import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAdmin } from '../AdminContext.jsx';
import { BRAND_LOGO, modelIcon, modelKey } from '../icons.js';
import { useFoldableApp } from './AppList.jsx';

const FILTER_KEY = 'django.admin.navSidebarFilterValue';

/**
 * admin/nav_sidebar.html + admin/js/nav_sidebar.js as an M3 navigation drawer:
 * one item per model of the cached app_list, the quick filter box and the
 * django-admin-interface foldable app sections.
 */
export default function NavSidebar({ open }) {
  const { appList, theme, session } = useAdmin();
  const location = useLocation();
  const [filter, setFilter] = useState(() => {
    try {
      return sessionStorage.getItem(FILTER_KEY) || '';
    } catch {
      return '';
    }
  });

  const onChange = (e) => {
    let value = e.target.value;
    if (e.key === 'Escape') {
      value = '';
    }
    setFilter(value);
    try {
      sessionStorage.setItem(FILTER_KEY, value.toLowerCase());
    } catch {
      /* ignore */
    }
  };

  const filterValue = (filter || '').toLowerCase();
  let matches = false;
  const sections = (appList || []).map((app) => {
    const models = (app.models || []).map((model) => {
      const visible = !filterValue || String(model.name || '').toLowerCase().indexOf(filterValue) !== -1;
      if (filterValue && visible) matches = true;
      return { model, visible };
    });
    return { app, models };
  });
  const noResults = !!filterValue && !matches;
  const siteHeader = theme.title || session.site_header || 'Django administration';
  const onIndex = location.pathname === '/admin/';

  return (
    <nav id="nav-sidebar" className={`md-nav-drawer md-app__drawer adm-drawer${open ? ' is-open' : ''}`} aria-label="Sidebar">
      <Link to="/admin/" className="md-nav-drawer__brand adm-drawer__brand">
        <img src={BRAND_LOGO} alt="" width="36" height="36" />
        <span>
          Pehchan
          {theme.title_visible !== false ? <small>{siteHeader}</small> : null}
        </span>
      </Link>

      <Link to="/admin/" className="md-nav-item adm-drawer__home" aria-current={onIndex ? 'page' : undefined}>
        <span className="md-icon" aria-hidden="true">
          space_dashboard
        </span>
        <span className="md-nav-item__label">Dashboard</span>
      </Link>

      <div className="md-nav-drawer__extra adm-nav-filter">
        <div className="md-search">
          <span className="md-icon" aria-hidden="true">
            filter_list
          </span>
          <input
            type="search"
            id="nav-filter"
            className={`md-input${noResults ? ' no-results' : ''}`}
            placeholder="Start typing to filter…"
            aria-label="Filter navigation items"
            aria-invalid={noResults ? 'true' : undefined}
            aria-describedby={noResults ? 'nav-filter-status' : undefined}
            value={filter}
            onChange={onChange}
            onKeyUp={(e) => {
              if (e.key === 'Escape') onChange(e);
            }}
          />
        </div>
        {noResults ? (
          <p id="nav-filter-status" className="adm-nav-filter__empty" role="status">
            No matching models
          </p>
        ) : null}
      </div>

      {appList ? (
        sections.map(({ app, models }) => (
          <NavSection key={app.app_label} app={app} models={models} filtering={!!filterValue} path={location.pathname} />
        ))
      ) : (
        <div className="adm-drawer__loading" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="md-skeleton adm-drawer__skel"></span>
          ))}
        </div>
      )}
    </nav>
  );
}

function NavSection({ app, models, filtering, path }) {
  const { foldable, collapsed, toggle } = useFoldableApp(app);
  if (filtering && !models.some((m) => m.visible)) return null;
  const currentApp = !!(app.app_url && path.includes(app.app_url));
  const listId = `nav-app-${app.app_label}`;
  const isCollapsed = collapsed && !filtering;

  return (
    <div className={`adm-nav-group app-${app.app_label} module${currentApp ? ' current-app' : ''}${isCollapsed ? ' is-collapsed collapsed' : ''}`}>
      <div className="md-nav-section adm-nav-group__header">
        <Link to={app.app_url} className="section" title={`Models in the ${app.name} application`}>
          {app.name}
        </Link>
        {foldable ? (
          <button
            type="button"
            className="adm-nav-group__toggle"
            aria-expanded={isCollapsed ? 'false' : 'true'}
            aria-controls={listId}
            aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${app.name}`}
            onClick={toggle}
          >
            <span className="md-icon adm-chevron" aria-hidden="true">
              expand_more
            </span>
          </button>
        ) : null}
      </div>
      <ul className="adm-nav-group__items" id={listId}>
        {models.map(({ model, visible }) => {
          const name = modelKey(model);
          const current = !!(model.admin_url && path.includes(model.admin_url));
          const labelId = `nav-${app.app_label}-${name}`;
          if (!visible) return null;
          return (
            <li key={name} className={`adm-nav-row model-${name}${current ? ' current-model' : ''}`}>
              {model.admin_url ? (
                <Link to={model.admin_url} className="md-nav-item" aria-current={current ? 'page' : undefined} title={model.name}>
                  <span className="md-icon" aria-hidden="true">
                    {modelIcon(app.app_label, name)}
                  </span>
                  <span className="md-nav-item__label" id={labelId}>
                    {model.name}
                  </span>
                </Link>
              ) : (
                <span className="md-nav-item adm-nav-row__static">
                  <span className="md-icon" aria-hidden="true">
                    {modelIcon(app.app_label, name)}
                  </span>
                  <span className="md-nav-item__label" id={labelId}>
                    {model.name}
                  </span>
                </span>
              )}
              {model.add_url ? (
                <Link to={model.add_url} className="addlink adm-nav-row__add" aria-label="Add" aria-describedby={labelId} title={`Add ${model.name}`}>
                  <span className="md-icon" aria-hidden="true">
                    add
                  </span>
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
