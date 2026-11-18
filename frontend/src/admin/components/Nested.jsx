/**
 * Django's `unordered_list` filter for the API "Nested" structure:
 *   [{ text:"Event: <a href=…>Food drive</a>", html:true, children:[Nested] }]
 * (plain strings and Django-style [item, [children]] arrays are accepted too).
 * Renders the <li> items only – wrap them in your own <ul>.
 */
export function NestedItems({ items }) {
  const list = normalize(items);
  return list.map((item, i) => (
    <li key={i}>
      {item.html ? <span dangerouslySetInnerHTML={{ __html: item.text }} /> : item.text}
      {item.children && item.children.length ? (
        <ul>
          <NestedItems items={item.children} />
        </ul>
      ) : null}
    </li>
  ));
}

function normalize(items) {
  if (!Array.isArray(items)) return [];
  const out = [];
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    if (Array.isArray(it)) {
      // a sub-list belonging to the previous item
      if (out.length) out[out.length - 1].children = [...(out[out.length - 1].children || []), ...it];
      else out.push(...normalize(it));
      continue;
    }
    if (it && typeof it === 'object') {
      out.push({ text: it.text ?? it.html_text ?? '', html: !!it.html, children: it.children || [] });
    } else {
      out.push({ text: String(it ?? ''), html: /<[a-z][\s\S]*>/i.test(String(it ?? '')), children: [] });
    }
  }
  return out;
}

/** Each top-level object in its own <ul> (delete_selected_confirmation.html). */
export function NestedPerObject({ items, className = 'adm-tree' }) {
  const list = normalize(items);
  return list.map((item, i) => (
    <ul key={i} className={className}>
      <NestedItems items={[item]} />
    </ul>
  ));
}

/** "Model name: count" rows of admin/includes/object_delete_summary.html as chips. */
export function DeleteSummary({ modelCount }) {
  return (
    <>
      <h2 className="adm-confirm__section">Summary</h2>
      <ul className="adm-summary">
        {(modelCount || []).map(([name, count], i) => (
          <li key={i} className="adm-summary__item">
            <span className="adm-summary__name">{capfirstLocal(name)}:</span> <strong className="adm-summary__count">{count}</strong>
          </li>
        ))}
      </ul>
    </>
  );
}

function capfirstLocal(s) {
  const v = s == null ? '' : String(s);
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : v;
}

/** <ul class="errorlist">…</ul> */
export function ErrorList({ errors, className = 'errorlist', id }) {
  if (!errors || !errors.length) return null;
  return (
    <ul className={className} id={id}>
      {errors.map((e, i) => (
        <li key={i}>{typeof e === 'string' ? e : e.message || String(e)}</li>
      ))}
    </ul>
  );
}
