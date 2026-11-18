/**
 * django.contrib.admin.views.main.ChangeList port.
 */
import { Op, fn, col, where as sqlWhere } from 'sequelize';
import { getAdmin, getField, strOf, byKey } from './registry.js';
import { displayValue, EMPTY } from './fields.js';
import { dateFormat, todayISO, toLocalParts } from '../../shared/dateformat.js';

export const PER_PAGE = 100;
export const MAX_SHOW_ALL = 200;
const RESERVED = new Set(['o', 'q', 'p', 'all', 'e', '_to_field', '_popup', '_changelist_filters']);

const capfirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Normalise req.query to { key: string } */
export function flatQuery(query) {
  const out = {};
  for (const [k, v] of Object.entries(query || {})) out[k] = Array.isArray(v) ? String(v[v.length - 1]) : String(v);
  return out;
}

/** ChangeList.get_query_string(new_params, remove) */
export function qs(params, newParams = {}, remove = []) {
  const p = { ...params };
  for (const r of remove) {
    for (const k of Object.keys(p)) if (k.startsWith(r)) delete p[k];
  }
  for (const [k, v] of Object.entries(newParams)) {
    if (v === null || v === undefined) delete p[k];
    else p[k] = String(v);
  }
  const s = new URLSearchParams(p).toString();
  return `?${s}`;
}

export function hasPerm(user) {
  return !!(user && user.is_active && user.is_superuser);
}

export async function permissions(admin, user) {
  if (!hasPerm(user)) return { has_add: false, has_change: false, has_delete: false, has_view: false };
  const perms = admin.perms || {};
  return {
    has_add: perms.add ? await perms.add() : true,
    has_change: perms.change ? await perms.change() : true,
    has_delete: perms.delete ? await perms.delete() : true,
    has_view: true,
  };
}

export function modelMeta(admin, perms) {
  return {
    app_label: admin.app_label,
    model: admin.model_name,
    object_name: admin.object_name,
    verbose_name: admin.verbose_name,
    verbose_name_plural: admin.verbose_name_plural,
    app_name: admin.app_label === 'auth' ? 'Authentication and Authorization' : 'Pehchan',
    changelist_url: `/admin/${admin.app_label}/${admin.model_name}/`,
    add_url: `/admin/${admin.app_label}/${admin.model_name}/add/`,
    media_css: admin.media_css || [],
    ...perms,
  };
}

// ---------------------------------------------------------------------------
// Time helpers (Asia/Kolkata wall-clock <-> UTC instants)
// ---------------------------------------------------------------------------
const IST_MS = 330 * 60000;
const istMidnightUtc = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - IST_MS);
};
const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
};
const parseDateParam = (v) => {
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

function rangeWhere(spec, startIso, endIso) {
  // [start, end) on a date or datetime column
  const cond = {};
  if (spec.type === 'datetime') {
    if (startIso) cond[Op.gte] = istMidnightUtc(startIso);
    if (endIso) cond[Op.lt] = istMidnightUtc(endIso);
  } else {
    if (startIso) cond[Op.gte] = startIso;
    if (endIso) cond[Op.lt] = endIso;
  }
  return cond;
}

const columnOf = (spec) => (spec.type === 'fk' ? spec.column : spec.name);
const filterTitle = (f, spec) => f.title || (spec ? spec.label.toLowerCase() : f.field);

// ---------------------------------------------------------------------------
// Filters (list_filter)
// ---------------------------------------------------------------------------
async function buildFilters(admin, params) {
  const filters = [];
  const where = [];
  const usedParams = new Set();

  for (const f of admin.list_filter || []) {
    const spec = getField(admin, f.field);
    if (!spec) continue;
    const name = spec.name;
    const column = columnOf(spec);
    const title = filterTitle(f, spec);
    const kind = f.kind || (spec.type === 'bool' ? 'bool' : spec.type === 'fk' ? 'fk' : spec.choices ? 'choice' : 'values');
    const nullable = !!spec.null;

    if (kind === 'choice' || kind === 'values' || kind === 'bool') {
      const exactKey = `${name}__exact`;
      const nullKey = `${name}__isnull`;
      const ownParams = [exactKey, nullKey];
      ownParams.forEach((k) => usedParams.add(k));
      const exact = params[exactKey];
      const isnull = params[nullKey];
      if (exact !== undefined) {
        where.push({ [column]: kind === 'bool' ? ['1', 'true', 'True'].includes(exact) : exact });
      }
      if (isnull !== undefined) where.push({ [column]: ['True', 'true', '1'].includes(isnull) ? null : { [Op.ne]: null } });

      const choices = [{ display: 'All', selected: exact === undefined && isnull === undefined, query: qs(params, {}, ownParams) }];
      if (kind === 'bool') {
        for (const [val, label] of [['1', 'Yes'], ['0', 'No']]) {
          choices.push({ display: label, selected: exact === val, query: qs(params, { [exactKey]: val }, [nullKey]) });
        }
        if (nullable) choices.push({ display: 'Unknown', selected: isnull === 'True', query: qs(params, { [nullKey]: 'True' }, [exactKey]) });
      } else if (kind === 'choice') {
        for (const [val, label] of spec.choices) {
          choices.push({ display: label, selected: exact === String(val), query: qs(params, { [exactKey]: val }, [nullKey]) });
        }
        if (nullable) choices.push({ display: EMPTY, selected: isnull === 'True', query: qs(params, { [nullKey]: 'True' }, [exactKey]) });
      } else {
        const rows = await admin.Model.findAll({ attributes: [[fn('DISTINCT', col(column)), 'v']], order: [[col(column), 'ASC']], raw: true });
        let hasNull = false;
        for (const r of rows) {
          if (r.v === null) {
            hasNull = true;
            continue;
          }
          choices.push({ display: String(r.v), selected: exact === String(r.v), query: qs(params, { [exactKey]: r.v }, [nullKey]) });
        }
        if (hasNull) choices.push({ display: EMPTY, selected: isnull === 'True', query: qs(params, { [nullKey]: 'True' }, [exactKey]) });
      }
      filters.push({ title, param_names: ownParams, choices });
    } else if (kind === 'fk') {
      const idKey = `${name}__id__exact`;
      const nullKey = `${name}__isnull`;
      const ownParams = [idKey, nullKey];
      ownParams.forEach((k) => usedParams.add(k));
      const id = params[idKey];
      const isnull = params[nullKey];
      if (id !== undefined && /^\d+$/.test(id)) where.push({ [column]: Number(id) });
      if (isnull !== undefined) where.push({ [column]: ['True', 'true', '1'].includes(isnull) ? null : { [Op.ne]: null } });
      const relAdmin = byKey.get(spec.related);
      const order = relAdmin.ordering || relAdmin.model_ordering || [['id', 'ASC']];
      const related = await relAdmin.Model.findAll({ include: relAdmin.include || [], order });
      const choices = [{ display: 'All', selected: id === undefined && isnull === undefined, query: qs(params, {}, ownParams) }];
      for (const r of related) {
        choices.push({ display: strOf(spec.related, r), selected: id === String(r.id), query: qs(params, { [idKey]: r.id }, [nullKey]) });
      }
      if (nullable) choices.push({ display: EMPTY, selected: isnull === 'True', query: qs(params, { [nullKey]: 'True' }, [idKey]) });
      if (related.length + (nullable ? 1 : 0) > 1) filters.push({ title, param_names: ownParams, choices });
    } else if (kind === 'date') {
      const gteKey = `${name}__gte`;
      const ltKey = `${name}__lt`;
      const nullKey = `${name}__isnull`;
      const ownParams = [gteKey, ltKey, nullKey];
      ownParams.forEach((k) => usedParams.add(k));
      const gte = parseDateParam(params[gteKey]);
      const lt = parseDateParam(params[ltKey]);
      const isnull = params[nullKey];
      if (gte || lt) where.push({ [column]: rangeWhere(spec, gte, lt) });
      if (isnull !== undefined) where.push({ [column]: ['True', 'true', '1'].includes(isnull) ? null : { [Op.ne]: null } });

      const today = todayISO();
      const tomorrow = addDays(today, 1);
      const monthStart = `${today.slice(0, 7)}-01`;
      const [y, m] = today.split('-').map(Number);
      const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const yearStart = `${y}-01-01`;
      const nextYear = `${y + 1}-01-01`;
      const links = [
        ['Any date', {}],
        ['Today', { [gteKey]: today, [ltKey]: tomorrow }],
        ['Past 7 days', { [gteKey]: addDays(today, -7), [ltKey]: tomorrow }],
        ['This month', { [gteKey]: monthStart, [ltKey]: nextMonth }],
        ['This year', { [gteKey]: yearStart, [ltKey]: nextYear }],
      ];
      if (nullable) {
        links.push(['No date', { [nullKey]: 'True' }]);
        links.push(['Has date', { [nullKey]: 'False' }]);
      }
      const current = { [gteKey]: params[gteKey], [ltKey]: params[ltKey], [nullKey]: params[nullKey] };
      const choices = links.map(([display, p]) => {
        const selected = ownParams.every((k) => (p[k] === undefined ? current[k] === undefined : String(p[k]) === String(current[k] ?? '')));
        return { display, selected, query: qs(params, p, ownParams) };
      });
      filters.push({ title, param_names: ownParams, choices });
    }
  }
  return { filters, where, usedParams };
}

// ---------------------------------------------------------------------------
// Date hierarchy
// ---------------------------------------------------------------------------
function dateKeyOf(spec, value) {
  if (value === null || value === undefined) return null;
  if (spec.type === 'date') return String(value).slice(0, 10);
  const p = toLocalParts(value instanceof Date ? value.toISOString() : value);
  return p ? `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}` : null;
}

function hierarchyWhere(spec, params) {
  const name = spec.name;
  const y = params[`${name}__year`];
  const m = params[`${name}__month`];
  const d = params[`${name}__day`];
  if (!y || !/^\d{4}$/.test(y)) return null;
  const pad = (n) => String(n).padStart(2, '0');
  let start;
  let end;
  if (m && /^\d{1,2}$/.test(m)) {
    if (d && /^\d{1,2}$/.test(d)) {
      start = `${y}-${pad(m)}-${pad(d)}`;
      end = addDays(start, 1);
    } else {
      start = `${y}-${pad(m)}-01`;
      end = Number(m) === 12 ? `${Number(y) + 1}-01-01` : `${y}-${pad(Number(m) + 1)}-01`;
    }
  } else {
    start = `${y}-01-01`;
    end = `${Number(y) + 1}-01-01`;
  }
  return { [columnOf(spec)]: rangeWhere(spec, start, end) };
}

async function buildDateHierarchy(admin, params, baseWhere, include) {
  if (!admin.date_hierarchy) return null;
  const spec = getField(admin, admin.date_hierarchy);
  const name = spec.name;
  const yk = `${name}__year`;
  const mk = `${name}__month`;
  const dk = `${name}__day`;
  let year = params[yk];
  let month = params[mk];
  const day = params[dk];
  const link = (p) => qs(params, p, [`${name}__`]);

  const rows = await admin.Model.findAll({
    attributes: ['id', columnOf(spec)],
    where: baseWhere,
    include: include.map((i) => ({ ...i, attributes: [] })),
    raw: true,
    subQuery: false,
  });
  const keys = [...new Set(rows.map((r) => dateKeyOf(spec, r[columnOf(spec)])).filter(Boolean))].sort();

  if (!year && !month && !day && keys.length) {
    const first = keys[0];
    const last = keys[keys.length - 1];
    if (first.slice(0, 4) === last.slice(0, 4)) {
      year = first.slice(0, 4);
      if (first.slice(5, 7) === last.slice(5, 7)) month = String(Number(first.slice(5, 7)));
    }
  }

  if (year && month && day) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return {
      back: { label: dateFormat(iso, 'F Y'), query: link({ [yk]: year, [mk]: month }) },
      choices: [{ label: dateFormat(iso, 'F j'), query: null }],
    };
  }
  if (year && month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const days = keys.filter((k) => k.startsWith(prefix));
    return {
      back: { label: String(year), query: link({ [yk]: year }) },
      choices: days.map((k) => ({ label: dateFormat(k, 'F j'), query: link({ [yk]: year, [mk]: month, [dk]: Number(k.slice(8, 10)) }) })),
    };
  }
  if (year) {
    const months = [...new Set(keys.filter((k) => k.startsWith(`${year}-`)).map((k) => k.slice(0, 7)))];
    return {
      back: { label: 'All dates', query: link({}) },
      choices: months.map((mm) => ({ label: dateFormat(`${mm}-01`, 'F Y'), query: link({ [yk]: year, [mk]: Number(mm.slice(5, 7)) }) })),
    };
  }
  const years = [...new Set(keys.map((k) => k.slice(0, 4)))];
  return { back: null, choices: years.map((yy) => ({ label: yy, query: link({ [yk]: yy }) })) };
}

// ---------------------------------------------------------------------------
// Search (search_fields, icontains on every term)
// ---------------------------------------------------------------------------
function smartSplit(q) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(q))) out.push(m[1] ?? m[2] ?? m[3]);
  return out.filter((t) => t !== '');
}

function searchWhere(admin, q) {
  if (!q || !(admin.search_fields || []).length) return null;
  const terms = smartSplit(q);
  if (!terms.length) return null;
  const like = (t) => ({ [Op.like]: `%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%` });
  return {
    [Op.and]: terms.map((t) => ({
      [Op.or]: admin.search_fields.map((sf) => {
        const parts = sf.split('__');
        if (parts.length === 1) return { [sf]: like(t) };
        return { [`$${parts.join('.')}$`]: like(t) };
      }),
    })),
  };
}

// ---------------------------------------------------------------------------
// list_display columns & cells
// ---------------------------------------------------------------------------
export function listColumns(admin) {
  return admin.list_display.map((c) => {
    if (c.field) {
      const spec = getField(admin, c.field);
      return { key: c.field, label: c.label || spec.label, spec, order_field: columnOf(spec), editable: (admin.list_editable || []).includes(c.field) };
    }
    return { key: c.key, label: c.label, cell: c.cell, order_field: c.order_field ? c.order_field : null, editable: false };
  });
}

function cellFor(column, obj) {
  if (column.cell) {
    const c = column.cell(obj);
    if (c.type === 'text' && (c.text === null || c.text === undefined)) return { type: 'text', text: EMPTY };
    if (c.type === 'text' && c.text === '') return { type: 'text', text: ' ' };
    return c;
  }
  const spec = column.spec;
  if (column.editable) {
    if (spec.type === 'bool') return { type: 'editable', field: spec.name, input: 'checkbox', value: !!obj[spec.name] };
    return { type: 'editable', field: spec.name, input: 'select', value: obj[spec.name] ?? '', choices: spec.choices };
  }
  if (spec.type === 'bool') return { type: 'bool', value: obj[spec.name] === null || obj[spec.name] === undefined ? null : !!obj[spec.name] };
  const raw = spec.type === 'fk' ? obj[spec.column] : obj[spec.name];
  if (raw === '' && spec.type !== 'fk') return { type: 'text', text: ' ' };
  return { type: 'text', text: displayValue(spec, obj, strOf) };
}

/** Columns currently used for ordering: Map(index -> 'asc'|'desc') (indexes include the action checkbox offset) */
function orderingColumns(admin, columns, params, offset) {
  const result = new Map();
  if (params.o !== undefined) {
    for (const part of String(params.o).split('.')) {
      const m = part.match(/^(-?)(\d+)$/);
      if (!m) continue;
      const idx = Number(m[2]);
      const column = columns[idx - offset];
      if (!column || !column.order_field) continue;
      result.set(idx, m[1] ? 'desc' : 'asc');
    }
    return result;
  }
  const ordering = admin.ordering || admin.model_ordering || [];
  for (const [field, dir] of ordering) {
    const i = columns.findIndex((c) => c.order_field === field || c.key === field);
    if (i >= 0) result.set(i + offset, dir === 'DESC' ? 'desc' : 'asc');
  }
  return result;
}

function sqlOrdering(admin, columns, params, offset) {
  const order = [];
  if (params.o !== undefined) {
    for (const part of String(params.o).split('.')) {
      const m = part.match(/^(-?)(\d+)$/);
      if (!m) continue;
      const column = columns[Number(m[2]) - offset];
      if (!column || !column.order_field) continue;
      order.push([column.order_field, m[1] ? 'DESC' : 'ASC']);
    }
  } else {
    order.push(...(admin.ordering || admin.model_ordering || []));
  }
  if (!order.some(([f]) => f === 'id')) order.push(['id', 'DESC']);
  return order;
}

function headerLinks(columns, ordCols, params, offset) {
  const makeParam = (t, n) => `${t === 'desc' ? '-' : ''}${n}`;
  return columns.map((column, ci) => {
    const i = ci + offset;
    if (!column.order_field) return { key: column.key, label: column.label, sortable: false, sorted: null, sort_priority: null };
    const isSorted = ordCols.has(i);
    const current = ordCols.get(i);
    const newOrderType = isSorted ? (current === 'asc' ? 'desc' : 'asc') : 'asc';
    const primary = [];
    const remove = [];
    const toggle = [];
    for (const [j, ot] of ordCols) {
      if (j === i) {
        const p = makeParam(newOrderType, j);
        primary.unshift(p);
        toggle.push(p);
      } else {
        const p = makeParam(ot, j);
        primary.push(p);
        toggle.push(p);
        remove.push(p);
      }
    }
    if (!isSorted) primary.unshift(makeParam(newOrderType, i));
    const priority = isSorted ? [...ordCols.keys()].indexOf(i) + 1 : null;
    return {
      key: column.key,
      label: column.label,
      sortable: true,
      sorted: isSorted ? (current === 'asc' ? 'ascending' : 'descending') : null,
      sort_priority: priority,
      sort_query: qs(params, { o: primary.join('.') }),
      remove_query: qs(params, { o: remove.join('.') }),
      toggle_query: qs(params, { o: toggle.join('.') }),
    };
  });
}

function elidedPageRange(number, numPages, onEachSide = 3, onEnds = 2) {
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
  if (numPages <= (onEachSide + onEnds) * 2) return range(1, numPages);
  const out = [];
  if (number > 1 + onEachSide + onEnds + 1) {
    out.push(...range(1, onEnds), '…', ...range(number - onEachSide, number));
  } else out.push(...range(1, number));
  if (number < numPages - onEachSide - onEnds - 1) {
    out.push(...range(number + 1, number + onEachSide), '…', ...range(numPages - onEnds + 1, numPages));
  } else out.push(...range(number + 1, numPages));
  return out;
}

/** Build the filtered where clause (filters + search + date hierarchy) */
export async function filteredQuery(admin, rawQuery) {
  const all = flatQuery(rawQuery);
  const params = { ...all };
  delete params.p;
  delete params.e;
  const { filters, where: filterWhere, usedParams } = await buildFilters(admin, params);
  const and = [...filterWhere];
  const search = searchWhere(admin, params.q);
  if (search) and.push(search);
  const dhSpec = admin.date_hierarchy ? getField(admin, admin.date_hierarchy) : null;
  if (dhSpec) {
    const hw = hierarchyWhere(dhSpec, params);
    if (hw) and.push(hw);
  }
  // Remaining simple lookups (e.g. links with field__exact for fields not in list_filter)
  for (const [k, v] of Object.entries(params)) {
    if (RESERVED.has(k) || usedParams.has(k)) continue;
    if (dhSpec && k.startsWith(`${dhSpec.name}__`)) continue;
    const m = k.match(/^(\w+?)(?:__id)?__exact$/);
    if (m) {
      const spec = getField(admin, m[1]);
      if (spec) and.push({ [columnOf(spec)]: v });
    }
  }
  const where = and.length ? { [Op.and]: and } : {};
  return { params, all, filters, where, usedParams };
}

export async function changelistData(admin, rawQuery, perms) {
  const { params, all, filters, where, usedParams } = await filteredQuery(admin, rawQuery);
  const include = admin.include || [];
  const columns = listColumns(admin);
  const actionsList = buildActions(admin, perms);
  const offset = actionsList.length ? 1 : 0;

  const resultCount = await admin.Model.count({ where, include, distinct: true, col: 'id' });
  const fullCount = await admin.Model.count();

  const showAll = all.all !== undefined;
  const canShowAll = resultCount <= MAX_SHOW_ALL;
  const multiPage = resultCount > PER_PAGE;
  const numPages = Math.max(1, Math.ceil(resultCount / PER_PAGE));
  let page = /^\d+$/.test(all.p || '') ? Number(all.p) : 1;
  if (page < 1) page = 1;
  if (page > numPages) page = numPages;

  const ordCols = orderingColumns(admin, columns, params, offset);
  const order = sqlOrdering(admin, columns, params, offset);
  const findOpts = { where, include, order, subQuery: false };
  if (!(showAll && canShowAll)) {
    findOpts.limit = PER_PAGE;
    findOpts.offset = (page - 1) * PER_PAGE;
  }
  const objects = await admin.Model.findAll(findOpts);

  const preserved = new URLSearchParams(params).toString();
  const changeSuffix = preserved ? `?_changelist_filters=${encodeURIComponent(preserved)}` : '';
  const rows = objects.map((obj) => ({
    id: obj.id,
    change_url: `/admin/${admin.app_label}/${admin.model_name}/${obj.id}/change/${changeSuffix}`,
    cells: columns.map((c) => cellFor(c, obj)),
  }));

  const filterParamNames = [...usedParams];
  const hasActiveFilters = filterParamNames.some((k) => params[k] !== undefined);
  const dateHierarchy = await buildDateHierarchy(admin, params, where, include);

  const pages = multiPage
    ? elidedPageRange(page, numPages).map((n) => (n === '…' ? { ellipsis: true } : { number: n, query: qs(params, { p: n }), current: n === page && !(showAll && canShowAll) }))
    : [];

  const viewOnly = !perms.has_change;
  return {
    ok: true,
    title: `Select ${admin.verbose_name} to ${viewOnly ? 'view' : 'change'}`,
    query: new URLSearchParams(params).toString(),
    columns: headerLinks(columns, ordCols, params, offset),
    rows,
    list_editable: perms.has_change ? admin.list_editable || [] : [],
    search: { enabled: (admin.search_fields || []).length > 0, q: params.q || '' },
    filters,
    has_active_filters: hasActiveFilters,
    clear_all_filters_query: qs(params, {}, filterParamNames),
    date_hierarchy: dateHierarchy,
    actions: actionsList.map(({ name, description }) => ({ name, description })),
    result_count: resultCount,
    full_result_count: fullCount,
    show_full_result_count: true,
    pagination: {
      page,
      num_pages: numPages,
      per_page: PER_PAGE,
      multi_page: multiPage,
      can_show_all: canShowAll,
      show_all: showAll && canShowAll,
      show_all_query: qs(params, { all: '' }),
      pages,
    },
  };
}

/** Admin actions incl. delete_selected (only when the user may delete) */
export function buildActions(admin, perms) {
  const list = [];
  if (perms.has_delete) {
    list.push({ name: 'delete_selected', description: `Delete selected ${admin.verbose_name_plural}` });
  }
  for (const a of admin.actions || []) list.push(a);
  return list;
}

export function verboseCount(admin, n) {
  return n === 1 ? admin.verbose_name : admin.verbose_name_plural;
}

export { capfirst };
