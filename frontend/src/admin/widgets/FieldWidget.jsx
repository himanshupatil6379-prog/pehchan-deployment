import { AdminDateInput, AdminTimeInput } from './DateTimeShortcuts.jsx';
import { RelatedSelect } from './RelatedWidget.jsx';
import { capfirst } from '../utils.js';

/**
 * Renders the Django admin widget for an API `Field` (see docs/ADMIN_API.md)
 * with M3 field styling. Inputs are uncontrolled (defaultValue) so the user's
 * input survives a validation error re-render, exactly like Django re-rendering
 * the bound form.
 */

export function fieldId(field) {
  return `id_${field.name}`;
}

/** Field types whose widget is a MultiWidget / RadioSelect (label has no `for`). */
export function labelFor(field) {
  if (field.readonly) return undefined;
  if (field.type === 'datetime' || field.type === 'radio') return undefined;
  if (field.type === 'm2m_checkbox') return undefined;
  return fieldId(field);
}

function str(v) {
  return v == null ? '' : String(v);
}

function splitDateTime(value) {
  if (value && typeof value === 'object') return { date: str(value.date), time: str(value.time) };
  const s = str(value);
  if (!s) return { date: '', time: '' };
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)/.exec(s);
  return m ? { date: m[1], time: m[2].length === 5 ? `${m[2]}:00` : m[2] } : { date: s, time: '' };
}

export default function FieldWidget({ field, invalid, related, onOpenModal, override }) {
  const id = fieldId(field);
  const describedBy = field.help_text && labelFor(field) ? `${id}_helptext` : undefined;
  const required = !!field.required;
  const common = {
    name: field.name,
    id,
    required: required || undefined,
    'aria-describedby': describedBy,
    'aria-invalid': invalid ? 'true' : undefined,
  };
  const value = field.value;
  const label = capfirst(field.label || field.name);

  switch (field.type) {
    case 'char':
    case 'ip':
    case 'slug':
    case 'url':
      return (
        <input
          type={field.type === 'url' ? 'url' : 'text'}
          {...common}
          defaultValue={str(value)}
          className={`${field.type === 'url' ? 'vURLField' : 'vTextField'} md-input`}
          maxLength={field.max_length || (field.type === 'ip' ? 39 : undefined)}
        />
      );
    case 'email':
      return <input type="email" {...common} defaultValue={str(value)} className="vTextField md-input" maxLength={field.max_length || undefined} />;
    case 'text':
      return (
        <textarea
          {...common}
          cols="40"
          rows="10"
          className="vLargeTextField md-textarea"
          maxLength={field.max_length || undefined}
          defaultValue={str(value)}
        />
      );
    case 'int':
      return <input type="number" {...common} defaultValue={str(value)} className="vIntegerField md-input adm-input--num" />;
    case 'decimal':
    case 'float':
      return (
        <input type="number" {...common} defaultValue={str(value)} className="vDecimalField md-input adm-input--num" step={field.step || '0.01'} />
      );
    case 'password':
      return <input type="password" {...common} autoComplete="new-password" defaultValue="" className="md-input" />;
    case 'bool':
      return <input type="checkbox" role="switch" {...common} defaultChecked={!!value} className="adm-switch" />;
    case 'select':
      return (
        <select {...common} defaultValue={str(value)} className="md-select">
          {(field.choices || []).map(([v, optLabel]) => (
            <option key={str(v)} value={str(v)}>
              {optLabel}
            </option>
          ))}
        </select>
      );
    case 'multiselect':
    case 'm2m':
      return (
        <select {...common} multiple defaultValue={(Array.isArray(value) ? value : []).map(str)} className="md-select adm-select--multi">
          {(field.choices || []).map(([v, optLabel]) => (
            <option key={str(v)} value={str(v)}>
              {optLabel}
            </option>
          ))}
        </select>
      );
    case 'radio':
      return (
        <div id={id} className={`${field.class_name || 'radiolist'} adm-radio-list`} role="radiogroup" aria-label={label}>
          {(field.choices || []).map(([v, optLabel], i) => (
            <div key={str(v)}>
              <label htmlFor={`${id}_${i}`} className="adm-radio">
                <input
                  type="radio"
                  name={field.name}
                  value={str(v)}
                  id={`${id}_${i}`}
                  defaultChecked={str(value) === str(v)}
                  required={required || undefined}
                />
                <span>{optLabel}</span>
              </label>
            </div>
          ))}
        </div>
      );
    case 'fk':
      return (
        <RelatedSelect
          field={field}
          id={id}
          value={override && override.value !== undefined ? override.value : value}
          choices={override && override.choices ? override.choices : field.choices}
          required={required}
          describedBy={describedBy}
          invalid={invalid}
          info={related}
          onOpenModal={onOpenModal}
        />
      );
    case 'date':
      return (
        <div className="date adm-dt">
          <AdminDateInput name={field.name} id={id} defaultValue={str(value)} required={required} describedBy={describedBy} invalid={invalid} />
        </div>
      );
    case 'time':
      return (
        <div className="time adm-dt">
          <AdminTimeInput name={field.name} id={id} defaultValue={str(value)} required={required} describedBy={describedBy} invalid={invalid} />
        </div>
      );
    case 'datetime': {
      const { date, time } = splitDateTime(value);
      if (field.native) {
        // pehchan/admin.py NativeDateTimeWidget (MultiWidget of type=date + type=time)
        return (
          <div className="adm-dt-pair" role="group" aria-label={label}>
            <input
              type="date"
              name={`${field.name}_0`}
              className="vDateField md-input"
              id={`${id}_0`}
              defaultValue={date}
              required={required || undefined}
              aria-label={`${label}: date`}
              aria-invalid={invalid ? 'true' : undefined}
            />
            <input
              type="time"
              name={`${field.name}_1`}
              className="vTimeField md-input"
              id={`${id}_1`}
              defaultValue={time}
              required={required || undefined}
              aria-label={`${label}: time`}
              aria-invalid={invalid ? 'true' : undefined}
            />
          </div>
        );
      }
      return (
        <div className="datetime adm-dt adm-dt--split" role="group" aria-label={label}>
          <div className="adm-dt__row">
            <label className="adm-dt__label" htmlFor={`${id}_0`}>
              Date
            </label>
            <AdminDateInput name={`${field.name}_0`} id={`${id}_0`} defaultValue={date} required={required} invalid={invalid} />
          </div>
          <div className="adm-dt__row">
            <label className="adm-dt__label" htmlFor={`${id}_1`}>
              Time
            </label>
            <AdminTimeInput name={`${field.name}_1`} id={`${id}_1`} defaultValue={time} required={required} invalid={invalid} />
          </div>
        </div>
      );
    }
    case 'file':
    case 'image':
      return <ClearableFileInput field={field} id={id} describedBy={describedBy} invalid={invalid} />;
    default:
      return <input type="text" {...common} defaultValue={str(value)} className="vTextField md-input" />;
  }
}

/** admin/widgets/clearable_file_input.html */
function ClearableFileInput({ field, id, describedBy, invalid }) {
  const value = field.value && typeof field.value === 'object' ? field.value : field.value ? { name: String(field.value), url: String(field.value) } : null;
  const input = (
    <input
      type="file"
      name={field.name}
      id={id}
      className="md-input adm-file__input"
      accept={field.type === 'image' ? 'image/*' : field.accept || undefined}
      aria-describedby={describedBy}
      aria-invalid={invalid ? 'true' : undefined}
    />
  );
  if (!value || !value.name) return input;
  const checkboxName = `${field.name}-clear`;
  const checkboxId = `${checkboxName}_id`;
  return (
    <div className="file-upload adm-file">
      <div className="adm-file__current">
        <span className="md-icon adm-file__icon" aria-hidden="true">
          {field.type === 'image' ? 'image' : 'description'}
        </span>
        <span className="adm-file__label">Currently:</span>
        <a href={value.url} className="adm-file__link" title={value.name}>
          {value.name}
        </a>
        {!field.required && (
          <span className="clearable-file-input adm-file__clear">
            <input type="checkbox" name={checkboxName} id={checkboxId} /> <label htmlFor={checkboxId}>Clear</label>
          </span>
        )}
      </div>
      <div className="adm-file__change">
        <span className="adm-file__label">Change:</span>
        {input}
      </div>
    </div>
  );
}
