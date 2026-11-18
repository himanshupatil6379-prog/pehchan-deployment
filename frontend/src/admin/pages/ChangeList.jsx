import { Fragment, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiFetch, downloadResponse } from '../../api.js';
import { useMessages } from '../../context/MessagesContext.jsx';
import AdminLayout from '../AdminLayout.jsx';
import { useAdmin, useAdminPage, useReloadPage } from '../AdminContext.jsx';
import { ErrorList } from '../components/Nested.jsx';
import { DeleteSelectedConfirmation } from './DeleteConfirmation.jsx';
import { errorPageFor } from './Errors.jsx';
import { MONTHS, appVerboseName, capfirst, loginUrl, normalizeMessages, queryHref } from '../utils.js';
import { isStatusColumn, modelIcon, statusTone } from '../icons.js';

/** admin/change_list.html (django-admin-interface flavour) as an M3 data page. */
export default function ChangeListPage() {
  const { app, model } = useParams();
  const page = useAdminPage();
  const err = errorPageFor(page);
  if (err) return err;
  if (!page.data) {
    return <AdminLayout pending bodyClass={`app-${app} model-${model} change-list`} breadcrumbs={false} />;
  }
  return <ChangeListView key={page.version} data={page.data} app={app} model={model} />;
}

const MONTHS_AP = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

function BoolIcon({ value }) {
  const name = value === true ? 'yes' : value === false ? 'no' : 'unknown';
  const alt = value === true ? 'True' : value === false ? 'False' : 'None';
  const icon = value === true ? 'check_circle' : value === false ? 'cancel' : 'help';
  return (
    <span className={`adm-bool adm-bool--${name}`} role="img" aria-label={alt} title={alt}>
      <span className="md-icon" aria-hidden="true">
        {icon}
      </span>
    </span>
  );
}

/** Query string helpers (ChangeList.get_query_string). */
function currentParams(search) {
  const p = new URLSearchParams(search || '');
  p.delete('p');
  p.delete('e');
  return p;
}
function qs(params) {
  const s = params.toString();
  return `?${s}`;
}

export function ChangeListView({ data, app, model }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { appList, theme, setAdminUser, refreshAppList } = useAdmin();
  const { addMessages } = useMessages();
  const reload = useReloadPage();

  const m = data.model || { app_label: app, model, verbose_name: model, verbose_name_plural: `${model}s` };
  const columns = data.columns || [];
  const rows = data.rows || [];
  const actions = data.actions || [];
  const listEditable = data.list_editable || [];
  const filters = data.filters || [];
  const pagination = data.pagination || {};
  const resultCount = Number(data.result_count ?? rows.length);
  const fullResultCount = data.full_result_count;
  const query = data.query != null ? data.query : location.search.replace(/^\?/, '');
  const pathname = location.pathname;
  const href = (q) => queryHref(pathname, q);

  const [selected, setSelected] = useState(() => new Set());
  const [selectAcross, setSelectAcross] = useState(false);
  const [action, setAction] = useState('');
  const [edits, setEdits] = useState({});
  const [editChanged, setEditChanged] = useState(false);
  const [rowErrors, setRowErrors] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const lastChecked = useRef(null);

  const hasActions = actions.length > 0;
  const showAdminActions = hasActions && (!data.show_full_result_count || Number(fullResultCount) > 0);
  const appName = appVerboseName(appList, app);
  const plural = m.verbose_name_plural || model;
  const bodyClass = `app-${app} model-${model} change-list`;
  const breadcrumbs = [[appName, `/admin/${app}/`], [capfirst(plural)]];

  // ---------------------------------------------------------------- actions
  const actionUrl = `/api/admin/${app}/${model}/action/${query ? `?${query}` : ''}`;

  async function postAction(payload) {
    setBusy(true);
    const res = await apiFetch(actionUrl, { method: 'POST', data: payload });
    setBusy(false);
    if (res.status === 401 || (res.data && res.data.login_required)) {
      setAdminUser(null);
      navigate(loginUrl(location));
      return;
    }
    const ct = (res.response && res.response.headers.get('content-type')) || '';
    if (res.response && res.response.ok && !ct.includes('application/json')) {
      // export_as_csv / export_as_excel → file download, page stays as it is
      await downloadResponse(res.response, `${app}.${model}`);
      return;
    }
    const d = res.data || {};
    if (d.confirm) {
      setConfirm({ ...d.confirm, payload });
      window.scrollTo(0, 0);
      return;
    }
    if (d.messages && d.messages.length) addMessages(normalizeMessages(d.messages));
    refreshAppList();
    if (d.redirect) {
      if (/^https?:\/\//.test(d.redirect)) window.location.assign(d.redirect);
      else navigate(d.redirect);
      return;
    }
    // Django redirects to request.get_full_path() after running an action
    reload();
  }

  function runAction() {
    if (editChanged) {
      // eslint-disable-next-line no-alert
      const ok = window.confirm(
        'You have unsaved changes on individual editable fields. If you run an action, your unsaved changes will be lost.'
      );
      if (!ok) return;
    }
    const ids = rows.filter((r) => selected.has(String(r.id))).map((r) => r.id);
    postAction({ action, selected: ids, select_across: selectAcross });
  }

  // ---------------------------------------------------------- list_editable
  function editValue(row, cell) {
    const rowEdits = edits[String(row.id)];
    if (rowEdits && Object.prototype.hasOwnProperty.call(rowEdits, cell.field)) return rowEdits[cell.field];
    return cell.value;
  }
  function setEdit(row, field, value) {
    setEditChanged(true);
    setEdits((prev) => ({ ...prev, [String(row.id)]: { ...(prev[String(row.id)] || {}), [field]: value } }));
  }

  async function saveListEdit() {
    if (action) {
      const text = editChanged
        ? 'You have selected an action, but you haven’t saved your changes to individual fields yet. Please click OK to save. You’ll need to re-run the action.'
        : 'You have selected an action, and you haven’t made any changes on individual fields. You’re probably looking for the Go button rather than the Save button.';
      // eslint-disable-next-line no-alert
      if (!window.confirm(text)) return;
    }
    const payloadRows = [];
    rows.forEach((row) => {
      const rowEdits = edits[String(row.id)];
      if (!rowEdits) return;
      const values = {};
      let changed = false;
      row.cells.forEach((cell) => {
        if (cell && cell.type === 'editable') {
          const v = editValue(row, cell);
          values[cell.field] = v;
          if (v !== cell.value) changed = true;
        }
      });
      if (changed) payloadRows.push({ id: row.id, values });
    });
    setBusy(true);
    const res = await apiFetch(`/api/admin/${app}/${model}/list-edit/${query ? `?${query}` : ''}`, {
      method: 'POST',
      data: { rows: payloadRows },
    });
    setBusy(false);
    const d = res.data || {};
    if (res.status === 401 || d.login_required) {
      setAdminUser(null);
      navigate(loginUrl(location));
      return;
    }
    if (d.row_errors && Object.keys(d.row_errors).length) {
      setRowErrors(d.row_errors);
      const others = normalizeMessages(d.messages).filter((msg) => !/^Please correct the error/.test(msg.text || ''));
      if (others.length) addMessages(others);
      window.scrollTo(0, 0);
      return;
    }
    if (d.messages && d.messages.length) addMessages(normalizeMessages(d.messages));
    refreshAppList();
    if (d.redirect) navigate(d.redirect);
    else reload();
  }

  const onFormSubmit = (e) => {
    e.preventDefault();
    if (busy) return;
    const submitter = e.nativeEvent && e.nativeEvent.submitter;
    if (submitter && submitter.name === '_save') saveListEdit();
    else runAction();
  };

  // -------------------------------------------------------------- selection
  const selCount = rows.filter((r) => selected.has(String(r.id))).length;
  const allChecked = rows.length > 0 && selCount === rows.length;

  function toggleAll(checked) {
    setSelected(checked ? new Set(rows.map((r) => String(r.id))) : new Set());
    setSelectAcross(false);
  }
  function toggleRow(e, index) {
    const checked = e.target.checked;
    const shift = !!(e.nativeEvent && e.nativeEvent.shiftKey);
    let affected = [index];
    if (shift && lastChecked.current !== null && lastChecked.current !== index) {
      const start = Math.min(lastChecked.current, index);
      const end = Math.max(lastChecked.current, index);
      affected = [];
      for (let i = start; i <= end; i += 1) affected.push(i);
    }
    setSelected((prev) => {
      const next = new Set(prev);
      affected.forEach((i) => {
        const id = String(rows[i].id);
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
    setSelectAcross(false);
    lastChecked.current = index;
  }

  // ------------------------------------------------- filters / facets / dates
  const params = currentParams(location.search);
  // Django 5 facets ("Show counts" / "Hide counts"): only when the API describes them,
  // so an unknown `_facets` parameter is never sent to a backend that does not support it.
  const facets = data.facets || null;
  const facetsOptional = facets ? facets.optional !== false : false;
  const facetsOn = facets ? !!facets.active : new URLSearchParams(location.search).has('_facets');
  const addFacetQuery = facets && facets.add_query ? facets.add_query : (() => {
    const p = currentParams(location.search);
    p.set('_facets', 'True');
    return qs(p);
  })();
  const removeFacetQuery = facets && facets.remove_query ? facets.remove_query : (() => {
    const p = currentParams(location.search);
    p.delete('_facets');
    return qs(p);
  })();

  const dateField =
    (data.date_hierarchy && (data.date_hierarchy.field || data.date_hierarchy.field_name)) ||
    [...params.keys()].map((k) => /^(.+)__year$/.exec(k)).filter(Boolean).map((mm) => mm[1])[0] ||
    null;
  const activeDateHierarchy = dateField && params.has(`${dateField}__year`) ? dateField : null;

  const isFilterActive = (f) => {
    if (typeof f.active === 'boolean') return f.active;
    const choices = f.choices || [];
    return choices.length > 0 && !choices[0].selected && choices.some((c) => c.selected);
  };
  const removalQuery = (f) => f.removal_query || f.remove_query || ((f.choices || [])[0] || {}).query || '?';

  const rowErrorCount = rowErrors
    ? Object.values(rowErrors).reduce((n, errs) => n + Object.keys(errs || {}).length, 0)
    : 0;

  if (confirm) {
    return (
      <DeleteSelectedConfirmation
        confirm={confirm}
        model={m}
        app={app}
        appName={appName}
        busy={busy}
        onConfirm={() => postAction({ ...confirm.payload, post: 'yes' })}
        onCancel={() => setConfirm(null)}
      />
    );
  }

  const numSorted = columns.filter((c) => c.sort_priority).length;
  const addUrl = `/admin/${app}/${model}/add/${query ? `?_changelist_filters=${encodeURIComponent(query)}` : ''}`;
  const showResultCount = data.result_count !== data.full_result_count && data.full_result_count !== undefined;
  const search = data.search || { enabled: false };
  const dh = data.date_hierarchy;
  const hasDateNav = !!(dh && (dh.back || (dh.choices || []).length));
  const activeFilterCount = filters.filter(isFilterActive).length + (activeDateHierarchy ? 1 : 0);
  const narrowed = !!(search.q || data.has_active_filters || activeDateHierarchy);
  const hasToolbar = search.enabled || hasDateNav || filters.length > 0;

  const headerActions = m.has_add ? (
    <ul className="object-tools adm-object-tools">
      <li>
        <Link to={addUrl} className="addlink md-btn md-btn--filled">
          <span className="md-icon" aria-hidden="true">
            add
          </span>
          Add {m.verbose_name}
        </Link>
      </li>
    </ul>
  ) : null;

  return (
    <AdminLayout
      title={data.title}
      heading={capfirst(plural)}
      overline={appName}
      subtitle={data.title}
      docTitle={rowErrorCount ? `Error: ${data.title} | ${theme.title || 'Django administration'}` : undefined}
      bodyClass={bodyClass}
      breadcrumbs={breadcrumbs}
      actions={headerActions}
    >
      <div id="content-main">
        {rowErrorCount ? (
          <div className="md-alert md-alert--error adm-errornote" role="alert">
            <span className="md-icon" aria-hidden="true">
              error
            </span>
            <p className="errornote md-alert__body">
              {rowErrorCount === 1 ? 'Please correct the error below.' : 'Please correct the errors below.'}
            </p>
          </div>
        ) : null}
        <div className={`module adm-cl${filters.length ? ' filtered has-filters' : ''}${hasToolbar && !search.enabled && !hasDateNav ? ' adm-cl--compact-toolbar' : ''}`} id="changelist">
          {hasToolbar ? (
            <div className={`md-card adm-toolbar${!search.enabled && !hasDateNav ? ' adm-toolbar--toggle-only' : ''}`}>
              <div className="adm-toolbar__row">
                {search.enabled ? (
                  <SearchForm
                    q={search.q || ''}
                    pathname={pathname}
                    search={location.search}
                    placeholder={`Search ${plural}`}
                    showResultCount={showResultCount}
                    resultCount={resultCount}
                    fullResultCount={fullResultCount}
                    showFullResultCount={data.show_full_result_count}
                    helpText={search.help_text}
                  />
                ) : (
                  <p className="adm-toolbar__count">
                    {resultCount} {resultCount === 1 ? m.verbose_name : plural}
                  </p>
                )}
                {filters.length ? (
                  <button
                    type="button"
                    className={`md-btn md-btn--outlined adm-filters-toggle${filtersOpen ? ' is-open' : ''}`}
                    aria-expanded={filtersOpen ? 'true' : 'false'}
                    aria-controls="changelist-filter"
                    onClick={() => setFiltersOpen((o) => !o)}
                  >
                    <span className="md-icon" aria-hidden="true">
                      filter_list
                    </span>
                    Filters
                    {activeFilterCount ? (
                      <span className="md-badge adm-filters-toggle__badge" aria-label={`${activeFilterCount} active`}>
                        {activeFilterCount}
                      </span>
                    ) : null}
                  </button>
                ) : null}
              </div>
              {hasDateNav ? <DateHierarchy dh={dh} href={href} /> : null}
            </div>
          ) : null}

          {filters.length ? (
            <nav
              id="changelist-filter"
              className={`md-card adm-filters${filtersOpen ? ' is-open' : ''}${theme.list_filter_sticky ? ' is-sticky' : ''}${
                theme.list_filter_highlight ? ' adm-filters--highlight' : ''
              }`}
              aria-labelledby="changelist-filter-header"
            >
              <div className="adm-filters__head">
                <span className="md-icon" aria-hidden="true">
                  tune
                </span>
                <h2 id="changelist-filter-header" className="adm-filters__title">
                  Filter
                </h2>
                <button type="button" className="md-icon-btn adm-filters__close" aria-label="Close filters" onClick={() => setFiltersOpen(false)}>
                  <span className="md-icon" aria-hidden="true">
                    close
                  </span>
                </button>
              </div>
              {facetsOptional || data.has_active_filters ? (
                <div id="changelist-filter-extra-actions" className="adm-filters__extra">
                  {facetsOptional ? (
                    facetsOn ? (
                      <Link to={href(removeFacetQuery)} className="hidelink md-btn md-btn--text md-btn--sm">
                        <span className="md-icon" aria-hidden="true">
                          visibility_off
                        </span>
                        Hide counts
                      </Link>
                    ) : (
                      <Link to={href(addFacetQuery)} className="viewlink md-btn md-btn--text md-btn--sm">
                        <span className="md-icon" aria-hidden="true">
                          visibility
                        </span>
                        Show counts
                      </Link>
                    )
                  ) : null}
                  {theme.list_filter_removal_links ? (
                    data.has_active_filters || activeDateHierarchy ? (
                      <div className="changelist-filter-clear-container adm-filters__active">
                        <Link id="changelist-filter-clear" to={href(data.clear_all_filters_query || '?')} className="md-btn md-btn--tonal md-btn--sm">
                          <span className="md-icon" aria-hidden="true">
                            filter_alt_off
                          </span>
                          Clear all filters
                        </Link>
                        <div className="adm-chip-row">
                          {activeDateHierarchy ? <DateHierarchyRemoval field={dateField} params={params} href={href} data={data} /> : null}
                          {data.has_active_filters
                            ? filters.map((f, i) =>
                                isFilterActive(f) ? (
                                  <Link
                                    key={i}
                                    to={href(removalQuery(f))}
                                    className="changelist-filter-clear md-chip adm-input-chip"
                                    title={`Remove filter ${capfirst(f.title)}`}
                                  >
                                    <span className="adm-input-chip__text">
                                      {capfirst(f.title)}: <strong>{((f.choices || []).find((c) => c.selected) || {}).display || '...'}</strong>
                                    </span>
                                    <span className="md-icon" aria-hidden="true">
                                      close
                                    </span>
                                  </Link>
                                ) : null
                              )
                            : null}
                        </div>
                      </div>
                    ) : null
                  ) : data.has_active_filters ? (
                    <Link to={href(data.clear_all_filters_query || '?')} className="md-btn md-btn--tonal md-btn--sm">
                      <span className="md-icon" aria-hidden="true">
                        filter_alt_off
                      </span>
                      Clear all filters
                    </Link>
                  ) : null}
                </div>
              ) : null}
              <div className="adm-filters__groups">
                {filters.map((f, i) =>
                  theme.list_filter_dropdown ? (
                    <DropdownFilter key={i} index={i} filter={f} active={isFilterActive(f)} href={href} />
                  ) : (
                    <DetailsFilter key={i} filter={f} active={isFilterActive(f)} href={href} />
                  )
                )}
              </div>
            </nav>
          ) : null}

          <form id="changelist-form" className="md-card adm-results" method="post" noValidate onSubmit={onFormSubmit} aria-busy={busy ? 'true' : undefined}>
            {showAdminActions ? (
              <div className={`actions adm-actions${selCount || selectAcross ? ' is-active' : ''}`} role="group" aria-label="Bulk actions">
                <label className="adm-actions__field">
                  <span className="adm-actions__label">Action</span>
                  <select name="action" required value={action} onChange={(e) => setAction(e.target.value)} className="md-select adm-input--dense">
                    <option value="">---------</option>
                    {actions.map((a) => (
                      <option key={a.name} value={a.name}>
                        {a.description}
                      </option>
                    ))}
                  </select>
                </label>
                <input type="hidden" name="select_across" value={selectAcross ? '1' : '0'} className="select-across" />
                <button type="submit" className="button md-btn md-btn--filled md-btn--sm adm-actions__go" title="Run the selected action" name="index" value="0">
                  Go
                </button>
                <span className={`action-counter adm-actions__counter${selectAcross ? ' hidden' : ''}`} data-actions-icnt={rows.length} aria-live="polite">
                  {`${selCount} of ${rows.length} selected`}
                </span>
                {resultCount !== rows.length ? (
                  <>
                    <span className={`all adm-actions__counter adm-actions__counter--all${selectAcross ? '' : ' hidden'}`} aria-live="polite">
                      {`All ${resultCount} selected`}
                    </span>
                    <span className={`question${allChecked && !selectAcross ? '' : ' hidden'}`}>
                      <button
                        type="button"
                        className="md-btn md-btn--text md-btn--sm"
                        title="Click here to select the objects across all pages"
                        onClick={() => setSelectAcross(true)}
                      >
                        {`Select all ${resultCount} ${plural}`}
                      </button>
                    </span>
                    <span className={`clear${selectAcross ? '' : ' hidden'}`}>
                      <button type="button" className="md-btn md-btn--text md-btn--sm" onClick={() => toggleAll(false)}>
                        Clear selection
                      </button>
                    </span>
                  </>
                ) : null}
              </div>
            ) : null}

            {rows.length ? (
              <div className="results md-table-wrap adm-table-wrap">
                <table id="result_list" className="md-table adm-table">
                  <thead>
                    <tr>
                      {hasActions ? (
                        <th scope="col" className="action-checkbox-column">
                          <input
                            type="checkbox"
                            id="action-toggle"
                            aria-label="Select all objects on this page for an action"
                            checked={allChecked}
                            onChange={(e) => toggleAll(e.target.checked)}
                          />
                        </th>
                      ) : null}
                      {columns.map((col) => (
                        <HeaderCell key={col.key} col={col} numSorted={numSorted} href={href} />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => {
                      const id = String(row.id);
                      const isSel = selected.has(id);
                      const errs = rowErrors ? rowErrors[id] : null;
                      return (
                        <Fragment key={id}>
                          {errs && errs.__all__ ? (
                            <tr className="adm-row-errors">
                              <td colSpan={(row.cells || []).length + (hasActions ? 1 : 0)}>
                                <ErrorList errors={errs.__all__} className="errorlist nonfield" />
                              </td>
                            </tr>
                          ) : null}
                          <tr className={isSel ? 'selected is-selected' : undefined}>
                            {hasActions ? (
                              <td className="action-checkbox">
                                <input
                                  type="checkbox"
                                  name="_selected_action"
                                  value={id}
                                  className="action-select"
                                  aria-label={`Select this object for an action - ${rowLabel(row)}`}
                                  checked={isSel}
                                  onChange={(e) => toggleRow(e, index)}
                                />
                              </td>
                            ) : null}
                            {(row.cells || []).map((cell, ci) => (
                              <ResultCell
                                key={ci}
                                cell={cell}
                                col={columns[ci]}
                                first={ci === 0}
                                row={row}
                                rowIndex={index}
                                errors={errs}
                                value={cell && cell.type === 'editable' ? editValue(row, cell) : undefined}
                                onEdit={setEdit}
                              />
                            ))}
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="md-empty adm-cl-empty">
                <span className="md-icon" aria-hidden="true">
                  {narrowed ? 'search_off' : modelIcon(app, model)}
                </span>
                <p className="md-empty__title">{`No ${plural} found`}</p>
                <p className="md-empty__text">
                  {narrowed ? 'Try a different search term or clear the active filters.' : `There are no ${plural} to display yet.`}
                </p>
              </div>
            )}

            <div className={`changelist-footer adm-cl-footer${theme.form_pagination_sticky && rows.length ? ' is-sticky' : ''}`}>
              <p className="adm-cl-footer__count">
                {resultCount} {resultCount === 1 ? m.verbose_name : plural}
              </p>
              {(!pagination.show_all || !pagination.can_show_all) && pagination.multi_page ? (
                <nav className="paginator adm-paginator" aria-label="Pagination">
                  {(pagination.pages || []).map((p, i) => {
                    if (p.ellipsis)
                      return (
                        <span key={`e${i}`} className="adm-paginator__gap" aria-hidden="true">
                          …
                        </span>
                      );
                    if (p.current)
                      return (
                        <span key={p.number} className="this-page" aria-current="page">
                          {p.number}
                        </span>
                      );
                    return (
                      <Link
                        key={p.number}
                        to={href(p.query)}
                        className={p.number === pagination.num_pages ? 'end' : undefined}
                        aria-label={`Page ${p.number}`}
                      >
                        {p.number}
                      </Link>
                    );
                  })}
                </nav>
              ) : null}
              {pagination.can_show_all && !pagination.show_all && pagination.multi_page ? (
                <Link to={href(pagination.show_all_query || '?all=')} className="showall md-btn md-btn--text md-btn--sm">
                  <span className="md-icon" aria-hidden="true">
                    unfold_more
                  </span>
                  Show all
                </Link>
              ) : null}
              {listEditable.length && resultCount ? (
                <button type="submit" name="_save" className="default md-btn md-btn--filled adm-cl-footer__save" value="Save">
                  <span className="md-icon" aria-hidden="true">
                    save
                  </span>
                  Save
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
}

function rowLabel(row) {
  const first = (row.cells || [])[0];
  if (!first) return String(row.id);
  if (first.type === 'text') return first.text;
  if (first.type === 'link') return first.text;
  if (first.type === 'html') return String(first.html || '').replace(/<[^>]*>/g, '');
  return String(row.id);
}

/** <th> of result_headers – sortable link + sort direction / priority / remove / toggle. */
function HeaderCell({ col, numSorted, href }) {
  const classes = col.sortable
    ? ['sortable', `column-${col.key}`, ...(col.sorted ? ['sorted', col.sorted] : [])]
    : [`column-${col.key}`];
  const sortedNow = !!(col.sortable && col.sort_priority > 0);
  const ascending = col.sorted === 'ascending';
  return (
    <th scope="col" className={classes.join(' ')} aria-sort={sortedNow && col.sorted ? (ascending ? 'ascending' : 'descending') : undefined}>
      <div className="adm-th">
        <div className="text adm-th__text">
          {col.sortable ? (
            <Link to={href(col.sort_query)} className="adm-th__sort">
              {capfirst(col.label)}
              {!sortedNow ? (
                <span className="md-icon adm-th__hint" aria-hidden="true">
                  unfold_more
                </span>
              ) : null}
            </Link>
          ) : (
            <span>{capfirst(col.label)}</span>
          )}
        </div>
        {sortedNow ? (
          <div className="sortoptions adm-th__opts">
            {numSorted > 1 ? (
              <span className="sortpriority adm-th__prio" title={`Sorting priority: ${col.sort_priority}`}>
                {col.sort_priority}
              </span>
            ) : null}
            <Link
              to={href(col.toggle_query)}
              className={`toggle ${ascending ? 'ascending' : 'descending'}`}
              title="Toggle sorting"
              aria-label={`Toggle sorting (${ascending ? 'ascending' : 'descending'})`}
            >
              <span className="md-icon" aria-hidden="true">
                {ascending ? 'arrow_upward' : 'arrow_downward'}
              </span>
            </Link>
            <Link className="sortremove" to={href(col.remove_query)} title="Remove from sorting" aria-label="Remove from sorting">
              <span className="md-icon" aria-hidden="true">
                close
              </span>
            </Link>
          </div>
        ) : null}
      </div>
    </th>
  );
}

/** items_for_result() */
function ResultCell({ cell, col, first, row, rowIndex, errors, value, onEdit }) {
  const key = (col && col.key) || (cell && cell.field) || '';
  const classes = [`field-${key}`];
  if ((cell && cell.nowrap) || (col && col.nowrap)) classes.push('nowrap');
  const Tag = first ? 'th' : 'td';
  if (!cell) return <Tag className={classes.join(' ')}>{' '}</Tag>;

  if (cell.type === 'editable') {
    const name = `form-${rowIndex}-${cell.field}`;
    const errs = errors ? errors[cell.field] : null;
    const label = capfirst((col && col.label) || cell.field);
    return (
      <Tag className={`field-${cell.field} adm-cell--edit${errs && errs.length ? ' errors' : ''}`}>
        {errs && errs.length ? <ErrorList errors={errs} /> : null}
        {cell.input === 'checkbox' ? (
          <input
            type="checkbox"
            name={name}
            id={`id_${name}`}
            checked={!!value}
            aria-label={label}
            onChange={(e) => onEdit(row, cell.field, e.target.checked)}
          />
        ) : cell.input === 'select' ? (
          <select
            name={name}
            id={`id_${name}`}
            className="md-select adm-input--dense"
            aria-label={label}
            aria-invalid={errs && errs.length ? 'true' : undefined}
            value={value == null ? '' : String(value)}
            onChange={(e) => onEdit(row, cell.field, e.target.value)}
          >
            {(cell.choices || []).map(([v, optLabel]) => (
              <option key={String(v)} value={v == null ? '' : String(v)}>
                {optLabel}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            name={name}
            id={`id_${name}`}
            className="vTextField md-input adm-input--dense"
            aria-label={label}
            aria-invalid={errs && errs.length ? 'true' : undefined}
            value={value == null ? '' : String(value)}
            onChange={(e) => onEdit(row, cell.field, e.target.value)}
          />
        )}
      </Tag>
    );
  }

  if (cell.type === 'html') {
    classes.push('adm-cell--html');
    if (first) {
      return (
        <Tag className={classes.join(' ')}>
          <a href={row.change_url} className="adm-row-link" dangerouslySetInnerHTML={{ __html: cell.html }} />
        </Tag>
      );
    }
    return <Tag className={classes.join(' ')} dangerouslySetInnerHTML={{ __html: cell.html }} />;
  }

  let content;
  if (cell.type === 'bool') {
    classes.push('adm-cell--bool');
    content = <BoolIcon value={cell.value} />;
  } else if (cell.type === 'link') {
    content = (
      <a className={['adm-cell-link', cell.className].filter(Boolean).join(' ')} href={cell.href} target={cell.target || undefined}>
        {cell.text}
        {cell.target === '_blank' ? (
          <span className="md-icon" aria-hidden="true">
            open_in_new
          </span>
        ) : null}
      </a>
    );
  } else {
    const text = cell.text;
    const empty = text === ' ' || text === '' || text == null;
    const tone = !first && !empty && isStatusColumn(col) ? statusTone(text) : null;
    if (empty) content = ' ';
    else if (text === '-' && !first) {
      content = (
        <span className="adm-cell-empty" title="Empty">
          -
        </span>
      );
    } else if (tone) {
      content = <span className={`md-chip md-chip--${tone} adm-status`}>{text}</span>;
    } else {
      content = text;
      if (String(text).length > 32) classes.push('adm-cell--long');
    }
  }

  if (first) {
    return (
      <Tag className={classes.join(' ')} scope="row">
        <a href={row.change_url} className="adm-row-link">
          {content}
        </a>
      </Tag>
    );
  }
  return <Tag className={classes.join(' ')}>{content}</Tag>;
}

/** admin/search_form.html as a pill search field. */
function SearchForm({ q, pathname, search, placeholder, showResultCount, resultCount, fullResultCount, showFullResultCount, helpText }) {
  const navigate = useNavigate();
  const hidden = useMemo(() => {
    const p = currentParams(search);
    p.delete('q');
    return [...p.entries()];
  }, [search]);

  const onSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const p = new URLSearchParams();
    for (const [k, v] of fd.entries()) p.append(k, v);
    navigate(`${pathname}?${p.toString()}`);
  };

  return (
    <div id="toolbar" className="adm-search">
      <form id="changelist-search" method="get" onSubmit={onSubmit} role="search">
        <div className="adm-search__row">
          <div className="md-search adm-search__field">
            <label htmlFor="searchbar" className="adm-search__icon">
              <span className="md-icon" aria-hidden="true">
                search
              </span>
              <span className="md-visually-hidden">Search</span>
            </label>
            <input
              type="text"
              size="40"
              name="q"
              defaultValue={q}
              id="searchbar"
              className="md-input"
              placeholder={placeholder}
              aria-describedby={helpText ? 'searchbar_helptext' : undefined}
            />
          </div>
          <button type="submit" className="md-btn md-btn--tonal adm-search__submit" value="Search">
            Search
          </button>
          {hidden.map(([k, v], i) => (
            <input key={`${k}-${i}`} type="hidden" name={k} value={v} />
          ))}
        </div>
        {showResultCount ? (
          <p className="small quiet adm-search__count">
            {resultCount} {resultCount === 1 ? 'result' : 'results'} (
            <Link to={pathname}>{showFullResultCount ? `${fullResultCount} total` : 'Show all'}</Link>)
          </p>
        ) : null}
        {helpText ? (
          <div className="help md-field__helper adm-search__help" id="searchbar_helptext">
            {helpText}
          </div>
        ) : null}
      </form>
    </div>
  );
}

/** admin/date_hierarchy.html as filter chips. */
function DateHierarchy({ dh, href }) {
  const choices = dh.choices || [];
  if (!dh.back && !choices.length) return null;
  return (
    <nav className="toplinks adm-date-nav" aria-label="Date hierarchy">
      <span className="md-icon adm-date-nav__icon" aria-hidden="true">
        calendar_month
      </span>
      {dh.back ? (
        <Link to={href(dh.back.query)} className="date-back md-chip adm-date-nav__back">
          <span className="md-icon" aria-hidden="true">
            arrow_back
          </span>
          {String(dh.back.label || '').replace(/^‹\s*/, '')}
        </Link>
      ) : null}
      {choices.map((c, i) =>
        c.query != null ? (
          <Link key={i} to={href(c.query)} className="md-chip">
            {c.label}
          </Link>
        ) : (
          <span key={i} className="md-chip is-selected" aria-current="true">
            {c.label}
          </span>
        )
      )}
    </nav>
  );
}

/** admin_interface/date_hierarchy_removal_link.html */
function DateHierarchyRemoval({ field, params, href, data }) {
  const dh = data.date_hierarchy || {};
  const label = dh.label || dh.field_label || field.split('__').map((s) => s.replace(/_/g, ' ')).join(' ').toLowerCase();
  const year = params.get(`${field}__year`);
  const month = params.get(`${field}__month`);
  const day = params.get(`${field}__day`);
  let value = year;
  if (year && month) {
    value = day ? `${MONTHS_AP[Number(month) - 1] || month} ${Number(day)}, ${year}` : `${MONTHS[Number(month) - 1] || month} ${year}`;
  }
  const p = new URLSearchParams(params.toString());
  [...p.keys()].filter((k) => k.startsWith(field)).forEach((k) => p.delete(k));
  return (
    <Link to={href(qs(p))} className="changelist-filter-clear md-chip adm-input-chip" title={`Remove filter ${capfirst(label)}`}>
      <span className="adm-input-chip__text">
        {capfirst(label)}: <strong>{capfirst(value)}</strong>
      </span>
      <span className="md-icon" aria-hidden="true">
        close
      </span>
    </Link>
  );
}

/** admin_interface/dropdown_filter.html */
function DropdownFilter({ filter, index, active, href }) {
  const navigate = useNavigate();
  const choices = filter.choices || [];
  const selectedChoice = choices.find((c) => c.selected);
  const id = `changelist-filter-${index}`;
  return (
    <div className={`list-filter-dropdown adm-filter${active ? ' is-active' : ''}`}>
      <label htmlFor={id} className={`adm-filter__label${active ? ' active' : ''}`}>
        {`By ${filter.title}`}
      </label>
      <select
        id={id}
        className="md-select adm-input--dense"
        value={selectedChoice ? selectedChoice.query : ''}
        onChange={(e) => {
          if (e.target.value) navigate(href(e.target.value));
        }}
      >
        {choices.map((c, i) => (
          <option key={i} value={c.query}>
            {c.display}
          </option>
        ))}
      </select>
    </div>
  );
}

/** admin_interface/templates/admin/filter.html (non-dropdown variant) */
function DetailsFilter({ filter, active, href }) {
  const key = 'django.admin.filtersState';
  const initialOpen = (() => {
    try {
      const state = JSON.parse(sessionStorage.getItem(key)) || {};
      return Object.prototype.hasOwnProperty.call(state, filter.title) ? !!state[filter.title] : true;
    } catch {
      return true;
    }
  })();
  const onToggle = (e) => {
    try {
      const state = JSON.parse(sessionStorage.getItem(key)) || {};
      state[filter.title] = e.currentTarget.open;
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  };
  return (
    <details className={`adm-filter adm-filter--list${active ? ' is-active' : ''}`} data-filter-title={filter.title} open={initialOpen} onToggle={onToggle}>
      <summary className={`adm-filter__label${active ? ' active' : ''}`}>
        <span>{`By ${filter.title}`}</span>
        <span className="md-icon adm-chevron" aria-hidden="true">
          expand_more
        </span>
      </summary>
      <ul className={`adm-filter__choices${active ? ' active' : ''}`}>
        {(filter.choices || []).map((c, i) => (
          <li key={i} className={c.selected ? 'selected' : undefined}>
            <Link to={href(c.query)} className="adm-filter__choice" aria-current={c.selected ? 'true' : undefined}>
              <span className="md-icon" aria-hidden="true">
                {c.selected ? 'check' : ''}
              </span>
              <span className="adm-filter__choice-text">{c.display}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
