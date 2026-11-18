import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAdmin } from '../AdminContext.jsx';
import { findModel } from '../utils.js';

/**
 * admin/widgets/related_widget_wrapper.html (+ RelatedObjectLookups.js link
 * updating) and the django-admin-interface related modal (an iframe of the
 * related page in "?_popup=1" mode).
 */

// Fallback when the API Field does not describe the related model.
const FK_FALLBACK = {
  user: 'auth.user',
  created_by: 'auth.user',
  approved_by: 'auth.user',
  reviewed_by: 'auth.user',
  responded_by: 'auth.user',
  issued_by: 'auth.user',
  event: 'pehchan.event',
  volunteer: 'pehchan.eventvolunteer',
  material_donation: 'pehchan.materialdonation',
  money_donation: 'pehchan.moneydonation',
  wallet: 'pehchan.pehchanwallet',
  related_donation: 'pehchan.moneydonation',
  related_expense: 'pehchan.expense',
};
const VERBOSE = {
  'auth.user': 'user',
  'pehchan.event': 'event',
  'pehchan.eventvolunteer': 'event volunteer',
  'pehchan.materialdonation': 'material donation',
  'pehchan.moneydonation': 'money donation',
  'pehchan.pehchanwallet': 'pehchan wallet',
  'pehchan.expense': 'expense',
  'pehchan.certificate': 'certificate',
  'pehchan.donorcertificate': 'donor certificate',
};

/** Resolve { app_label, model, verbose_name, admin_url, can_add, can_change, can_view, can_delete }. */
export function relatedInfo(field, appList) {
  let rel = field.related || field.related_model || field.remote_model || null;
  let appLabel;
  let model;
  if (rel && typeof rel === 'object') {
    appLabel = rel.app_label;
    model = rel.model || rel.model_name;
    if ((!appLabel || !model) && rel.admin_url) {
      const m = /^\/admin\/([^/]+)\/([^/]+)\//.exec(rel.admin_url);
      if (m) [, appLabel, model] = m;
    }
  } else if (typeof rel === 'string') {
    [appLabel, model] = rel.replace('/', '.').split('.');
    rel = {};
  } else {
    const fb = FK_FALLBACK[field.name];
    if (fb) [appLabel, model] = fb.split('.');
    rel = {};
  }
  if (!appLabel || !model) return null;
  const key = `${appLabel}.${model}`;
  const entry = findModel(appList, appLabel, model);
  const adminUrl = rel.admin_url || (entry && entry.admin_url) || `/admin/${appLabel}/${model}/`;
  return {
    app_label: appLabel,
    model,
    verbose_name: rel.verbose_name || VERBOSE[key] || model,
    admin_url: adminUrl,
    can_add: rel.can_add ?? !!(entry && entry.add_url),
    can_change: rel.can_change ?? !!(entry && entry.admin_url && !entry.view_only),
    can_view: rel.can_view ?? !!(entry && entry.admin_url),
    can_delete: rel.can_delete ?? false,
  };
}

export function RelatedSelect({ field, id, value, onValueChange, choices, required, describedBy, invalid, info, onOpenModal }) {
  const [current, setCurrent] = useState(value == null ? '' : String(value));
  useEffect(() => {
    setCurrent(value == null ? '' : String(value));
  }, [value]);

  const change = (e) => {
    setCurrent(e.target.value);
    if (onValueChange) onValueChange(e.target.value);
  };

  const select = (
    <select
      name={field.name}
      id={id}
      className="md-select"
      value={current}
      onChange={change}
      required={required || undefined}
      aria-describedby={describedBy}
      aria-invalid={invalid ? 'true' : undefined}
    >
      {(choices || []).map(([v, label]) => (
        <option key={String(v)} value={v == null ? '' : String(v)}>
          {label}
        </option>
      ))}
    </select>
  );
  if (!info) return select;

  const params = '_to_field=id&_popup=1';
  const base = info.admin_url;
  const changeHref = current ? `${base}${encodeURIComponent(current)}/change/?${params}` : undefined;
  const deleteHref = current ? `${base}${encodeURIComponent(current)}/delete/?${params}` : undefined;
  const viewHref = current ? `${base}${encodeURIComponent(current)}/change/?_to_field=id` : undefined;
  const addHref = `${base}add/?${params}`;

  const open = (linkId) => (e) => {
    const href = e.currentTarget.getAttribute('href');
    if (!href) {
      e.preventDefault();
      return;
    }
    if (!onOpenModal) return; // plain navigation
    e.preventDefault();
    e.stopPropagation();
    const title = e.currentTarget.getAttribute('title') || '';
    e.currentTarget.blur();
    onOpenModal({ name: linkId, href, title });
  };

  const linkClass = 'related-widget-wrapper-link md-icon-btn adm-related__link';

  return (
    <div className="related-widget-wrapper adm-related" data-model-ref={info.model}>
      {select}
      <div className="adm-related__links">
        {info.can_change && (
          <a
            className={`${linkClass} change-related`}
            id={`change_id_${field.name}`}
            data-href-template={`${base}__fk__/change/?${params}`}
            data-popup="yes"
            title={`Change selected ${info.verbose_name}`}
            aria-label={`Change selected ${info.verbose_name}`}
            aria-disabled={changeHref ? undefined : 'true'}
            href={changeHref}
            onClick={open(`change_id_${field.name}`)}
          >
            <span className="md-icon" aria-hidden="true">
              edit
            </span>
          </a>
        )}
        {info.can_add && (
          <a
            className={`${linkClass} add-related`}
            id={`add_id_${field.name}`}
            data-popup="yes"
            href={addHref}
            title={`Add another ${info.verbose_name}`}
            aria-label={`Add another ${info.verbose_name}`}
            onClick={open(`add_id_${field.name}`)}
          >
            <span className="md-icon" aria-hidden="true">
              add
            </span>
          </a>
        )}
        {info.can_delete && (
          <a
            className={`${linkClass} delete-related`}
            id={`delete_id_${field.name}`}
            data-href-template={`${base}__fk__/delete/?${params}`}
            data-popup="yes"
            title={`Delete selected ${info.verbose_name}`}
            aria-label={`Delete selected ${info.verbose_name}`}
            aria-disabled={deleteHref ? undefined : 'true'}
            href={deleteHref}
            onClick={open(`delete_id_${field.name}`)}
          >
            <span className="md-icon" aria-hidden="true">
              delete
            </span>
          </a>
        )}
        {info.can_view && (
          <a
            className={`${linkClass} view-related`}
            id={`view_id_${field.name}`}
            data-href-template={`${base}__fk__/change/?_to_field=id`}
            title={`View selected ${info.verbose_name}`}
            aria-label={`View selected ${info.verbose_name}`}
            aria-disabled={viewHref ? undefined : 'true'}
            href={viewHref}
            onClick={open(`view_id_${field.name}`)}
          >
            <span className="md-icon" aria-hidden="true">
              visibility
            </span>
          </a>
        )}
      </div>
    </div>
  );
}

function withParam(href, key, value) {
  const url = new URL(href, window.location.origin);
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

/**
 * django-admin-interface related modal (iframe of the related page in
 * "?_popup=1" mode) as an M3 full-screen-on-mobile dialog.
 * The iframe page posts {type:'pehchan-admin-popup', event:'saved'} when it is done.
 */
export function RelatedModal({ modal, onClose, onDone }) {
  const { theme } = useAdmin();
  const iframeRef = useRef(null);
  const dialogRef = useRef(null);
  const [src] = useState(() => {
    let s = withParam(modal.href, '_modal', String(Math.round(Math.random() * 999999)));
    s = withParam(s, '_popup', '1');
    return s;
  });

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    const onMessage = (e) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (!d || d.type !== 'pehchan-admin-popup') return;
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return;
      onDone(modal.name, d);
    };
    document.addEventListener('keyup', onKey);
    window.addEventListener('message', onMessage);
    return () => {
      document.removeEventListener('keyup', onKey);
      window.removeEventListener('message', onMessage);
    };
  }, [modal.name, onClose, onDone]);

  // keep the page behind the dialog still (magnific popup's overflow:hidden on <html>)
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('adm-scroll-lock');
    if (dialogRef.current) dialogRef.current.focus({ preventScroll: true });
    return () => html.classList.remove('adm-scroll-lock');
  }, []);

  const nested = window.top !== window.self;
  const mainClass = `related-modal adm-related-modal${nested ? ' related-modal__nested' : ''}`;
  const onBgClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };
  const title = modal.title || 'Related object';

  return createPortal(
    <div className={`md-dialog-backdrop ${mainClass}`} onClick={onBgClick}>
      <div className="adm-related-modal__dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={dialogRef}>
        <div className="adm-related-modal__bar">
          <span className="md-icon adm-related-modal__icon" aria-hidden="true">
            open_in_browser
          </span>
          <p className="adm-related-modal__title">{title}</p>
          {theme.related_modal_close_button_visible !== false ? (
            <button title="Close (Esc)" aria-label="Close (Esc)" type="button" className="md-icon-btn mfp-close" onClick={onClose}>
              <span className="md-icon" aria-hidden="true">
                close
              </span>
            </button>
          ) : null}
        </div>
        <div className="related-modal-iframe-container adm-related-modal__frame">
          <iframe id="related-modal-iframe" name={modal.name} src={src} ref={iframeRef} title={modal.name}></iframe>
        </div>
      </div>
    </div>,
    document.body
  );
}
