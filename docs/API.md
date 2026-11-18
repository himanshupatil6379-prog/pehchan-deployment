# Pehchan API contract

The Express backend replaces the Django views one-to-one. Every page of the React
frontend talks to these endpoints through `useApi()` (`frontend/src/hooks/useApi.js`).

## Envelope

Every response is JSON:

```jsonc
{
  "ok": true,                       // false on validation / permission errors
  "messages": [{ "level": "success", "text": "..." }],   // django.contrib.messages (levels: success|error|warning|info)
  "redirect": "/dashboard/",        // HttpResponseRedirect – useApi() navigates automatically
  "user": { ... } | null,           // present only when the auth state changed
  "errors": { "field": ["msg"], "__all__": ["msg"] },    // form.errors (HTTP 400)
  "...": "page data"
}
```

* HTTP 400 → form errors (`errors`), HTTP 401 → login required (`redirect: "/login/?next=..."`),
  HTTP 403 → not staff, HTTP 404 → `{ ok:false, not_found:true }` (render `<Error404/>`).
* Mutating requests must send header `X-Requested-With: XMLHttpRequest` (done by `apiFetch`).
* Multipart (`formData`) is used for every form that has a file input.
* Auth is a session cookie (`sessionid`, 30 days, HttpOnly) – nothing to store client side.

## Serialized objects

All decimals are strings with 2 places (`"500.00"`), dates are `"YYYY-MM-DD"`,
datetimes are ISO-8601 UTC strings – render them with `dateFormat()` from
`frontend/src/utils/filters.js` (Django `|date` port, Asia/Kolkata).
File fields are absolute URLs (`"/media/receipts/x.png"`) or `null`.

```jsonc
UserLite      { id, username, first_name, last_name, full_name, email }
User          UserLite + { is_staff, is_superuser, is_active, date_joined, last_login }
Event         { id, name, description, event_date, location, image, is_active, fundraising_goal|null,
                status, status_display /* live: Upcoming|Ongoing|Completed */, created_by: UserLite|null,
                created_at, updated_at }
EventVolunteer{ id, event: Event, user: UserLite, contact_number, joined_at, status, status_display, attended }
Certificate   { id, certificate_number|null, issue_date, file, event: Event,
                volunteer: { id, status, status_display, attended, joined_at, user: UserLite } }
MaterialDonation { id, item_name, quantity, location, contact_number, message, status, status_display,
                   created_at, pickup_message, user: UserLite }
MoneyDonation { id, amount, payment_method, payment_method_display, upi_id, contact_number, receipt_upload,
                status, status_display, created_at, event: {id,name}|null, user: UserLite }
DonorCertificate { id, certificate_number, donation_type, donation_type_display, issue_date, issued_by,
                   remarks, file, created_at, updated_at, user: UserLite,
                   material_donation: MaterialDonation|null, money_donation: MoneyDonation|null,
                   donation_details /* get_donation_details(): "Rice (Qty: 5)" | "Rs. 500.00" | "N/A" */ }
PageObj       { number, num_pages, count, has_previous, has_next, previous_page_number|null,
                next_page_number|null, start_index, end_index }
```

## Auth

| Method | Path | Body | Behaviour (mirrors Django view) |
|---|---|---|---|
| GET | `/api/auth/me/` | – | `{ user }` |
| POST | `/api/auth/signup/` | `username,email,first_name,last_name,password1,password2, context?` | success → `user`, msg `Registration successful! Welcome to Pehchan.`, redirect `/dashboard/`. errors → 400 `errors` + msg `Please correct the errors below.` With `context:"donate"` the error messages are instead one message per error: `"<Field Name>: <error>"` (`password2` → `Confirm Password`, `__all__` → bare error). |
| POST | `/api/auth/login/` | `username,password, context?` | success → msg `Welcome back, <username>!`, redirect `/dashboard/`. failure → 400, `errors.__all__ = ["Please enter a correct username and password. Note that both fields may be case-sensitive."]`, msg `Invalid username or password.` (`context:"donate"` → `Invalid username or password. Please try again.`, no `errors`). |
| POST | `/api/auth/logout/` | – | `user:null`, msg `You have been logged out successfully.`, redirect `/` |
| POST | `/api/auth/forgot-password/` | `email` | 60-second cooldown → 400 warning `Please wait at least 60 seconds before requesting another OTP.`; mail failure → error msg + redirect `/forgot-password/`; otherwise msg `If an account exists with this email address, an OTP has been sent.` + redirect `/verify-otp/`. Invalid email → 400 `errors.email`. |
| GET | `/api/auth/verify-otp/` | – | guard: if flow not started → error msg `Invalid request. Please try again.` + redirect `/forgot-password/`; if ≥5 attempts → `Too many incorrect attempts. Please request a new OTP.` + redirect. Else `{ ok:true }` |
| POST | `/api/auth/verify-otp/` | `otp` | success → msg `OTP verified successfully.` redirect `/reset-password/`. wrong → 400 msg `Invalid or expired OTP. You have N attempt(s) remaining.`; last attempt → redirect `/forgot-password/`. |
| GET | `/api/auth/reset-password/` | – | guard → error `Please verify your OTP first.` + redirect `/forgot-password/` |
| POST | `/api/auth/reset-password/` | `new_password, confirm_password` | success → msg `Your password has been reset successfully. You can now login with your new password.` redirect `/login/`. errors → 400 `errors` **and** one error message per error. |

## Public

| Method | Path | Notes |
|---|---|---|
| POST | `/api/contact/` | `name,email,message,source` (`home`/`dashboard`). home: success msg `Thank you for your message! We will get back to you soon.` + redirect `/`; error msg `Please correct the errors in the form.` dashboard: success `Your message has been sent successfully. We will get back to you soon!` + redirect `/dashboard/`; error `There was an error with your message. Please check the form and try again.` Errors in `errors`. |
| GET | `/api/events/public/?search=` | `{ events: Event[], search_query }` – `event_date >= today`, ordered by date. |
| GET | `/api/events/public/:pk/` | `{ event, already_joined, show_volunteer_form, total_raised, progress_percentage }` (404 if missing). `total_raised` is a string (`"0"` or `"1500.00"`), progress is an int 0–100 (only when the event has a fundraising goal). |
| POST | `/api/donate/anonymous/` | multipart: `donor_name, donor_email, donor_phone, amount, transaction_id, receipt(file), wants_receipt("on"), message`. Success msg `Thank you for your anonymous donation! Your contribution has been recorded.` + redirect `/donate-info/`. Error → 400 `errors` + msg `Please fill in the required fields correctly.` |
| GET | `/api/certificates/verify/?cert_id=` | QR-code flow. `{ searched, certificate: Certificate|null, donor_certificate: DonorCertificate|null, sample_verified?, sample_data? }`; not found → msg `No certificate found with that ID.` |
| POST | `/api/certificates/verify/` | `certificate_id` – same response. Empty id → 400 `errors.certificate_id = ["This field is required."]`. |
| GET | `/api/config/` | `{ donation_upi_id }` |

`sample_data` (only for id `PYUI/2026/V/0042` when not in DB):
`{ certificate_number, volunteer_name:"Aniksha Upadhyay", event_name:"Youth Empowerment Drive 2026", event_date:"November 03, 2026", location:"Mumbai", issue_date:"November 03, 2026", reg_no:"E-0015289 (THN)" }`.

The sample certificate page (`/sample-certificate/`) needs no API – all values come from the query string.

## Logged-in user (401 + redirect to `/login/?next=` when anonymous)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/dashboard/?upcoming_search=&joined_search=` | `{ upcoming_events: Event[], joined_events: EventVolunteer[], managed_events: Event[]|null (staff only, max 5), certificates: Certificate[], donor_certificates: DonorCertificate[], material_donations: MaterialDonation[], money_donations: MoneyDonation[], is_lifetime_volunteer, lifetime_volunteer: {status,status_display}|null, upcoming_search, joined_search }` |
| GET | `/api/admin-dashboard/` | staff only (else msg `Access denied. Admin privileges required.` + redirect `/dashboard/`). `{ total_users_count, active_volunteers_count, upcoming_events_count, money_display, recent_users: User[], recent_events: Event[] }` |
| GET | `/api/events/?search=&page=` | 3 per page. `{ events: Event[], search_query, is_paginated, page_obj: PageObj }`; invalid page → 404. |
| GET | `/api/events/:pk/` | `{ event, already_joined, show_volunteer_form }` |
| POST | `/api/events/:pk/join/` | `contact_number`. Already joined → warning `You have already joined this event!`; success → `Successfully joined <name> as a volunteer!`; invalid → one error msg per error. Always redirect `/dashboard/events/:pk/`. |
| POST | `/api/volunteer/lifetime/` | `contact_number, motivation`. Errors → 400 `errors`. Already applied → warning `You have already applied to become a lifetime volunteer!`; success → `Your application to become a lifetime volunteer has been submitted. It is pending approval.`; both redirect `/dashboard/`. |
| GET | `/api/certificates/?search=&month=&sort=newest|oldest&page=` | 5 per page. `{ certificates, search_query, current_month, current_sort, months, is_paginated, page_obj }` |
| GET | `/api/certificates/:pk/` | `{ certificate }` (only own, else 404) |
| GET | `/api/certificates/donor/?search=&month=&sort=&page=` | `{ donor_certificates, ...same }` |
| GET | `/api/certificates/donor/:pk/` | `{ certificate }` |
| POST | `/api/donations/material/` | `item_name, quantity, location, contact_number, message`. Success msg `🌟 Thanks for your contribution! ❤️ You will receive a confirmation email once your donation is processed. ✨ <pickup message>` + redirect `/dashboard/`. |
| GET | `/api/donations/money/` | `{ upi_id }` |
| POST | `/api/donations/money/` | multipart `amount, contact_number, receipt_upload`. Success msg `🌟 Thanks for your contribution! ❤️ You will receive a confirmation email once your donation is processed. ✨` + redirect `/dashboard/`. |

Validation messages are the Django ones, e.g. `This field is required.`,
`Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.`,
`Ensure this value is greater than or equal to 0.01.`

## Admin (`/api/admin/...`)

See `docs/ADMIN_API.md`.
