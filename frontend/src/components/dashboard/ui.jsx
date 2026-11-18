import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

/**
 * Small presentational helpers shared by the User Dashboard pages
 * (Material Design 3 – see docs/DESIGN_SYSTEM.md). No data logic lives here.
 */

/** Status → chip tone mapping from docs/DESIGN_SYSTEM.md. */
const STATUS_TONES = {
  approved: 'success',
  verified: 'success',
  received: 'success',
  replied: 'success',
  completed: 'success',
  active: 'success',
  pending: 'warning',
  unverified: 'warning',
  new: 'warning',
  upcoming: 'info',
  rejected: 'error',
  declined: 'error',
  inactive: 'error',
  processed: 'primary',
  read: 'primary',
  ongoing: 'primary',
  archived: 'neutral',
};

export function statusTone(status) {
  return STATUS_TONES[String(status ?? '').trim().toLowerCase()] || 'neutral';
}

/** <StatusChip status="pending">Pending</StatusChip> – tone follows the status, text is the children. */
export function StatusChip({ status, children, className = '' }) {
  const label = children ?? status;
  if (label === null || label === undefined || label === '') return null;
  return <span className={`md-chip md-chip--${statusTone(status ?? label)} ${className}`.trim()}>{label}</span>;
}

/** Eyebrow / overline chip shown above page titles. */
export function Eyebrow({ icon, children }) {
  return (
    <span className="dash-eyebrow">
      {icon && (
        <span className="md-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}

/** Page header: eyebrow + h1 + subtitle on the left, actions on the right. */
export function PageHeader({ eyebrow, eyebrowIcon, title, subtitle, actions, titleId }) {
  return (
    <header className="md-page-header dash-page-header">
      <div className="md-page-header__text">
        {eyebrow && <Eyebrow icon={eyebrowIcon}>{eyebrow}</Eyebrow>}
        <h1 className="md-page-header__title" id={titleId}>
          {title}
        </h1>
        {subtitle && <p className="md-page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="md-page-header__actions">{actions}</div>}
    </header>
  );
}

/** KPI / stat card. `value === null|undefined` renders a loading skeleton. */
export function KpiCard({ icon, tone, label, value, hint }) {
  const loading = value === null || value === undefined;
  return (
    <div className="md-kpi dash-kpi">
      <span className={`md-kpi__icon${tone ? ` md-kpi__icon--${tone}` : ''}`} aria-hidden="true">
        <span className="md-icon">{icon}</span>
      </span>
      <div className="md-kpi__body">
        <div className="md-kpi__label">{label}</div>
        {loading ? (
          <div className="dash-kpi__skeleton" aria-hidden="true">
            <span className="md-skeleton" />
          </div>
        ) : (
          <div className="md-kpi__value">{value}</div>
        )}
        {hint && <div className="md-kpi__hint">{hint}</div>}
      </div>
    </div>
  );
}

/** Loading placeholder for `.md-list` content. */
export function SkeletonList({ rows = 3, label = 'Loading…' }) {
  return (
    <div className="dash-skeleton-list" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div className="dash-skeleton-list__row" key={i} aria-hidden="true">
          <span className="md-skeleton dash-skeleton-list__avatar" />
          <span className="dash-skeleton-list__lines">
            <span className="md-skeleton" style={{ width: `${70 - i * 12}%` }} />
            <span className="md-skeleton" style={{ width: `${45 - i * 6}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

/** Generic block skeleton (cards / detail pages). */
export function SkeletonCard({ lines = 4, media = false, label = 'Loading…' }) {
  return (
    <div className="md-card dash-skeleton-card" role="status" aria-label={label}>
      {media && <span className="md-skeleton dash-skeleton-card__media" aria-hidden="true" />}
      <div className="md-card__content" aria-hidden="true">
        <span className="md-skeleton dash-skeleton-card__title" />
        {Array.from({ length: lines }, (_, i) => (
          <span className="md-skeleton dash-skeleton-card__line" key={i} style={{ width: `${92 - ((i * 17) % 40)}%` }} />
        ))}
      </div>
    </div>
  );
}

/**
 * Django-style pagination (first / previous / "Page N of M" / next / last).
 * `suffix` is appended verbatim to every `?page=N` link, exactly like the original templates.
 */
function Disabled({ icon }) {
  return (
    <span className="md-icon-btn dash-pagination__btn is-disabled" aria-hidden="true">
      <span className="md-icon">{icon}</span>
    </span>
  );
}

export function Pagination({ pageObj, suffix = '', label = 'Pagination' }) {
  if (!pageObj) return null;
  return (
    <nav className="dash-pagination" aria-label={label}>
      {pageObj.has_previous ? (
        <>
          <Link to={`?page=1${suffix}`} className="md-icon-btn dash-pagination__btn" aria-label="First page" title="First page">
            <span className="md-icon" aria-hidden="true">first_page</span>
          </Link>
          <Link
            to={`?page=${pageObj.previous_page_number}${suffix}`}
            className="md-icon-btn dash-pagination__btn"
            aria-label="Previous page"
            title="Previous page"
          >
            <span className="md-icon" aria-hidden="true">chevron_left</span>
          </Link>
        </>
      ) : (
        <>
          <Disabled icon="first_page" />
          <Disabled icon="chevron_left" />
        </>
      )}

      <span className="dash-pagination__info" aria-current="page">
        Page {pageObj.number} of {pageObj.num_pages}
      </span>

      {pageObj.has_next ? (
        <>
          <Link
            to={`?page=${pageObj.next_page_number}${suffix}`}
            className="md-icon-btn dash-pagination__btn"
            aria-label="Next page"
            title="Next page"
          >
            <span className="md-icon" aria-hidden="true">chevron_right</span>
          </Link>
          <Link to={`?page=${pageObj.num_pages}${suffix}`} className="md-icon-btn dash-pagination__btn" aria-label="Last page" title="Last page">
            <span className="md-icon" aria-hidden="true">last_page</span>
          </Link>
        </>
      ) : (
        <>
          <Disabled icon="chevron_right" />
          <Disabled icon="last_page" />
        </>
      )}
    </nav>
  );
}

/**
 * Modal dialog focus handling: focuses the first control when opened, keeps Tab inside the dialog,
 * locks page scroll, and restores focus to the previously focused element when closed.
 * (The dialogs keep their original behaviour – there is no extra close action.)
 */
export function useDialogFocus(open, dialogRef) {
  const restoreRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    restoreRef.current = document.activeElement;
    const dialog = dialogRef.current;
    const focusables = () =>
      dialog
        ? Array.from(dialog.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        : [];
    const first = focusables()[0];
    if (first) first.focus();
    else if (dialog) dialog.focus();

    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) {
        e.preventDefault();
        return;
      }
      const idx = list.indexOf(document.activeElement);
      if (e.shiftKey && (idx <= 0 || idx === -1)) {
        e.preventDefault();
        list[list.length - 1].focus();
      } else if (!e.shiftKey && (idx === list.length - 1 || idx === -1)) {
        e.preventDefault();
        list[0].focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      // preventScroll: pages scroll to the top themselves after a failed submit (form_invalid).
      const el = restoreRef.current;
      if (el && typeof el.focus === 'function' && document.contains(el)) el.focus({ preventScroll: true });
    };
  }, [open, dialogRef]);
}
