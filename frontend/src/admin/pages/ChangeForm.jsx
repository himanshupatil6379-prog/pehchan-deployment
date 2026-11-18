import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { apiFetch } from '../../api.js';
import AdminLayout from '../AdminLayout.jsx';
import { useAdmin, useAdminPage, useAdminRequest, useReloadPage } from '../AdminContext.jsx';
import Fieldset from '../components/Fieldset.jsx';
import { ErrorList } from '../components/Nested.jsx';
import { RelatedModal, relatedInfo } from '../widgets/RelatedWidget.jsx';
import { errorPageFor } from './Errors.jsx';
import {
  apiPathFor,
  appVerboseName,
  capfirst,
  formDataWithSubmitter,
  submitterOf,
  truncatewords,
  withPreservedFilters,
} from '../utils.js';

/** admin/change_form.html – add / change / view pages (M3 cards + sticky action bar). */
export default function ChangeFormPage({ add = false }) {
  const { app, model } = useParams();
  const page = useAdminPage();
  const err = errorPageFor(page);
  if (err) return err;
  if (!page.data) {
    return <AdminLayout pending bodyClass={`app-${app} model-${model} change-form`} breadcrumbs={false} />;
  }
  return <ChangeFormView key={page.version} data={page.data} app={app} model={model} add={add} />;
}

/** Capture the current values of a form (used to restore inputs that re-mount). */
function snapshotForm(form) {
  const snap = [];
  if (!form) return snap;
  Array.from(form.elements).forEach((el) => {
    if (!el.name || el.type === 'file' || el.type === 'submit' || el.type === 'button') return;
    if (el.type === 'checkbox' || el.type === 'radio') snap.push({ name: el.name, value: el.value, checked: el.checked, kind: el.type });
    else if (el.tagName === 'SELECT' && el.multiple) snap.push({ name: el.name, values: Array.from(el.selectedOptions).map((o) => o.value), kind: 'multi' });
    else snap.push({ name: el.name, value: el.value, kind: el.tagName === 'SELECT' ? 'select' : 'text' });
  });
  return snap;
}

function restoreForm(form, snap) {
  if (!form || !snap) return;
  snap.forEach((s) => {
    const els = Array.from(form.elements).filter((el) => el.name === s.name);
    els.forEach((el) => {
      if (s.kind === 'checkbox') el.checked = s.checked;
      else if (s.kind === 'radio') {
        if (el.value === s.value) el.checked = s.checked;
      } else if (s.kind === 'multi') {
        Array.from(el.options).forEach((o) => {
          o.selected = s.values.includes(o.value);
        });
      } else if (el.value !== s.value) {
        el.value = s.value;
        if (s.kind === 'select') el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });
}

export function ChangeFormView({ data, app, model, add }) {
  const location = useLocation();
  const request = useAdminRequest();
  const reload = useReloadPage();
  const { appList, theme, isPopup } = useAdmin();
  const formRef = useRef(null);
  const snapshotRef = useRef(null);
  const [errors, setErrors] = useState(null);
  const [busy, setBusy] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [modal, setModal] = useState(null);

  const m = data.model || { app_label: app, model, verbose_name: model, verbose_name_plural: `${model}s` };
  const fieldsets = data.fieldsets || [];
  const allFields = fieldsets.flatMap((fs) => fs.fields || []);
  const hasFileField = allFields.some((f) => !f.readonly && (f.type === 'file' || f.type === 'image'));
  const viewOnly = !!data.view_only;
  const isContactMessage = app === 'pehchan' && model === 'contactmessage';
  const isUserAdd = add && app === 'auth' && model === 'user';
  const appName = appVerboseName(appList, app);
  const objectRepr = data.object_repr || '';
  const errorCount = errors ? Object.keys(errors).length : 0;
  const siteTitle = theme.title || 'Django administration';

  // inputs inside a fieldset that stops being collapsible re-mount → restore the user's values
  useLayoutEffect(() => {
    if (snapshotRef.current) {
      restoreForm(formRef.current, snapshotRef.current);
      snapshotRef.current = null;
    }
  }, [errors]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy || viewOnly) return;
    const form = e.currentTarget;
    const submitter = submitterOf(e, form);
    const fd = formDataWithSubmitter(form, submitter);
    setBusy(true);
    const res = await request(apiPathFor(location), { method: 'POST', formData: fd });
    if (res.redirected || res.handled) return;
    setBusy(false);
    if (res.ok) {
      reload();
      return;
    }
    const d = res.data || {};
    snapshotRef.current = snapshotForm(form);
    setErrors(d.errors && Object.keys(d.errors).length ? d.errors : { __all__: ['Please correct the errors below.'] });
    window.scrollTo(0, 0);
  };

  // ---- related-object modal (django-admin-interface related_modal_active) ----
  const relatedFor = useCallback((field) => (field.type === 'fk' && !field.readonly ? relatedInfo(field, appList) : null), [appList]);

  const onOpenModal = useCallback(
    (link) => {
      if (theme.related_modal_active) {
        setModal(link);
        return;
      }
      // RelatedObjectLookups.showRelatedObjectPopup()
      const url = new URL(link.href, window.location.origin);
      url.searchParams.set('_popup', '1');
      const win = window.open(`${url.pathname}${url.search}`, link.name, 'height=768,width=1024,resizable=yes,scrollbars=yes');
      if (win) win.focus();
    },
    [theme.related_modal_active]
  );

  const refreshRelated = useCallback(
    async (linkName) => {
      const fieldName = String(linkName || '').replace(/^(change|add|delete|view|lookup)_id_/, '');
      const res = await apiFetch(apiPathFor(location));
      if (!res.ok || !res.data) return;
      const fresh = (res.data.fieldsets || []).flatMap((fs) => fs.fields || []).find((f) => f.name === fieldName);
      if (!fresh || !fresh.choices) return;
      const form = formRef.current;
      const el = form && form.elements[fieldName];
      const currentValue = el ? el.value : '';
      setOverrides((prev) => {
        const oldField = allFields.find((f) => f.name === fieldName);
        const oldChoices = (prev[fieldName] && prev[fieldName].choices) || (oldField && oldField.choices) || [];
        const oldIds = new Set(oldChoices.map(([v]) => String(v)));
        let value = currentValue;
        if (String(linkName).startsWith('add_')) {
          const added = fresh.choices.find(([v]) => v !== '' && v != null && !oldIds.has(String(v)));
          if (added) value = String(added[0]);
        }
        if (!fresh.choices.some(([v]) => String(v) === String(value))) value = '';
        return { ...prev, [fieldName]: { choices: fresh.choices, value, nonce: Date.now() } };
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.pathname, location.search, data]
  );

  const onModalDone = useCallback(
    (name, payload) => {
      setModal(null);
      if (payload && payload.event !== 'cancel') refreshRelated(name);
    },
    [refreshRelated]
  );
  const closeModal = useCallback(() => setModal(null), []);

  // popups opened with window.open() report back with postMessage
  useEffect(() => {
    if (theme.related_modal_active) return undefined;
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || !e.data || e.data.type !== 'pehchan-admin-popup') return;
      if (e.data.event !== 'cancel' && e.data.name) refreshRelated(e.data.name);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [theme.related_modal_active, refreshRelated]);

  // ---- submit row (admin/submit_line.html) ----
  const sb = data.save_buttons || (viewOnly ? {} : { save: true, save_and_add_another: true, save_and_continue: true });
  const showSave = !viewOnly && !!sb.save;
  const showAddAnother = !viewOnly && !isPopup && !!sb.save_and_add_another;
  const showContinue = !viewOnly && !isPopup && !!sb.save_and_continue;
  const showClose = !showSave;
  const showDelete = !isPopup && !add && !!data.has_delete && data.object_id != null;
  const changelistUrl = data.changelist_url || `/admin/${app}/${model}/`;
  const deleteUrl = data.delete_url || `/admin/${app}/${model}/${data.object_id}/delete/`;
  const historyUrl = data.history_url || `/admin/${app}/${model}/${data.object_id}/history/`;

  const submitRow = (
    <div className={`submit-row adm-submit-bar${theme.form_submit_sticky ? ' is-sticky' : ''}`}>
      <div className="adm-submit-bar__main">
        {showSave ? (
          <button type="submit" value="Save" className="default md-btn md-btn--filled" name="_save">
            <span className="md-icon" aria-hidden="true">
              save
            </span>
            Save
          </button>
        ) : null}
        {showAddAnother ? (
          <button type="submit" value="Save and add another" name="_addanother" className="md-btn md-btn--outlined">
            Save and add another
          </button>
        ) : null}
        {showContinue ? (
          <button
            type="submit"
            value={m.has_change === false ? 'Save and view' : 'Save and continue editing'}
            name="_continue"
            className="md-btn md-btn--tonal"
          >
            {m.has_change === false ? 'Save and view' : 'Save and continue editing'}
          </button>
        ) : null}
        {showClose ? (
          <Link to={withPreservedFilters(changelistUrl, location.search)} className="closelink md-btn md-btn--outlined">
            <span className="md-icon" aria-hidden="true">
              close
            </span>
            Close
          </Link>
        ) : null}
      </div>
      {showDelete ? (
        <Link to={withPreservedFilters(deleteUrl, location.search)} className="deletelink md-btn md-btn--danger-text adm-submit-bar__delete">
          <span className="md-icon" aria-hidden="true">
            delete
          </span>
          Delete
        </Link>
      ) : null}
    </div>
  );

  const quick = (data.extra && data.extra.quick_reply) || {};

  const objectTools =
    !add && !isPopup ? (
      <ul className="object-tools adm-object-tools">
        <li>
          <Link to={withPreservedFilters(historyUrl, location.search)} className="historylink md-btn md-btn--outlined">
            <span className="md-icon" aria-hidden="true">
              history
            </span>
            History
          </Link>
        </li>
        {data.view_on_site_url || data.absolute_url ? (
          <li>
            <a href={data.view_on_site_url || data.absolute_url} className="viewsitelink md-btn md-btn--text">
              <span className="md-icon" aria-hidden="true">
                open_in_new
              </span>
              View on site
            </a>
          </li>
        ) : null}
      </ul>
    ) : null;

  return (
    <AdminLayout
      title={data.title}
      overline={capfirst(m.verbose_name_plural)}
      docTitle={errorCount ? `Error: ${data.title} | ${siteTitle}` : undefined}
      subtitle={add ? null : objectRepr}
      bodyClass={`app-${app} model-${model} change-form`}
      actions={objectTools}
      breadcrumbs={[
        [appName, `/admin/${app}/`],
        [capfirst(m.verbose_name_plural), m.has_view === false ? undefined : changelistUrl],
        [add ? `Add ${m.verbose_name}` : truncatewords(objectRepr, 18)],
      ]}
    >
      <div id="content-main">
        <form
          encType={hasFileField ? 'multipart/form-data' : undefined}
          method="post"
          id={`${model}_form`}
          className="adm-form"
          noValidate
          onSubmit={onSubmit}
          ref={formRef}
          aria-busy={busy ? 'true' : undefined}
        >
          {isUserAdd ? (
            <div className="md-alert md-alert--info adm-intro">
              <span className="md-icon" aria-hidden="true">
                info
              </span>
              <p className="md-alert__body">
                {!isPopup
                  ? 'First, enter a username and password. Then, you’ll be able to edit more user options.'
                  : 'Enter a username and password.'}
              </p>
            </div>
          ) : null}
          <div className="adm-form__body">
            {isPopup ? <input type="hidden" name="_popup" value="1" /> : null}
            {errorCount ? (
              <div className="md-alert md-alert--error adm-errornote" role="alert">
                <span className="md-icon" aria-hidden="true">
                  error
                </span>
                <div className="md-alert__body">
                  <p className="errornote">{errorCount === 1 ? 'Please correct the error below.' : 'Please correct the errors below.'}</p>
                  {errors.__all__ ? <ErrorList errors={errors.__all__} className="errorlist nonfield" /> : null}
                </div>
              </div>
            ) : null}

            {fieldsets.map((fs, i) => (
              <Fieldset
                key={i}
                fieldset={fs}
                index={i}
                errors={errors}
                relatedFor={relatedFor}
                onOpenModal={onOpenModal}
                overrides={overrides}
              />
            ))}

            {submitRow}

            {isContactMessage ? (
              <fieldset className="quick-reply-fieldset md-card adm-fieldset adm-quick-reply" aria-labelledby="quick-reply-heading">
                <div className="adm-fieldset__header">
                  <span className="md-card__icon" aria-hidden="true">
                    <span className="md-icon">forward_to_inbox</span>
                  </span>
                  <h2 className="adm-fieldset__title" id="quick-reply-heading">
                    Quick Reply
                  </h2>
                </div>
                <div className="adm-fieldset__body adm-quick-reply__body">
                  <div className="form-row adm-field">
                    <label htmlFor="id_reply_message" className="md-field__label adm-field__label">
                      Reply Message
                    </label>
                    <textarea
                      id="id_reply_message"
                      name="reply_message"
                      className="quick-reply-textarea md-textarea"
                      aria-describedby="id_reply_message_helptext"
                      placeholder={`Enter your reply to the sender here...\n\nDear ${quick.name || 'Valued Visitor'},\n\nThank you for contacting us.\n\nBest regards,\nPehchan Team`}
                    ></textarea>
                    <div className="quick-reply-help md-field__helper" id="id_reply_message_helptext">
                      Enter your reply here. It will be sent directly to <strong>{quick.email || 'the sender'}</strong> and saved as
                      the response.
                    </div>
                  </div>
                  <div className="adm-quick-reply__actions">
                    <button type="submit" value="💾 Save and Send Reply" className="quick-reply-button md-btn md-btn--filled" name="_save_and_send_reply">
                      <span className="md-icon" aria-hidden="true">
                        send
                      </span>
                      Save and Send Reply
                    </button>
                  </div>
                </div>
              </fieldset>
            ) : null}
          </div>
        </form>
      </div>
      {modal ? <RelatedModal key={`${modal.name}-${modal.href}`} modal={modal} onClose={closeModal} onDone={onModalDone} /> : null}
    </AdminLayout>
  );
}
