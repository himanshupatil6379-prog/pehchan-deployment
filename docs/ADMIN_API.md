# Admin API contract (Django admin clone)

The React admin (`frontend/src/admin/`) reproduces the Django admin (Django 5 markup +
django-admin-interface 0.32 "Django" theme) on top of these endpoints. All endpoints are
under `/api/admin`, use the normal JSON envelope (`ok`, `messages`, `redirect`, `errors`)
and require an active **staff** user – otherwise `401 {login_required:true}` (show the admin
login page, keep `?next=`) or `403 {permission_denied:true}`.

`<app>/<model>` pairs: `auth/user`, `pehchan/anonymousdonation`, `pehchan/certificate`,
`pehchan/contactmessage`, `pehchan/donorcertificate`, `pehchan/eventvolunteer`, `pehchan/event`,
`pehchan/expense`, `pehchan/lifetimevolunteer`, `pehchan/materialdonation`,
`pehchan/moneydonation`, `pehchan/pehchanwallet`, `pehchan/wallettransaction`.

Front-end admin routes (react-router, mounted at `/admin/*`) mirror Django's URLs:
`/admin/`, `/admin/login/`, `/admin/logout/`, `/admin/password_change/`,
`/admin/password_change/done/`, `/admin/<app>/`, `/admin/<app>/<model>/`,
`/admin/<app>/<model>/add/`, `/admin/<app>/<model>/<id>/change/`,
`/admin/<app>/<model>/<id>/delete/`, `/admin/<app>/<model>/<id>/history/`,
`/admin/<app>/<model>/<id>/` (→ redirect to change), `/admin/auth/user/<id>/password/`,
`/admin/pehchan/eventvolunteer/issue-certificate/<id>/`,
`/admin/pehchan/materialdonation/issue-certificate/<id>/`,
`/admin/pehchan/moneydonation/issue-certificate/<id>/`.
Any other `/admin/...` URL → admin "Page not found" (staff) or redirect to login.

The API path for a page is always `/api` + the page path (e.g. page
`/admin/pehchan/event/3/change/` → API `/api/admin/pehchan/event/3/change/`), and the page's
query string is forwarded unchanged.

## Session

| | |
|---|---|
| `GET /api/admin/session/` | `{ ok, user: User|null, site_header:"Django administration", site_title:"Django site admin", index_title:"Site administration", theme:{...} }` (works for anonymous users). `theme` = django-admin-interface theme values: `title`, `title_color`, `css_header_background_color`, `css_header_text_color`, `css_header_link_color`, `css_header_link_hover_color`, `css_module_background_color`, `css_module_text_color`, `css_module_link_color`, `css_module_link_hover_color`, `css_module_rounded_corners`, `css_generic_link_color`, `css_generic_link_hover_color`, `css_generic_link_active_color`, `css_save_button_background_color`, `css_save_button_background_hover_color`, `css_save_button_text_color`, `css_delete_button_background_color`, `css_delete_button_background_hover_color`, `css_delete_button_text_color`, `css_module_background_selected_color`, `css_module_link_selected_color`, `list_filter_dropdown`, `list_filter_sticky`, `list_filter_highlight`, `list_filter_removal_links`, `foldable_apps`, `recent_actions_visible`, `form_submit_sticky`, `form_pagination_sticky`, `logo_color`, `logo_visible`, `title_visible`, `env_name`, `env_color`, `env_visible_in_header`, `language_chooser_active:false`, `related_modal_active` |
| `POST /api/admin/login/` `{username,password}` | ok → `{ user }`. Failure → 400 `errors.__all__ = ["Please enter the correct username and password for a staff account. Note that both fields may be case-sensitive."]` (also for non-staff users). Empty fields → `errors.username/password = ["This field is required."]` |
| `POST /api/admin/logout/` | `{ ok, user:null }` – page shows Django's "Logged out" page ("Thanks for spending some quality time with the web site today." + "Log in again"). |
| `POST /api/admin/password_change/` `{old_password,new_password1,new_password2}` | ok → redirect `/admin/password_change/done/` ("Password change successful" / "Your password was changed."). Errors keyed by field (Django messages: `Your old password was entered incorrectly. Please enter it again.`, `The two password fields didn’t match.`, password validators on `new_password2`). `GET` returns `{ help_texts: [...] }` |

## Index / app index

`GET /api/admin/` and `GET /api/admin/<app>/`:

```jsonc
{
  "ok": true,
  "title": "Site administration",          // app index: "Pehchan administration"
  "app_list": [{
    "app_label": "auth", "name": "Authentication and Authorization", "app_url": "/admin/auth/",
    "models": [{ "object_name": "User", "model": "user", "name": "Users",
                 "admin_url": "/admin/auth/user/", "add_url": "/admin/auth/user/add/" | null,
                 "view_only": false }]
  }],
  "recent_actions": [{ "action_flag": 1|2|3, "object_repr": "Food drive - 2026-12-01",
                       "content_type_name": "event", "url": "/admin/pehchan/event/3/change/" | null }]
}
```
(`recent_actions` = the current user's last 10 log entries; `url` null for deletions.)
The nav sidebar on every admin page uses the same `app_list` (fetch `/api/admin/` once and cache).

## Change list

`GET /api/admin/<app>/<model>/?<django changelist params>` (`q`, `o`, `p`, `all`, filters like
`status__exact=pending`, date hierarchy `created_at__year=2026&created_at__month=11`, `_popup` not used)

```jsonc
{
  "ok": true,
  "model": { "app_label":"pehchan", "model":"event", "verbose_name":"event", "verbose_name_plural":"events",
             "has_add":true, "has_change":true, "has_delete":true, "has_view":true },
  "title": "Select event to change",          // "Select wallet transaction to view" when view-only
  "query": "status__exact=upcoming",          // current query string (no leading "?")
  "columns": [{ "key":"name", "label":"Name", "sortable":true,
                "sorted": null|"ascending"|"descending", "sort_priority": 1|null,
                "sort_query":"?o=1", "remove_query":"?o=" , "toggle_query":"?o=-1" }],
  "rows": [{ "id": 3, "change_url": "/admin/pehchan/event/3/change/?_changelist_filters=…",
             "cells": [Cell, ...] }],         // first cell is the link to change_url
  "list_editable": ["status","attended"],     // editable cells come as type "editable"
  "search": { "enabled": true, "q": "" },
  "filters": [{ "title": "status", "choices": [{ "display":"All", "query":"?", "selected":true }] }],
  "has_active_filters": false, "clear_all_filters_query": "?",
  "date_hierarchy": null | { "back": null|{ "label":"‹ All dates", "query":"?..." },
                              "choices": [{ "label":"2026", "query":"?created_at__year=2026" }] },
  "actions": [{ "name":"delete_selected", "description":"Delete selected events" },
              { "name":"export_as_csv", "description":"Download selected as CSV" }],
  "result_count": 12, "full_result_count": 40, "show_full_result_count": true,
  "pagination": { "page":1, "num_pages":1, "per_page":100, "multi_page":false,
                  "can_show_all":false, "show_all":false, "show_all_query":"?all=",
                  "pages":[ { "number":1, "query":"?p=1", "current":true } | { "ellipsis":true } ] }
}
```

`Cell` types:
* `{ "type":"text", "text":"Nov. 17, 2026, 7:03 p.m." }` (empty values arrive as `"-"`)
* `{ "type":"bool", "value": true|false|null }` → Django's `icon-yes.svg` / `icon-no.svg` / `icon-unknown.svg`
* `{ "type":"html", "html":"<span style=…>NEW</span>" }` – trusted, server-generated (format_html output)
* `{ "type":"link", "text":"Issue Certificate", "href":"/admin/…", "className":"button", "target":"_blank" }`
* `{ "type":"editable", "field":"status", "input":"select"|"checkbox", "value":"pending", "choices":[["pending","Pending"],…] }`

Actions: `POST /api/admin/<app>/<model>/action/?<query>` JSON
`{ action, selected:[ids], select_across:false, post:"yes"? }`
* no action / no selection → `{ ok:false, messages:[warning "No action selected." | "Items must be selected in order to perform actions on them. No items have been changed."] }`
* `delete_selected` without `post:"yes"` → `{ ok:true, confirm:{ title:"Are you sure?", objects_name:"events", deleted_objects:[Nested], model_count:[["Events",2],["Event volunteers",3]], perms_lacking:[], protected:[] } }`
  → render Django's delete_selected_confirmation page, "Yes, I’m sure" re-posts with `post:"yes"`.
* export actions return a **file** (`Content-Disposition: attachment`) instead of JSON – check the content type and download it.
* other actions → `{ ok, messages, redirect? }` (e.g. single "Issue Certificate" redirects to the issue page).

`Nested` = list where each item is `{ "text":"Event: <a href=…>Food drive</a>", "html":true, "children":[Nested] }`.

Bulk edit (list_editable "Save" button): `POST /api/admin/<app>/<model>/list-edit/?<query>`
`{ rows:[{ id, values:{ status:"approved", attended:true } }] }` →
ok: `{ messages:[success "2 event volunteers were changed successfully."] }`;
error: 400 `{ row_errors:{ "<id>":{ field:[msg] } }, messages:[error "Please correct the errors below."] }`.

## Add / change / view form

`GET /api/admin/<app>/<model>/add/` or `/<id>/change/`:

```jsonc
{
  "ok": true,
  "title": "Add event" | "Change event" | "View wallet transaction",
  "object_id": 3 | null, "object_repr": "Food drive - 2026-12-01",
  "model": { ...as above },
  "view_only": false,
  "has_delete": true, "delete_url": "/admin/pehchan/event/3/delete/", "history_url": "/admin/pehchan/event/3/history/",
  "changelist_url": "/admin/pehchan/event/",
  "save_buttons": { "save":true, "save_and_add_another":true, "save_and_continue":true },
  "fieldsets": [{ "name": null | "Donor Information", "classes": [] | ["collapse"], "description": null | "Internal notes - not visible to the sender",
                  "fields": [Field] }],
  "extra": { "quick_reply": { "name":"Ravi", "email":"ravi@x.com" } }    // contactmessage change_form.html only
}
```

`Field`:
```jsonc
{ "name":"event_date", "label":"Event date", "type":"date", "required":true, "readonly":false,
  "help_text":"", "value":"2026-12-01", "choices":null, "max_length":null }
```
Field `type`s and how to render them (Django widgets):
* `char` (`<input type="text" class="vTextField" maxlength>`), `email` (`type="email" class="vTextField"`),
  `text` (`<textarea class="vLargeTextField" cols="40" rows="10">`), `int` (`type="number" class="vIntegerField"`),
  `decimal` (`type="number" class="vDecimalField" step="0.01"`),
  `ip` (`class="vTextField" maxlength="39"`),
* `date` – `<input type="text" class="vDateField" size="10">` + "Today | 📅" shortcuts (value `YYYY-MM-DD`). Event/Expense use native `type="date"` inputs.
* `datetime` – value `{date:"YYYY-MM-DD", time:"HH:MM:SS"}` (Asia/Kolkata); POST as `<name>_0` (date) and `<name>_1` (time). Admin uses native `type="date"`/`type="time"` (NativeDateTimeWidget) for Event and Expense, Django's split widget elsewhere ("Date:" / "Time:" + Today/Now shortcuts, note "Note: You are 5.5 hours ahead of server time." is NOT shown).
* `bool` – checkbox (`vCheckboxLabel` label after the input)
* `select` – `choices` `[[value,label]]` incl. `["", "---------"]` when optional
* `fk` – `<select>` with `choices` (`[["","---------"],[id, str]]`) + related-widget-wrapper links (change/add/view icons)
* `file` / `image` – value `{ name:"receipts/a.png", url:"/media/receipts/a.png" } | null`; render
  "Currently: <a>name</a> [ ] Clear  Change: <input type=file>". POST the file under the field name and `<name>-clear=on` to clear.
* `readonly` fields come with `display` (already formatted text) or `display_html` (trusted HTML) and no input.
* `password_hash` (User change form) – `display_html` shows algorithm/iterations/salt/hash + the help text with a link to `../password/`.
* `password` (User add form: `password1`, `password2`).

`POST` the same URL as **multipart** with every field plus one of `_save`, `_continue`,
`_addanother`, `_save_and_send_reply` (with `reply_message`). Booleans: send `on` when checked.
Success → `{ ok, messages:[...], redirect }` (Django messages: `The event “X” was added successfully.`,
`… was changed successfully.`, `… You may edit it again below.`, `… You may add another event below.`).
Errors → 400 `{ errors:{ field:[...], __all__:[...] }, messages:[] }` – render
"Please correct the error below." / "Please correct the errors below." note + `errorlist`s and keep
the user's input.

## Delete / history

* `GET /api/admin/<app>/<model>/<id>/delete/` → `{ title:"Are you sure?", object_repr, model:{...}, deleted_objects:[Nested], model_count:[["Events",1]], perms_lacking:[], protected:[] }`
* `POST` same → `{ messages:[success "The event “X” was deleted successfully."], redirect:"/admin/pehchan/event/" }`
* `GET /api/admin/<app>/<model>/<id>/history/` → `{ title:"Change history: X", object_repr, actions:[{ action_time, user:"admin", user_full_name:"", change_message:"Changed Status." }] }`

## Custom pages

* `GET /api/admin/pehchan/eventvolunteer/issue-certificate/<id>/` →
  `{ title:"Issue Volunteer Certificate", certificate_type:"Volunteer", year:2026,
     volunteer:{ user_full_name, username, event_name, status_display, joined_at }, cancel_url }`
  or (already issued / not staff) `{ ok:false, messages:[error "A certificate already exists for this volunteer."], redirect:"/admin/pehchan/eventvolunteer/" }`.
  `POST` multipart `certificate_file` (optional) → `{ messages:[success "Certificate issued successfully for <username>."], redirect }`.
* `…/materialdonation/issue-certificate/<id>/` → `certificate_type:"Material Donation"`, `title:"Issue Material Donation Certificate"`,
  `donation:{ kind:"material", user_full_name, username, item_name, quantity, location, status_display, created_at }`.
* `…/moneydonation/issue-certificate/<id>/` → `certificate_type:"Donor (Money)"`, `title:"Issue Money Donation Certificate"`,
  `donation:{ kind:"money", user_full_name, username, amount, payment_method_display, created_at }`.
  The page renders `templates/admin/issue_certificate.html` inside the admin chrome.
* `GET/POST /api/admin/auth/user/<id>/password/` `{password1,password2}` → title `Change password: <username>`,
  success message `Password changed successfully.` + redirect to the user change page.
