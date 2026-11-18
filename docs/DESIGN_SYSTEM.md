# Pehchan dashboards – Material Design 3 system

Applies **only** to the Admin Panel (`/admin/*`) and the logged-in User Dashboard area.
The public website, login/signup/password pages, certificate verification and sample
certificate pages keep their original Django look and must not change.

## Files

| File | Purpose |
|---|---|
| `frontend/src/styles/md3.css` | tokens (`--md-sys-*`, light + dark) and components (`.md-*`). Import with `?inline` and render through `<PageStyle>` so it only exists while a dashboard is mounted. Read it before writing markup. Do not edit it – add page-specific CSS in your own files. |
| `frontend/src/components/PageStyle.jsx` | `<PageStyle links={[...]} css={[...]} />`, `FONTS.materialIconsRound`, `FONTS.interJakarta` |

## Foundations

- **Colour**: Pehchan navy primary (`--md-sys-color-primary`), tonal containers for emphasis,
  semantic `success / warning / error / info` containers for statuses. No large gradients.
- **Type**: Plus Jakarta Sans for titles (`--md-sys-typescale-brand`), Inter for body/UI.
- **Icons**: Material Icons Round (the icon font the project already uses) via
  `<span className="md-icon" aria-hidden="true">event</span>`.
- **Shape**: cards 16px, fields 8px, chips 8px, buttons/nav items full pill, dialogs 28px.
- **Elevation**: `--md-sys-elevation-1..4`, mostly level 1 on cards, 3–4 on menus/dialogs.
- **Dark mode**: tokens switch when `<html data-theme="dark">` (or `auto` + OS dark). Only the admin
  sets `data-theme` (its existing theme toggle); it must remove the attribute on unmount.
- **Body**: layouts add `md3-body` to `<body>` while mounted and remove it on unmount.

## Shell

`.md-app` grid = `.md-nav-drawer.md-app__drawer` + `.md-scrim` (must be the drawer's next sibling) +
`.md-top-app-bar.md-app__bar` + `<main class="md-app__main"><div class="md-app__content">`.
Drawer becomes a rail at 840–1199px and a modal drawer below 840px (toggle `.is-open`,
menu button `.md-top-app-bar__menu-btn`, close on scrim click / Escape / navigation).

## Status → chip mapping

| Status | Chip |
|---|---|
| approved, verified, received, replied, completed, active | `md-chip--success` |
| pending, unverified, new, upcoming | `md-chip--warning` (upcoming → `md-chip--info`) |
| rejected, declined, inactive | `md-chip--error` |
| processed, read, ongoing | `md-chip--primary` |
| archived, other | `md-chip--neutral` |

## Rules

1. UI only. Keep every API call, query parameter, handler, form field `name`, validation message,
   redirect, flash message, permission check and route exactly as it is.
2. Keep every existing link, button, form, filter, search, sort, pagination, dialog and action reachable on
   every screen size (nothing hidden on mobile without an alternative).
3. Accessibility: semantic elements, `<label htmlFor>` for inputs, `aria-label` on icon-only buttons,
   `aria-current="page"` on the active nav item, visible focus (`:focus-visible` is styled), touch targets ≥ 40px.
4. Real data must look right: long names truncate with `title` tooltips, large numbers use tabular figures,
   empty values show a muted "—", empty lists show an `.md-empty` state, loading shows skeletons/spinner.
