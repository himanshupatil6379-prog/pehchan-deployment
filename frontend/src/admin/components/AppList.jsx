import { useCallback, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAdmin } from '../AdminContext.jsx';
import { appIcon, modelIcon, modelKey } from '../icons.js';

function storageKey(app) {
  return `admin-interface.foldable-apps_app-${app.app_label}_collapsed`;
}

/**
 * django-admin-interface foldable-apps.js: collapsed state per app in
 * localStorage (shared by the dashboard modules and the navigation drawer).
 */
export function useFoldableApp(app) {
  const { theme } = useAdmin();
  const foldable = !!theme.foldable_apps;
  const [collapsed, setCollapsed] = useState(() => {
    if (!foldable) return false;
    try {
      return Boolean(parseInt(localStorage.getItem(storageKey(app)) || 0, 10) || 0);
    } catch {
      return false;
    }
  });
  const toggle = useCallback(() => {
    if (!foldable) return;
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(storageKey(app), next ? 1 : 0);
      } catch {
        /* ignore */
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foldable, app.app_label]);
  return { foldable, collapsed: foldable && collapsed, toggle };
}

/** admin/app_list.html (Django 5) as M3 module cards. */
export default function AppList({ appList, showChangeLinks = false }) {
  if (!appList || !appList.length) {
    return (
      <div className="md-card adm-module">
        <div className="md-empty">
          <span className="md-icon" aria-hidden="true">
            lock
          </span>
          <p className="md-empty__text">You don’t have permission to view or edit anything.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="adm-modules">
      {appList.map((app) => (
        <AppModule key={app.app_label} app={app} showChangeLinks={showChangeLinks} />
      ))}
    </div>
  );
}

function AppModule({ app, showChangeLinks }) {
  const location = useLocation();
  const path = location.pathname;
  const { foldable, collapsed, toggle } = useFoldableApp(app);
  const models = app.models || [];
  const currentApp = !!(app.app_url && path.includes(app.app_url));
  const headingId = `app-${app.app_label}-heading`;
  const listId = `app-${app.app_label}-models`;
  const className = [
    'md-card',
    'adm-module',
    `app-${app.app_label}`,
    'module',
    currentApp ? 'current-app' : '',
    collapsed ? 'collapsed' : '',
    foldable ? 'foldable-apps-ready' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={className} aria-labelledby={headingId}>
      <div className="md-card__header adm-module__header">
        <span className="md-card__icon" aria-hidden="true">
          <span className="md-icon">{appIcon(app.app_label)}</span>
        </span>
        <div className="adm-module__titles">
          <h2 className="md-card__title" id={headingId}>
            <Link to={app.app_url} className="section" title={`Models in the ${app.name} application`}>
              {app.name}
            </Link>
          </h2>
          <p className="md-card__subtitle">
            {models.length} {models.length === 1 ? 'model' : 'models'}
          </p>
        </div>
        {foldable ? (
          <div className="md-card__header-actions">
            <button
              type="button"
              className="md-icon-btn adm-module__fold"
              aria-expanded={collapsed ? 'false' : 'true'}
              aria-controls={listId}
              aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${app.name}`}
              onClick={toggle}
            >
              <span className="md-icon adm-chevron" aria-hidden="true">
                expand_more
              </span>
            </button>
          </div>
        ) : null}
      </div>
      <ul className="adm-model-grid" id={listId} hidden={collapsed}>
        {models.map((model) => {
          const modelName = modelKey(model);
          const current = !!(model.admin_url && path.includes(model.admin_url));
          const rowId = `${app.app_label}-${modelName}`;
          return (
            <li key={modelName} className={`adm-model-row model-${modelName}${current ? ' current-model' : ''}`}>
              <span className="adm-model-row__icon" aria-hidden="true">
                <span className="md-icon">{modelIcon(app.app_label, modelName)}</span>
              </span>
              <span className="adm-model-row__name" id={rowId}>
                {model.admin_url ? (
                  <Link to={model.admin_url} aria-current={current ? 'page' : undefined} title={model.name}>
                    {model.name}
                  </Link>
                ) : (
                  model.name
                )}
              </span>
              <span className="adm-model-row__actions">
                {model.add_url ? (
                  <Link to={model.add_url} className="addlink md-btn md-btn--tonal md-btn--sm" aria-describedby={rowId}>
                    <span className="md-icon" aria-hidden="true">
                      add
                    </span>
                    Add
                  </Link>
                ) : null}
                {model.admin_url && showChangeLinks ? (
                  model.view_only ? (
                    <Link to={model.admin_url} className="viewlink md-btn md-btn--text md-btn--sm" aria-describedby={rowId}>
                      <span className="md-icon" aria-hidden="true">
                        visibility
                      </span>
                      View
                    </Link>
                  ) : (
                    <Link to={model.admin_url} className="changelink md-btn md-btn--text md-btn--sm" aria-describedby={rowId}>
                      <span className="md-icon" aria-hidden="true">
                        edit
                      </span>
                      Change
                    </Link>
                  )
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
