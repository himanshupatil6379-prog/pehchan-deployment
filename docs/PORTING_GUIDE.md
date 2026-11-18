# Porting guide: Django templates → React pages

Goal: the React app must be a **100% duplicate** of the Django site – same markup, classes,
inline styles, texts, emojis, images, animations, behaviour, redirects and flash messages.

* Django source: `../pehchan-webapp/` (templates in `templates/`, views in `pehchan/views.py`,
  forms in `pehchan/forms.py`, models in `pehchan/models.py`).
* React app: `frontend/src/` (Vite + React 18 + react-router-dom 6).
* API contract: `docs/API.md`.

## Shared building blocks (read them, do not modify them)

| File | Purpose |
|---|---|
| `components/BaseLayout.jsx` | `templates/base.html` (header, messages, footer, base CSS). Props: `title`, `extraCss`, `extraLinks`, `children`. |
| `components/PageStyle.jsx` | renders `<link>`/`<style>` in DOM order while the page is mounted. `FONTS` has the Google-font URLs used by the templates. |
| `components/ContactForm.jsx` | `templates/includes/_contact_form.html` (`source="home"` or `"dashboard"`). |
| `components/Messages.jsx` | base.html messages block. |
| `context/MessagesContext.jsx` | `useDisplayedMessages()` – call it only where a template iterates `messages`. |
| `context/AuthContext.jsx` | `useAuth()` → `{ user }` (`request.user`). |
| `hooks/useApi.js` | `const request = useApi(); await request('/path/', {method, data, formData, query})`. Applies messages/redirect/user automatically. |
| `hooks/useDocumentTitle.js` | `{% block title %}` / `<title>` |
| `utils/filters.js` | `dateFormat(v,'F d, Y')`, `datetimeFormat`, `truncatechars`, `truncatewords`, `linebreaksbr`, `floatformat`, `intcomma`, `pluralize`, `title`, `MONTHS` … |
| `styles/style.css`, `styles/base.css` | `static/CSS/style.css` and base.html's inline `<style>` – import with `?inline`. |

## Rules

1. **Pages extending `base.html`**: return `<BaseLayout title="..." extraCss={pageCss} extraLinks={[...]}>…content block…</BaseLayout>`.
   Put the `{% block extra_css %}` `<style>` contents in `frontend/src/pages/css/<page>.css` and import it with
   `import pageCss from './css/<page>.css?inline'`. `<style>` blocks inside `{% block content %}` stay where
   they are in the markup (render with `<PageStyle css={...} />` at the same position).
2. **Standalone templates** (full `<html>` documents): the page renders its own `<body>` markup. Reproduce the
   `<head>` stylesheets in the same order with `<PageStyle links={[...]} css={[...]} />` as the first child.
   If the template links `{% static 'CSS/style.css' %}`, import `../styles/style.css?inline` and put it in the
   same position in the css array. Large inline `<style>` blocks → `pages/css/<page>.css` (`?inline`).
   Rules on `body`/`html` are fine – the style tag is removed when the page unmounts.
3. **Markup must stay identical**: same elements, classes, ids, inline styles (as JSX objects), text, entities,
   emojis, SVG. `class`→`className`, `for`→`htmlFor`, `tabindex`→`tabIndex`, SVG attrs camelCase
   (`stroke-width`→`strokeWidth`, `fill-rule`→`fillRule`, `xlink:href`→`xlinkHref`, `viewbox`→`viewBox`),
   `style="a:b"` → `style={{ a: 'b' }}`, void tags self-closed, HTML comments → `{/* */}` or dropped.
4. **URLs**: `{% static 'x' %}` → `"/static/x"` (keep the exact path, spaces included).
   `{% url 'name' %}` → path below; internal links use react-router `<Link to>`; in-page anchors
   (`href="#section"`) and external links stay `<a href>`.

   | url name | path | url name | path |
   |---|---|---|---|
   | home | `/` | dashboard | `/dashboard/` |
   | about | `/about/` | admin_dashboard | `/admin-dashboard/` |
   | public_gallery | `/gallery/` | event_list | `/dashboard/events/` |
   | public_events | `/events/` | event_detail | `/dashboard/events/<pk>/` |
   | public_event_detail | `/events/<pk>/` | join_event | POST `/api/events/<pk>/join/` |
   | public_volunteer | `/volunteer-info/` | lifetime_volunteer | `/volunteer/lifetime/` |
   | public_donate | `/donate-info/` | certificate_list | `/certificates/` |
   | public_certificate_verify | `/verify-certificate/` | certificate_detail | `/certificates/<pk>/` |
   | sample_certificate_preview | `/sample-certificate/` | certificate_verify | `/dashboard/verify-certificate/` |
   | signup | `/signup/` | donor_certificate_list | `/certificates/donor/` |
   | login | `/login/` | donor_certificate_detail | `/certificates/donor/<pk>/` |
   | logout | `/logout/` | material_donation | `/donate/material/` |
   | forgot_password | `/forgot-password/` | money_donation | `/donate/money/` |
   | verify_otp | `/verify-otp/` | reset_password | `/reset-password/` |
   | admin:index | `/admin/` | admin:pehchan_&lt;model&gt;_changelist | `/admin/pehchan/<model>/` |

5. **Template logic**: `{% if user.is_authenticated %}` → `useAuth().user`; `{{ user.username }}`,
   `{{ user.get_full_name }}` → `user.full_name`; loops → `.map` with keys; `{% empty %}` → fallback
   branch; `forloop.counter` → index+1. Messages only where the template renders them.
6. **Forms**: controlled inputs. A Django `{{ form.field }}` renders as e.g.
   `<input type="text" name="contact_number" class="form-control" placeholder="..." maxlength="10" minlength="10" required id="id_contact_number">` –
   reproduce the attributes from `forms.py` widgets (`id_<name>`, name, class, placeholder, maxlength,
   required, min/step, accept, rows/cols for textarea = `cols="40" rows="N"`). Show errors exactly where the
   template prints `{{ form.x.errors }}` / `non_field_errors` with the same markup (Django renders
   `{{ form.x.errors }}` as `<ul class="errorlist"><li>msg</li></ul>`). Keep the user's input after a failed
   submit (bound form). Submit through `useApi()` to the endpoint in `docs/API.md`; use `toFormData`
   from `api.js` when a file is involved. Prevent double submits.
7. **Scripts**: port every inline `<script>` (sliders, counters, observers, toggles, copy buttons, password
   eye icons, validation helpers …) to React state/effects with full cleanup. Vanilla DOM code inside a
   `useEffect` is acceptable when it only touches the page's own elements (use refs) and cleans up.
   `static/js/script.js` (used by standalone pages: mobile menu toggle, navbar `.scrolled` on scroll,
   auto-hide `.message`/`.alert-success`/`.alert-error` after 5 s) must be ported too when the template
   includes it.
8. **Data loading**: fetch in `useEffect` with `useApi()`; render the page shell immediately and fill data in.
   On a 404 response render `<Error404 />` (import from `./Error404.jsx`).
   For list pages driven by query params (`?search=`, `?page=`, `?month=`), keep them in the URL with
   `useSearchParams` so links/forms behave like the original GET forms.
9. **Dates/numbers**: every `|date:"..."` → `dateFormat(value, '...')`. `{{ datetime }}` without filter →
   `datetimeFormat(value)`; `{{ date }}` → `dateFormat(value)`. Decimals arrive as strings (`"500.00"`) and
   print as-is like Django.
10. **Do not edit** shared files (`App.jsx`, `main.jsx`, `api.js`, `components/`, `context/`, `hooks/`,
    `utils/`, `styles/`, `docs/`) or pages owned by someone else. If something shared is missing, implement it
    locally inside your page and mention it in your report.
11. Do not run `npm install`, dev servers or `vite build`. Syntax-check each file with
    `node_modules/.bin/esbuild <file> --loader:.jsx=jsx --format=esm --log-level=warning > /dev/null`
    (run from the project root `pehchanyui/`).
