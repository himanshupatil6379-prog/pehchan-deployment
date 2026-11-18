# Pehchan – Empowering Communities

Web application of **Pehchan YUI Foundation**, an NGO that runs community events, works with
volunteers, collects material and money donations and issues verifiable certificates.

It is the MERN-style rebuild (React + Node.js/Express + **MySQL**) of the original Django project, made
to run on Hostinger. Pages, URLs, texts, validation rules, certificate numbers and the admin panel
behave like the Django version, and users imported from the old database keep their passwords.

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router (`frontend/`) |
| Backend | Node.js, Express (`backend/`) |
| Database | MySQL 8 via Sequelize (same table names as the Django schema) |
| UI | Original Pehchan website design + Material Design 3 for the user dashboard and admin panel |

---

## Contents

1. [Who uses the application](#1-who-uses-the-application)
2. [User stories](#2-user-stories)
3. [What happens automatically](#3-what-happens-automatically)
4. [Running the project locally](#4-running-the-project-locally)
5. [Running in production](#5-running-in-production)
6. [Deploying on Hostinger](#6-deploying-on-hostinger)
7. [Moving data from the old Django site](#7-moving-data-from-the-old-django-site)
8. [Configuration reference](#8-configuration-reference)
9. [Project structure](#9-project-structure)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Who uses the application

| Role | Who | How they get the role |
|---|---|---|
| **Visitor** | Anyone opening the website | – |
| **Member** | A person with an account (volunteer and/or donor) | Signs up at `/signup/` |
| **Staff** | NGO team member | An admin ticks *Staff status* on the user |
| **Admin** | NGO administrator | Superuser – created with `npm run create-admin` or by another admin (*Superuser status*) |

> Staff users can open the **Admin Overview** page. The **Admin Panel** (`/admin/`) lets them sign in,
> but only superusers can view and manage data there (there are no per-model permissions or groups).

---

## 2. User stories

### 2.1 Visitor (not logged in)

**Learning about Pehchan**
- As a visitor, I can open the **home page** (`/`) to read about Pehchan's mission, causes and activities.
- As a visitor, I can read the **About Us** page (`/about/`) about the foundation and its team.
- As a visitor, I can browse the **Gallery** (`/gallery/`) of photos from past drives (education,
  environment, poverty relief, Utsav and memorable moments).
- As a visitor, I can read the **Volunteer** page (`/volunteer-info/`) to see how I can help.
- As a visitor, I can send a **message to the team** from the contact form on the home page
  (name, email, message). The team can reply to me by email from the admin panel.

**Events**
- As a visitor, I can see all **upcoming and ongoing events** at `/events/` and **search** them by
  name, description or location.
- As a visitor, I can open an **event's details** (`/events/<id>/`) – date, location, description,
  image, status – and, if the event has a fundraising goal, see **how much has been raised** (verified
  donations) and the progress percentage.
- As a visitor, I am asked to **log in or sign up** to join an event as a volunteer.

**Donating without an account**
- As a visitor, I can open the **Donate** page (`/donate-info/`) to see how to donate. The
  *Login to Donate* tab asks me to log in to donate materials or money; the *Donate as Anonymous* tab
  lets me pay without an account using the Pehchan **UPI QR code and UPI ID** (with a note that an
  account is recommended for tax benefits and tracking).

**Certificates**
- As a visitor (or employer/institution), I can **verify a certificate** at `/verify-certificate/` by
  entering its certificate number, or by scanning the QR code printed on it
  (`/verify-certificate/?cert_id=PYUI/2026/V/0001`). For a genuine certificate I see the holder's
  name, the event or donation, and the issue date; otherwise I see *"No certificate found with that ID."*
- As a visitor, I can view a **sample certificate** (`/sample-certificate/`) to see what a
  Pehchan certificate looks like (sample number `PYUI/2026/V/0042` verifies as a demo).

**Account**
- As a visitor, I can **create an account** (`/signup/`) with username, first name, last name, email
  and password. The form rejects:
  - usernames that are taken or contain characters other than letters, digits and `@ . + - _`;
  - emails that are already registered or use disposable domains (e.g. `mailinator.com`);
  - names shorter than 2 letters;
  - weak passwords (too short, too common, all numbers, or too similar to my name/username/email).
- As a visitor, I can **log in** (`/login/`) with username and password.
- As a visitor who forgot the password, I can **reset it by email OTP**:
  1. enter my email at `/forgot-password/` – a 6-digit OTP is mailed (valid **10 minutes**; a new OTP can be
     requested after **60 seconds**; the page never reveals whether the email exists),
  2. enter the OTP at `/verify-otp/` (**5 attempts**, after that I must request a new OTP),
  3. choose a new password at `/reset-password/` and log in again.

### 2.2 Member (logged in)

After logging in I land on **My Dashboard** (`/dashboard/`). A side menu (a drawer on mobile) gives
access to every page; my name menu in the top bar has **Logout**.

**Dashboard**
- As a member, I see a **welcome card**, quick links, and counters for upcoming events, events I joined,
  certificates earned and donations made.
- As a member, I can **search upcoming events** and **search the events I joined** right from the dashboard.
- As a member, I can see my **volunteer certificates**, **donor certificates**, **donation history**
  (material and money, with their status) and my **lifetime volunteer** status.
- As a member, I can **send a message** to the team from the dashboard contact card.

**Volunteering at events**
- As a member, I can list upcoming events (`/dashboard/events/`, 3 per page) with search.
- As a member, I can open an event (`/dashboard/events/<id>/`) and **join it as a volunteer** by entering
  my mobile number (a valid 10-digit Indian number starting with 6–9; fake patterns like `9999999999`
  are rejected). I can join each event only once.
- As a member, I can see my joined events with their status – **Pending** until the team approves me,
  then **Approved**.

**Lifetime volunteer**
- As a member, I can **apply to become a lifetime volunteer** (`/volunteer/lifetime/`) with my mobile
  number and motivation. My application is **Pending** until an admin approves or rejects it. I can apply only once.

**Donating items**
- As a member, I can **donate materials** (`/donate/material/`) – item name, quantity, my location, mobile
  number and an optional message. After a confirmation pop-up the donation is recorded and I'm told
  what happens next:
  - location **Mumbai** → *"Pehchan team will pick up your material."*
  - any other location → *"Please courier your material to our office."*
- As a member, I can follow its status: **Pending → Received → Processed**.

**Donating money**
- As a member, I can **donate money by UPI** (`/donate/money/`): the page shows Pehchan's UPI ID and QR
  code; I pay in my UPI app, then submit the amount, my mobile number and the **payment receipt**
  (JPG, PNG, WEBP or PDF, max 5 MB).
- As a member, I can follow its status: **Unverified → Verified** (or **Declined**).

**Certificates**
- As a member, I can list my **volunteer certificates** (`/certificates/`) and my **donor certificates**
  (`/certificates/donor/`), 5 per page, with **search** (certificate number, event name / item / type),
  **filter by month** and **sort** (newest/oldest).
- As a member, I can open a certificate's **details** and **view/download the certificate file** when the
  team has attached one.
- As a member, I receive my certificate **by email** (with the file attached) when it is issued.
- As a member, I can **verify any certificate** from the dashboard (`/dashboard/verify-certificate/`).

### 2.3 Staff

Everything a member can do, plus:
- As staff, I see **Admin Overview** (`/admin-dashboard/`): total users, active (approved) volunteers,
  upcoming events, total money donated, recent users and recent events, with shortcuts into the admin panel.
- As staff, my dashboard shows the **events I created** with a shortcut to add a new event.

### 2.4 Admin (superuser) – Admin Panel at `/admin/`

The admin panel is a full management console (Material Design 3, light/dark/auto theme). Every list has
**search, filters, date drill-down, sortable columns, pagination, bulk actions** and **CSV / Excel export**;
every record has **add / edit / delete** and a **change history**. The home page shows all modules and
my **recent actions**.

**Users**
- As an admin, I can create users (username + password), edit their details, **activate/deactivate**
  them, make them **Staff** or **Superuser**, and **set a new password** for any user.
- As an admin, I can change my own password (`/admin/password_change/`).

**Events**
- As an admin, I can create and edit events: name, description, date, location, image, active flag and an
  optional **fundraising goal**. The status (Upcoming / Ongoing / Completed) is set automatically from the date.

**Event volunteers**
- As an admin, I can see everyone who joined each event, filter by status / attended / date / event, and
  **approve** them and mark them **attended** directly in the list (inline edit + Save).
- As an admin, I can **issue a volunteer certificate** to an approved volunteer who attended – one at a time
  with an optional certificate file (PDF/JPG/PNG), or in bulk with the *Issue Certificate* action.
  Certificate numbers are generated automatically: `PYUI/<year>/V/0001`, `0002`, …

**Lifetime volunteers**
- As an admin, I can review applications and **approve** or **reject** them (bulk actions); the review date
  and reviewer are recorded.

**Material donations**
- As an admin, I can update a donation's status (Pending / Received / Processed) and, once it is
  **Received**, **issue a donor certificate** (`PYUI/<year>/D/0001`, …) with an optional file.

**Money donations**
- As an admin, I can open the uploaded receipt, mark donations **Verified** or **Declined** (bulk actions),
  and for verified donations **issue a donor certificate**.

**Certificates & donor certificates**
- As an admin, I can view, search, edit and export all volunteer and donor certificates, attach or replace
  certificate files, and add remarks.

**Contact messages**
- As an admin, I can read messages from the website, set their **status** (New / Read / Replied / Archived)
  and **priority** (Low / Medium / High / Urgent), keep **internal notes**, and **reply by email** with the
  *Quick Reply* box (the reply is saved and the message is marked Replied). Bulk actions: mark as read,
  mark as replied, archive, set priority, send the saved reply by email.

**Money management**
- As an admin, I can see the **Pehchan Wallet** balance.
- As an admin, I can see every **wallet transaction** (read-only ledger: donations in, expenses out, balance after each).
- As an admin, I can record **expenses** (title, category, amount, date, receipt, approval). Saving an expense
  withdraws the amount from the wallet; it is refused with *"Insufficient funds in wallet"* if the balance is too low.

**Anonymous donations**
- As an admin, I can record and manage donations received without an account (donor name/email/phone are optional,
  amount, UPI transaction ID, receipt, whether the donor wants a receipt).

---

## 3. What happens automatically

| Trigger | Result |
|---|---|
| A money donation is submitted | Amount is **deposited into the Pehchan Wallet** and a wallet transaction is recorded |
| An expense is saved | Amount is **withdrawn from the wallet** (blocked if funds are insufficient) |
| A volunteer / donor certificate is issued | Next number `PYUI/<year>/V/…` or `PYUI/<year>/D/…` is assigned and the certificate is **emailed** to the user |
| An event is saved | Status is set from the date: past → Completed, today → Ongoing, future → Upcoming |
| A user changes/resets their password | Their other logged-in sessions are signed out |
| Any admin add / change / delete | Logged in the object's **History** and the admin's **Recent actions** |

Emails need SMTP settings (see [Configuration](#8-configuration-reference)); without them everything else
works, but OTP, certificate and reply emails are not sent.

---

## 4. Running the project locally

### 4.1 Requirements

- **Node.js** 18.18 or newer (20 or 22 recommended) and npm
- **MySQL 8** running locally (default `127.0.0.1:3306`)
- Git

### 4.2 Setup

```bash
# 1. get the code
git clone https://github.com/engineersurajsahani/pehchanyui.git
cd pehchanyui

# 2. install dependencies (frontend and backend share one package.json)
npm install

# 3. create your environment file
cp .env.example .env
```

Edit `.env` – the minimum for local development:

```env
DEBUG=True
SECRET_KEY=any-long-random-string
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=pehchan
DB_USER=root
DB_PASSWORD=your-mysql-password
```

```bash
# 4. create the database, all tables and the admin account
#    (uses ADMIN_USERNAME / ADMIN_EMAIL / ADMIN_PASSWORD from .env; also happens automatically on start)
npm run setup

# 5. (optional) create/update another superuser or reset the admin password
npm run create-admin -- --username admin --email admin@pehchanyui.in --password "YourStrongPassword"

# 6. (optional) demo data: users rahul_sharma / priya_volunteer, the "Prarambh" event,
#    a volunteer enrolment and a certificate (passwords are printed by the script)
npm run populate
```

### 4.3 Start

```bash
npm run dev
```

| URL | What |
|---|---|
| http://localhost:5173/ | Website (React dev server with hot reload) |
| http://localhost:5173/dashboard/ | User dashboard (after login) |
| http://localhost:5173/admin/ | Admin panel |
| http://localhost:8000/api/ | Backend API (proxied by the dev server) |

`npm run dev` starts both processes: the Express API on port **8000** (auto-restarts on backend changes)
and Vite on port **5173**.

### 4.4 Available scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Backend + frontend in development mode |
| `npm run dev:backend` / `npm run dev:frontend` | Only one of them |
| `npm run build` | Build the React app into `frontend/dist` |
| `npm start` | Start the production server (`backend/index.js`) – runs the automatic database setup first |
| `npm run setup` | Run the automatic setup manually (missing tables, first admin, secret key) |
| `npm run db:sync` | Create missing tables only (`npm run db:sync -- --alter` also updates existing ones) |
| `npm run create-admin -- --username … --email … --password …` | Create or update a superuser |
| `npm run populate` | Load demo data |
| `npm run import:django -- dump.json` | Import data exported from the old Django site |

---

## 5. Running in production

```bash
npm install
npm run build      # creates frontend/dist
npm start          # serves the website, the API and uploaded files on PORT (default 8000)
```

In production set at least `DEBUG=False`, the `DB_*` values, the `ADMIN_*` values and the `EMAIL_*` values
(a `SECRET_KEY` is recommended). On start the app creates any missing tables and, on the very first start,
the admin user – see [6.2](#62-what-happens-on-every-deploy-automatic).

---

## 6. Deploying on Hostinger

### 6.1 One-time preparation

1. **Database** – hPanel → *Databases → MySQL Databases*: create a database and a user (note the full names,
   e.g. `u123456789_pehchan`). You do **not** need to create any tables.
2. **Node.js app** – hPanel → *Websites → Add website → Node.js app*, import this GitHub repository:
   - Node version: **20** or **22**
   - Build command: `npm run build`
   - Start command: `npm start` (entry file `backend/index.js`)
3. **Environment variables** (same screen):

   | Variable | Value |
   |---|---|
   | `DEBUG` | `False` |
   | `DB_HOST` / `DB_PORT` | `127.0.0.1` / `3306` |
   | `DB_NAME` / `DB_USER` / `DB_PASSWORD` | from step 1 |
   | `ADMIN_USERNAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | the admin account to create on the first deploy |
   | `SECRET_KEY` | a long random string (recommended – see below) |
   | `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL` | SMTP for OTP / certificate / reply emails |
   | `MEDIA_ROOT` | optional – default `~/pehchan_media` (outside the app folder, survives redeploys) |

   Hostinger provides `PORT` itself.
4. Connect the domain (`pehchanyui.in`) and enable **SSL** in hPanel.

### 6.2 What happens on every deploy (automatic)

Each deploy restarts the app, and on start `backend/setup.js` checks the database **before** the site
accepts requests:

| Situation | What the app does |
|---|---|
| **First deploy** – empty database | Creates **all tables**, creates the **admin user** from `ADMIN_*`, stores a generated `SECRET_KEY` if none is set |
| **Later deploys** – tables exist | Finds every table → **creates nothing, changes nothing**; admin already exists → skipped |
| Some tables were deleted | Re-creates **only the missing tables**; existing tables and data are kept |
| No `ADMIN_PASSWORD` on the first deploy | Generates a one-time password and prints it **once** in the app log – log in at `/admin/` and change it |
| An update added new columns | Set `DB_SYNC_ALTER=True` for one deploy, then back to `False` |
| Database unreachable / wrong credentials | The site stays up, API answers *"starting up"* (HTTP 503), the log explains the error and the setup retries every 5–60 s – fix the variables in hPanel and it recovers |

The setup uses a MySQL lock, so two app instances never run it at the same time. Check the state any time at
**`/api/health/`** (`{"database":"ready"}` when everything is fine). The same setup can be run manually with
`npm run setup`.

> **SECRET_KEY** signs the login cookies. If it is not set, the first start generates one and keeps it in the
> database (table `app_settings`), so users stay logged in across deploys. Setting it explicitly is still
> recommended; changing it logs everybody out.

---

## 7. Moving data from the old Django site

```bash
# on the old Django project
python manage.py dumpdata auth.user pehchan admin.logentry --natural-foreign --indent 2 -o pehchan-dump.json

# in this project
npm run import:django -- pehchan-dump.json
```

IDs and password hashes are kept, so everyone logs in with their existing password. Copy the old `media/`
folder (receipts, certificates, event images) into `MEDIA_ROOT`.

---

## 8. Configuration reference

All settings come from environment variables (`.env` locally). See `.env.example` for a template.

| Variable | Default | Description |
|---|---|---|
| `DEBUG` | `False` | `True` only for local development |
| `SECRET_KEY` | generated & stored in DB | Signs the session cookie (recommended to set explicitly) |
| `PORT` | `8000` | Port of the Express server |
| `DB_HOST`, `DB_PORT` | `127.0.0.1`, `3306` | MySQL server |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | `pehchan`, `root`, empty | MySQL database and credentials |
| `DB_AUTO_SYNC` | `True` | On start, create the tables that do not exist yet |
| `DB_SYNC_ALTER` | `False` | Also add new columns/indexes to existing tables (one deploy after an upgrade) |
| `AUTO_CREATE_ADMIN` | `True` | Create the superuser on the first start when the database has none |
| `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | `admin`, `admin@pehchanyui.in`, generated | First superuser (also defaults for `npm run create-admin`) |
| `MEDIA_ROOT` | `./media` (dev), `~/pehchan_media` (prod) | Folder for uploaded files (served at `/media/`) |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS` | `smtp.gmail.com`, `587`, `True` | SMTP server |
| `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` | empty | SMTP login (for Gmail use an App Password) |
| `DEFAULT_FROM_EMAIL` | `EMAIL_HOST_USER` | Sender address |
| `DONATION_UPI_ID` | `anikshaupadhyay2001@okicici` | UPI ID shown on the money donation page |
| `SESSION_COOKIE_SECURE` | `True` in production | Send the login cookie over HTTPS only |
| `SECURE_SSL_REDIRECT` | `False` | Redirect HTTP to HTTPS in the app (Hostinger usually does this already) |

---

## 9. Project structure

```
pehchanyui/
├── backend/
│   ├── index.js              Express app: /api, /media, React build
│   ├── config.js             settings from environment variables
│   ├── models/               MySQL tables (auth_user, pehchan_* …)
│   ├── routes/               auth.js, site.js (website + dashboard), admin.js (admin panel API)
│   ├── admin/                admin panel engine (models, lists, filters, forms, actions, exports)
│   ├── services/             wallet + automatic actions (deposits, withdrawals, certificate emails)
│   ├── middleware/           sessions, login, CSRF protection
│   ├── utils/                validation, password hashing, uploads, email
│   └── scripts/              db-sync, create-admin, populate, import-django-dump
├── frontend/
│   ├── public/static/        images, logos, CSS (same paths as the Django /static/)
│   └── src/
│       ├── pages/            one React page per screen
│       ├── components/       BaseLayout (website), dashboard/DashboardLayout (user dashboard) …
│       ├── admin/            admin panel UI
│       └── styles/           md3.css design system, website CSS
├── shared/                   date formatting used by frontend and backend
└── docs/                     API.md, ADMIN_API.md, DESIGN_SYSTEM.md, PORTING_GUIDE.md
```

Developer documentation: [`docs/API.md`](docs/API.md) (website API), [`docs/ADMIN_API.md`](docs/ADMIN_API.md)
(admin API), [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) (Material Design 3 rules).

---

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| Log shows `[setup] Database setup failed … Access denied` and the site says it is starting up | Check `DB_USER` / `DB_PASSWORD` (hPanel variables or `.env`); the app retries automatically |
| `Unknown database` on Hostinger | Create the database in hPanel first and use its exact name (e.g. `u123456789_pehchan`) |
| Don't know the admin password after the first deploy | It is in the app log (`[setup] … password:`), or set a new one with `npm run create-admin -- --username admin --password "…"` |
| Want to check the deployment | Open `/api/health/` – `"database":"ready"` means tables and admin are set up |
| `EADDRINUSE: port 8000` / `5173` | Another instance is running – stop it or set a different `PORT` |
| *Frontend build not found* at `http://localhost:8000` | Run `npm run build`, or use `npm run dev` and open port 5173 |
| OTP / certificate / reply emails not arriving | Set the `EMAIL_*` variables; for Gmail enable 2-step verification and use an App Password |
| Uploaded files disappear after a redeploy | Set `MEDIA_ROOT` to a folder outside the app directory |
| Can log in to `/admin/` but see no modules | The account is staff but not superuser – tick *Superuser status* for it |

---

## Security

- Login sessions use an HttpOnly, SameSite=Lax cookie (Secure in production), stored in MySQL, valid 30 days.
- Django-compatible password hashing (`pbkdf2_sha256`) and password validation.
- State-changing API requests must come from the app itself (`X-Requested-With` check) on top of SameSite cookies.
- Uploads are validated (receipts: JPG/PNG/WEBP/PDF up to 5 MB; event images must be real images).
- Security headers: `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  `Cross-Origin-Opener-Policy`.

## Support

Questions or issues: **madad@pehchanyui.in**

Copyright © 2025 Pehchan – Empowering Communities. All rights reserved.
