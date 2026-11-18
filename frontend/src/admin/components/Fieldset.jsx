import { Fragment } from 'react';
import { slugify } from '../theme.js';
import { capfirst } from '../utils.js';
import FieldWidget, { fieldId, labelFor } from '../widgets/FieldWidget.jsx';
import { ErrorList } from './Nested.jsx';

/**
 * admin/includes/fieldset.html (Django 5.1+) as an M3 card: collapsible
 * fieldsets use <details><summary>; a fieldset with errors is never collapsible.
 */
export default function Fieldset({ fieldset, index, errors, relatedFor, onOpenModal, overrides }) {
  const name = fieldset.name || '';
  const slug = slugify(name);
  const classes = Array.isArray(fieldset.classes) ? fieldset.classes : String(fieldset.classes || '').split(/\s+/).filter(Boolean);
  const fields = fieldset.fields || [];
  const hasErrors = fields.some((f) => errors && errors[f.name] && errors[f.name].length);
  const collapsible = !!name && classes.includes('collapse') && !hasErrors;
  const headingId = `fieldset-0-${slug}-${index}-heading`;
  const heading = name ? (
    <h2 id={headingId} className="fieldset-heading adm-fieldset__title">
      {name}
    </h2>
  ) : null;

  const body = (
    <div className="adm-fieldset__body">
      {fieldset.description ? <div className="description adm-fieldset__desc" dangerouslySetInnerHTML={{ __html: fieldset.description }} /> : null}
      <div className="adm-fieldset__grid">
        {fields.map((field) => (
          <FieldRow
            key={field.name}
            field={field}
            errors={errors ? errors[field.name] : null}
            related={relatedFor ? relatedFor(field) : null}
            onOpenModal={onOpenModal}
            override={overrides ? overrides[field.name] : undefined}
          />
        ))}
      </div>
    </div>
  );

  return (
    <fieldset
      className={`md-card adm-fieldset module aligned ${classes.join(' ')}${name ? '' : ' adm-fieldset--plain'}`}
      aria-labelledby={name ? headingId : undefined}
    >
      {collapsible ? (
        <details className="adm-fieldset__details">
          <summary className="adm-fieldset__header adm-fieldset__summary">
            {heading}
            <span className="adm-fieldset__hint" aria-hidden="true">
              {fields.length} {fields.length === 1 ? 'field' : 'fields'}
            </span>
            <span className="md-icon adm-chevron" aria-hidden="true">
              expand_more
            </span>
          </summary>
          {body}
        </details>
      ) : (
        <>
          {heading ? <div className="adm-fieldset__header">{heading}</div> : null}
          {body}
        </>
      )}
    </fieldset>
  );
}

/** Text with newlines → <br> (linebreaksbr used by AdminReadonlyField.contents). */
function Linebreaks({ text }) {
  const parts = String(text ?? '').split(/\r\n|\r|\n/);
  return parts.map((p, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {p}
    </Fragment>
  ));
}

const WIDE_TYPES = new Set(['text', 'file', 'image', 'm2m', 'multiselect', 'm2m_checkbox', 'radio', 'password_hash']);

function isWide(field, readonly) {
  if (WIDE_TYPES.has(field.type)) return true;
  if (readonly) {
    if (field.display_html != null) return String(field.display_html).length > 80;
    const v = field.display != null ? field.display : field.value;
    return typeof v === 'string' && (v.length > 60 || /\n/.test(v));
  }
  return false;
}

export function FieldRow({ field, errors, related, onOpenModal, override }) {
  const readonly = !!field.readonly || field.type === 'password_hash';
  const fieldErrors = !readonly && errors && errors.length ? errors : null;
  const isCheckbox = field.type === 'bool' && !readonly;
  const required = !!field.required && !readonly;
  const forId = labelFor({ ...field, readonly });
  const helpId = forId ? `${fieldId(field)}_helptext` : undefined;
  const text = capfirst(field.label || field.name);
  const requiredMark = required ? (
    <span className="md-required" aria-hidden="true">
      *
    </span>
  ) : null;

  let contents;
  if (readonly) {
    contents =
      field.display_html != null ? (
        <div className="readonly adm-readonly" dangerouslySetInnerHTML={{ __html: field.display_html }} />
      ) : (
        <div className="readonly adm-readonly">
          <Linebreaks text={field.display != null ? field.display : field.value != null && typeof field.value !== 'object' ? field.value : '-'} />
        </div>
      );
  } else {
    contents = <FieldWidget field={field} invalid={!!fieldErrors} related={related} onOpenModal={onOpenModal} override={override} />;
  }

  const rowClass = [
    'form-row',
    'adm-field',
    `field-${field.name}`,
    fieldErrors ? 'errors adm-field--error' : '',
    isCheckbox ? 'adm-field--check' : '',
    readonly ? 'adm-field--readonly' : '',
    isWide(field, readonly) ? 'adm-field--wide' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rowClass}>
      {isCheckbox ? (
        <div className="flex-container checkbox-row adm-check-row">
          {contents}
          <label className={`vCheckboxLabel adm-check-row__label${required ? ' required' : ''}`} htmlFor={forId}>
            {text}
            {requiredMark}
          </label>
        </div>
      ) : (
        <>
          <label className={`md-field__label adm-field__label${required ? ' required' : ''}`} htmlFor={forId}>
            {text}
            {requiredMark}
          </label>
          <div className="adm-field__control">{contents}</div>
        </>
      )}
      {fieldErrors ? <ErrorList errors={fieldErrors} id={`${fieldId(field)}_error`} /> : null}
      {field.help_text ? (
        <div className="help md-field__helper adm-field__help" id={helpId}>
          <div dangerouslySetInnerHTML={{ __html: field.help_text }} />
        </div>
      ) : null}
    </div>
  );
}
