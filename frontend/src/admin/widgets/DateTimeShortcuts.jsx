import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MONTHS, formatDateInput, formatTimeInput, parseDateInput, serverNow } from '../utils.js';

/**
 * React port of admin/js/admin/DateTimeShortcuts.js + admin/js/calendar.js:
 *   <input type="text" class="vDateField"> + "Today" + calendar popup
 *   <input type="text" class="vTimeField"> + "Now" + clock popup
 * The popups are appended to <body> like Django does, styled as M3 popovers.
 */

const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const FIRST_DAY_OF_WEEK = 0; // en-us
const CALENDAR_WIDTH = 304;
const CLOCK_WIDTH = 220;
let calendarSeq = 0;
let clockSeq = 0;

/** Page position for a popover under `el`, kept inside the viewport horizontally. */
function popoverPos(el, width) {
  const r = el.getBoundingClientRect();
  const viewport = document.documentElement.clientWidth || window.innerWidth;
  let left = r.right - width;
  left = Math.min(left, viewport - width - 8);
  left = Math.max(8, left);
  return { left: left + window.scrollX, top: r.bottom + window.scrollY + 6 };
}

function getDaysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

/** Dismiss a popup on outside click / ESC (DateTimeShortcuts.dismiss*). */
function useDismiss(open, refs, close) {
  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (refs.some((r) => r.current && r.current.contains(e.target))) return;
      close();
    };
    const onKeyUp = (e) => {
      if (e.key === 'Escape' || e.which === 27) {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keyup', onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

/** Move focus into a popover when it opens and back to its trigger when it closes. */
function usePopoverFocus(open, boxRef, triggerRef, selector) {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      const box = boxRef.current;
      const target = box && (box.querySelector(selector) || box.querySelector('button'));
      if (target) target.focus({ preventScroll: true });
    } else if (wasOpen.current) {
      wasOpen.current = false;
      const active = document.activeElement;
      if (!active || active === document.body) {
        if (triggerRef.current) triggerRef.current.focus({ preventScroll: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

/* ------------------------------------------------------------------ */
/* Date                                                                */
/* ------------------------------------------------------------------ */

export function AdminDateInput({ name, id, defaultValue, required, describedBy, invalid, inputRef: externalRef }) {
  const [num] = useState(() => calendarSeq++);
  const inputRef = useRef(null);
  const linkRef = useRef(null);
  const boxRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const [view, setView] = useState(() => {
    const t = new Date();
    return { month: t.getMonth() + 1, year: t.getFullYear(), selected: undefined };
  });

  const setRefs = (el) => {
    inputRef.current = el;
    if (typeof externalRef === 'function') externalRef(el);
    else if (externalRef) externalRef.current = el;
  };

  const close = () => setOpen(false);
  useDismiss(open, [boxRef, linkRef], close);
  usePopoverFocus(open, boxRef, linkRef, 'td.selected button, td.today button');

  const setValue = (d) => {
    const inp = inputRef.current;
    if (!inp) return;
    inp.value = formatDateInput(d);
    inp.focus();
  };

  const quick = (offset) => (e) => {
    e.preventDefault();
    const d = serverNow();
    d.setDate(d.getDate() + offset);
    setValue(d);
    close();
  };

  const openCalendar = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const inp = inputRef.current;
    if (inp && inp.value) {
      const selected = parseDateInput(inp.value);
      if (selected) {
        const year = selected.getUTCFullYear();
        const month = selected.getUTCMonth() + 1;
        if (/\d{4}/.test(String(year)) && month >= 1 && month <= 12) {
          setView({ month, year, selected });
        }
      }
    }
    setPos(popoverPos(linkRef.current, CALENDAR_WIDTH));
    setOpen(true);
  };

  const prev = (e) => {
    e.preventDefault();
    setView((v) => (v.month === 1 ? { ...v, month: 12, year: v.year - 1 } : { ...v, month: v.month - 1 }));
  };
  const next = (e) => {
    e.preventDefault();
    setView((v) => (v.month === 12 ? { ...v, month: 1, year: v.year + 1 } : { ...v, month: v.month + 1 }));
  };
  const pick = (y, m, d) => {
    setValue(new Date(y, m - 1, d));
    close();
  };

  return (
    <span className="adm-dt-field">
      <input
        type="text"
        name={name}
        defaultValue={defaultValue || ''}
        className="vDateField md-input adm-dt-input"
        size="10"
        placeholder="YYYY-MM-DD"
        required={required || undefined}
        aria-describedby={describedBy}
        aria-invalid={invalid ? 'true' : undefined}
        id={id}
        ref={setRefs}
      />
      <span className="datetimeshortcuts adm-dt-shortcuts">
        <button type="button" className="md-btn md-btn--text md-btn--sm adm-dt-now" onClick={quick(0)}>
          Today
        </button>
        <button
          type="button"
          id={`calendarlink${num}`}
          ref={linkRef}
          onClick={openCalendar}
          className="md-icon-btn adm-dt-btn"
          title="Choose a Date"
          aria-label="Choose a Date"
          aria-haspopup="dialog"
          aria-expanded={open ? 'true' : 'false'}
          aria-controls={open ? `calendarbox${num}` : undefined}
        >
          <span className="md-icon date-icon" aria-hidden="true">
            calendar_month
          </span>
        </button>
      </span>
      {open &&
        createPortal(
          <div
            id={`calendarbox${num}`}
            className="calendarbox module adm-popover adm-calendar"
            role="dialog"
            aria-label="Choose a Date"
            style={{ display: 'block', position: 'absolute', left: `${pos.left}px`, top: `${pos.top}px` }}
            ref={boxRef}
          >
            <div className="adm-calendar__head">
              <button type="button" className="md-icon-btn calendarnav-previous" onClick={prev} aria-label="Previous month" title="Previous month">
                <span className="md-icon" aria-hidden="true">
                  chevron_left
                </span>
              </button>
              <span className="adm-calendar__title" aria-live="polite">{`${MONTHS[view.month - 1]} ${view.year}`}</span>
              <button type="button" className="md-icon-btn calendarnav-next" onClick={next} aria-label="Next month" title="Next month">
                <span className="md-icon" aria-hidden="true">
                  chevron_right
                </span>
              </button>
            </div>
            <div id={`calendarin${num}`} className="calendar">
              <CalendarTable month={view.month} year={view.year} selected={view.selected} onPick={pick} />
            </div>
            <div className="calendar-shortcuts adm-calendar__shortcuts">
              <button type="button" className="md-chip" onClick={quick(-1)}>
                Yesterday
              </button>
              <button type="button" className="md-chip" onClick={quick(0)}>
                Today
              </button>
              <button type="button" className="md-chip" onClick={quick(+1)}>
                Tomorrow
              </button>
            </div>
            <div className="calendar-cancel adm-popover__actions">
              <button
                type="button"
                className="md-btn md-btn--text md-btn--sm"
                onClick={(e) => {
                  e.preventDefault();
                  close();
                }}
              >
                Cancel
              </button>
            </div>
          </div>,
          document.body
        )}
    </span>
  );
}

/** CalendarNamespace.draw() */
function CalendarTable({ month, year, selected, onPick }) {
  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const todayYear = today.getFullYear();
  const isSelectedMonth =
    selected !== undefined && selected.getUTCFullYear() === year && selected.getUTCMonth() + 1 === month;

  const startingPos = new Date(year, month - 1, 1 - FIRST_DAY_OF_WEEK).getDay();
  const days = getDaysInMonth(month, year);

  const rows = [];
  let row = [];
  for (let i = 0; i < startingPos; i += 1) {
    row.push(
      <td key={`b${i}`} className="nonday">
        {' '}
      </td>
    );
  }
  let currentDay = 1;
  for (let i = startingPos; currentDay <= days; i += 1) {
    if (i % 7 === 0 && currentDay !== 1) {
      rows.push(row);
      row = [];
    }
    const isToday = currentDay === todayDay && month === todayMonth && year === todayYear;
    const isSelected = isSelectedMonth && currentDay === selected.getUTCDate();
    let cls = isToday ? 'today' : '';
    if (isSelected) cls = cls ? `${cls} selected` : 'selected';
    const day = currentDay;
    row.push(
      <td key={`d${day}`} className={cls || undefined}>
        <button
          type="button"
          aria-label={`${MONTHS[month - 1]} ${day}, ${year}`}
          aria-current={isToday ? 'date' : undefined}
          aria-pressed={isSelected ? 'true' : undefined}
          onClick={(e) => {
            e.preventDefault();
            onPick(year, month, day);
          }}
        >
          {day}
        </button>
      </td>
    );
    currentDay += 1;
  }
  let pad = 0;
  while (row.length < 7) {
    row.push(
      <td key={`a${pad++}`} className="nonday">
        {' '}
      </td>
    );
  }
  rows.push(row);

  return (
    <table>
      <caption className="md-visually-hidden">{`${MONTHS[month - 1]} ${year}`}</caption>
      <tbody>
        <tr>
          {DAYS_OF_WEEK.map((d, i) => (
            <th key={i} scope="col">
              {DAYS_OF_WEEK[(i + FIRST_DAY_OF_WEEK) % 7]}
            </th>
          ))}
        </tr>
        {rows.map((r, i) => (
          <tr key={i}>{r}</tr>
        ))}
      </tbody>
    </table>
  );
}

/* ------------------------------------------------------------------ */
/* Time                                                                */
/* ------------------------------------------------------------------ */

const CLOCK_HOURS = [
  ['Now', -1, 'schedule'],
  ['Midnight', 0, 'bedtime'],
  ['6 a.m.', 6, 'wb_twilight'],
  ['Noon', 12, 'light_mode'],
  ['6 p.m.', 18, 'wb_twilight'],
];

export function AdminTimeInput({ name, id, defaultValue, required, describedBy, invalid }) {
  const [num] = useState(() => clockSeq++);
  const inputRef = useRef(null);
  const linkRef = useRef(null);
  const boxRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  const close = () => setOpen(false);
  useDismiss(open, [boxRef, linkRef], close);
  usePopoverFocus(open, boxRef, linkRef, '.timelist button');

  const choose = (val) => (e) => {
    e.preventDefault();
    const d = val === -1 ? serverNow() : new Date(1970, 1, 1, val, 0, 0, 0);
    if (inputRef.current) {
      inputRef.current.value = formatTimeInput(d);
      inputRef.current.focus();
    }
    close();
  };

  const openClock = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setPos(popoverPos(linkRef.current, CLOCK_WIDTH));
    setOpen(true);
  };

  return (
    <span className="adm-dt-field">
      <input
        type="text"
        name={name}
        defaultValue={defaultValue || ''}
        className="vTimeField md-input adm-dt-input adm-dt-input--time"
        size="8"
        placeholder="HH:MM:SS"
        required={required || undefined}
        aria-describedby={describedBy}
        aria-invalid={invalid ? 'true' : undefined}
        id={id}
        ref={inputRef}
      />
      <span className="datetimeshortcuts adm-dt-shortcuts">
        <button type="button" className="md-btn md-btn--text md-btn--sm adm-dt-now" onClick={choose(-1)}>
          Now
        </button>
        <button
          type="button"
          id={`clocklink${num}`}
          ref={linkRef}
          onClick={openClock}
          className="md-icon-btn adm-dt-btn"
          title="Choose a Time"
          aria-label="Choose a Time"
          aria-haspopup="dialog"
          aria-expanded={open ? 'true' : 'false'}
          aria-controls={open ? `clockbox${num}` : undefined}
        >
          <span className="md-icon clock-icon" aria-hidden="true">
            schedule
          </span>
        </button>
      </span>
      {open &&
        createPortal(
          <div
            id={`clockbox${num}`}
            className="clockbox module adm-popover adm-clock"
            role="dialog"
            aria-labelledby={`clockbox${num}-title`}
            style={{ display: 'block', position: 'absolute', left: `${pos.left}px`, top: `${pos.top}px` }}
            ref={boxRef}
          >
            <h2 className="adm-clock__title" id={`clockbox${num}-title`}>
              Choose a time
            </h2>
            <ul className="timelist adm-clock__list">
              {CLOCK_HOURS.map(([label, val, icon]) => (
                <li key={label}>
                  <button type="button" className="md-menu-item" onClick={choose(val)}>
                    <span className="md-icon" aria-hidden="true">
                      {icon}
                    </span>
                    {label}
                  </button>
                </li>
              ))}
            </ul>
            <div className="calendar-cancel adm-popover__actions">
              <button
                type="button"
                className="md-btn md-btn--text md-btn--sm"
                onClick={(e) => {
                  e.preventDefault();
                  close();
                }}
              >
                Cancel
              </button>
            </div>
          </div>,
          document.body
        )}
    </span>
  );
}
