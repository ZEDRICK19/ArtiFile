# ArtiFile

Digital Filing and Records Management System for the Office of Culture and Arts, Batangas State University TNEU, Alangilan Campus.

ArtiFile is a full-stack web application built with:

- **Frontend:** plain HTML, CSS, and JavaScript ES modules (no React)
- **Backend:** Node.js + Express
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** JWT stored in a secure HttpOnly cookie
- **Storage:** private uploads under `server/uploads`, streamed only through authorized API endpoints

All operational data — accounts, profiles, applications, requirements, documents, reviews, notifications, activity logs, events, forms, manual/certificate resources, and settings — is stored in PostgreSQL. The frontend does not use mock statistics or `localStorage` for records.

---

## Current status

The project has been written directly into this VS Code workspace:

```text
artifile/
├─ run.ps1
├─ client/
│  ├─ index.html
│  ├─ css/
│  │  ├─ base.css
│  │  ├─ layout.css
│  │  ├─ components.css
│  │  ├─ student-dashboard.css
│  │  ├─ admin.css
│  │  └─ responsive.css
│  └─ js/
│     ├─ app.js
│     ├─ core/
│     │  ├─ api.js
│     │  ├─ constants.js
│     │  ├─ router.js
│     │  ├─ session.js
│     │  ├─ store.js
│     │  └─ ui.js
│     └─ pages/
│        ├─ landing.js
│        ├─ login.js
│        ├─ register.js
│        ├─ notifications.js
│        ├─ student/
│        │  ├─ dashboard.js
│        │  ├─ requirements.js
│        │  ├─ edit-profile.js
│        │  └─ resources.js
│        └─ admin/
│           ├─ dashboard.js
│           ├─ applicants.js
│           ├─ applicant-details.js
│           ├─ document-viewer.js
│           ├─ activity-logs.js
│           ├─ reports.js
│           └─ events.js
└─ server/
   ├─ .env
   ├─ .env.example
   ├─ package.json
   ├─ prisma/
   │  ├─ schema.prisma
   │  └─ seed.js
   ├─ uploads/
   └─ src/
      ├─ app.js
      ├─ server.js
      ├─ config/
      ├─ controllers/
      ├─ middleware/
      ├─ routes/
      ├─ utils/
      └─ validators/
```

Verified so far:

- `npm install` completed
- Prisma schema validates (`npx prisma validate`)
- Prisma migration created and applied (`npx prisma migrate dev --name init`)
- Prisma Client generated (`npx prisma generate`)
- Database seeded with admin, cultural groups, requirements, forms, manual, certificate, events, settings, and a sample student
- Backend and frontend JavaScript syntax checks passed
- End-to-end smoke test passed: login, GSuite rejection, RBAC, dashboards, applicant detail, upload, review, application acceptance, post-audition unlock, and version history

The setup below documents how this was achieved and how to reproduce it.

---

## Current runtime on this machine

The real database-backed system is running now:

```text
App:    http://localhost:5000
Health: http://localhost:5000/api/health
DB:     PostgreSQL 17.12 at 127.0.0.1:5433 / database "artifile"
```

A pre-existing PostgreSQL 19 service occupies port 5432 with an unknown password, so ArtiFile uses an isolated PostgreSQL 17 cluster in:

```text
C:\Users\joeya\AppData\Local\Temp\opencode\artifile-pgdata
```

`run.ps1` starts that private cluster automatically if it is not already running. In this database-backed mode, every record is stored in PostgreSQL. An in-memory demo mode is also available when PostgreSQL is not configured.

Mock accounts are available on the sign-in page — click either account card to fill the form automatically:

| Role | Email | Password |
| --- | --- | --- |
| Student | `sample.student@g.batstate-u.edu.ph` | `SamplePass123!` |
| Admin | `cultureandarts.alangilan@g.batstate-u.edu.ph` | `ChangeThisStrongPassword123!` |

You can also register a new student with any `@g.batstate-u.edu.ph` email. Public registration always creates a `STUDENT` account.

## Run without a database (demo mode)

Use demo mode when PostgreSQL is not installed or configured:

```powershell
cd "C:\Users\joeya\OneDrive\Desktop\artifile"
.\run-demo.ps1
```

Or:

```powershell
cd "C:\Users\joeya\OneDrive\Desktop\artifile\server"
npm run dev:demo
```

Open `http://localhost:5000`. The mock student/admin accounts listed above work here too. Any other `@g.batstate-u.edu.ph` email creates a new student account with the password you enter. Data resets when the demo server stops.

> Stop one server before starting the other — demo mode and the real backend both use port `5000`.

---

## Design system

- **Palette:** maroon (`#7A1F2B`), red (`#B3261E`), white (`#FFFFFF`), and dirty white (`#F5F1EA`), with warm ink tones for text. Only the sign-in and sign-up panels use an abstract Kalinga/tribal/Muslim-inspired textile accent; both panels have the same brand mark and no descriptive text block.
- **Typography:** a clear system sans-serif stack (Aptos / Segoe UI / Roboto) with larger base text, higher line height, and bold headings for readability.
- **Icons:** simple 24×24 stroke icons with thicker 2px lines and consistent shapes. Icon names are defined in `client/js/core/ui.js`; icon-only controls keep `aria-label` or `title` text.
- **University identity:** every screen starts with a Batangas State University / Office of Culture and Arts masthead. Public, student, and admin areas share the same cards, tables, forms, badges, and navigation patterns.
- **Admin styling:** the admin area keeps the maroon identity with grouped navigation and a slightly darker sidebar for hierarchy.
- **Presentation layer:** `client/css/professional.css` refines the full system after the base component styles, including keyboard focus rings, calmer navigation, clearer data tables, and responsive adjustments.
- **Cultural groups:** BatStateU Ad Libitum Chorus, BatStateU-TNEU Indak Yaman Dance Varsity, BatStateU-TNEU Dulaang Batangan, BatStateU-TNEU Band, Diwayanis Dance Theater, Sikha BatStateU-TNEU, and BatStateU Rondalla.

---

## Phase 1 — System planning

### Roles

| Role | How it is created | Main permissions |
|---|---|---|
| `STUDENT` | Public registration | Manage own profile, submit/replace own documents, view own statuses/notifications/resources |
| `ADMIN` | Only through `npm run seed` using `SEED_ADMIN_*` environment values | View all applicants/documents, review documents, update application status, manage events/forms/resources, view reports and logs |

Public registration always assigns `STUDENT`. There is no role selector on the registration page.

### GSuite rule

Login and registration accept only BSU Google Workspace accounts ending with:

```text
@g.batstate-u.edu.ph
```

Invalid domains are rejected with:

```text
ArtiFile uses Batangas State University Google Workspace accounts. Please use your GSuite email (e.g. student@g.batstate-u.edu.ph).
```

This is enforced both in the browser and on the server.

### Workflow

1. Student registers with a GSuite email.
2. An `Application` record is created automatically with `PENDING`.
3. Student submits pre-audition requirements:
   - Waiver / Parent's Consent Form
   - Photocopy of Parent's ID with Three Specimen Signatures
4. Admin reviews each document and can accept it, request revision, reject it, or mark it under review.
5. Admin updates the application to `ACCEPTED`.
6. The post-audition requirement — Performer's Profile — unlocks only after acceptance.
7. Student and admin receive in-app notifications. Email notifications are sent when SMTP is configured.

### Document statuses

```text
NOT_SUBMITTED
SUBMITTED
UNDER_REVIEW
ACCEPTED
REVISION_REQUIRED
REJECTED
```

### Application statuses

```text
PENDING
UNDER_REVIEW
ACCEPTED
REJECTED
```

---

## Phase 2 — Database and environment setup

### 1. Install PostgreSQL

Install PostgreSQL 14+ locally. On this machine, PostgreSQL 17 was installed with winget. A pre-existing PostgreSQL 19 service already occupied port 5432 with an unknown password, so ArtiFile uses an isolated PostgreSQL 17 cluster on port 5433 instead.

`run.ps1` handles this automatically. If you prefer to do it manually, initialize a private cluster and start it on port 5433:

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\initdb.exe' -D "$env:TEMP\opencode\artifile-pgdata" -U postgres --auth=trust --encoding=UTF8 --no-locale
& 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe' -D "$env:TEMP\opencode\artifile-pgdata" -o '-p 5433 -h 127.0.0.1' -l "$env:TEMP\opencode\artifile-pg.log" -w start
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -U postgres -h 127.0.0.1 -p 5433 -d postgres -c "CREATE DATABASE artifile;"
```

If you already have a PostgreSQL instance you want to use, change `DATABASE_URL` in `server\.env` to match its host, port, user, password, and database name.

### 2. Configure the backend environment

`server/.env` already exists for local development:

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/artifile?schema=public"
JWT_SECRET="replace_with_a_long_random_secret"
JWT_EXPIRES_IN="7d"
PORT=5000
NODE_ENV="development"
CLIENT_ORIGIN="http://localhost:5000"
COOKIE_NAME="artifile_token"
GSUITE_DOMAIN="@g.batstate-u.edu.ph"
SEED_ADMIN_EMAIL="cultureandarts.alangilan@g.batstate-u.edu.ph"
SEED_ADMIN_PASSWORD="ChangeThisStrongPassword123!"
SEED_ADMIN_NAME="Administrative Aide VI"
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
MAIL_FROM="ArtiFile <cultureandarts.alangilan@g.batstate-u.edu.ph>"
SEED_SAMPLE_DATA="true"
```

Change `JWT_SECRET` and `SEED_ADMIN_PASSWORD` before any real deployment.

### 3. Install dependencies

```powershell
cd "C:\Users\joeya\OneDrive\Desktop\artifile\server"
npm install
```

### 4. Create tables and seed reference data

```powershell
npx prisma migrate dev --name init
npm run seed
```

The seed creates:

- The ADMIN account
- Cultural groups
- Pre/post-audition requirements
- System settings
- Forms, manual, and certificate resources
- Calendar events
- A sample student when `SEED_SAMPLE_DATA="true"`

Seeded accounts:

```text
Admin:   cultureandarts.alangilan@g.batstate-u.edu.ph / ChangeThisStrongPassword123!
Student: sample.student@g.batstate-u.edu.ph           / SamplePass123!
```

Change the admin password in `server/.env` before seeding if you want a different value.

---

## Phase 3 — Running the application

### One-command launcher

After PostgreSQL is installed, run this from the project root:

```powershell
.\run.ps1
```

It reads `server\.env`, starts the private PostgreSQL cluster if needed, creates the `artifile` database if needed, installs dependencies, generates Prisma Client, applies/creates the migration, seeds the database, and starts the development server on the configured port.

### Manual start

From the `server` folder:

```powershell
npm run dev
```

Open:

```text
http://localhost:5000
```

Express serves the API under `/api` and the static frontend from `client/`.

Health check:

```text
GET http://localhost:5000/api/health
```

Optional database browser:

```powershell
npm run studio
```

---

## Phase 4 — Frontend pages

### Public

- Landing page
- Login
- Registration

### Student dashboard tabs

1. Profile
2. Pre-Audition Requirements
3. Post-Audition Requirements
4. Certificate of Membership
5. Culture and Arts Manual
6. Forms
7. Calendar of Activities
8. Contact Details

The dashboard also includes application status, recent notifications, profile editing, application status details, and a document list.

Post-audition requirements display a locked state until the application status is `ACCEPTED`. The lock is also enforced by the backend, so bypassing the UI cannot unlock the upload.

### Admin pages

- Dashboard with database-backed statistics and charts
- Applicant directory with search and filters
- Applicant record detail with requirements and activity history
- Document viewer with PDF/image preview, review actions, and version history
- All documents list
- Activity logs
- Reports with CSV export
- Calendar events and forms/resources management
- Account management guidance page

The palette is limited to maroon, red, white, and dirty white. Maroon is the primary identity color, red marks attention and errors, white is used for cards, and dirty white is the page background. Status labels are always shown in text, so meaning does not depend on color alone.

---

## Phase 5 — Testing checklist

### Authentication

1. Register with `student@g.batstate-u.edu.ph`.
2. Try to register or log in with `student@gmail.com` — it must be rejected with the GSuite message.
3. Log in as the seeded admin.
4. Verify a student cannot access `/admin` and an admin cannot access `/student`.

### Student role

1. Edit profile and verify the updated data appears after refresh.
2. Upload a valid PDF/JPG/PNG waiver and parent ID.
3. Try an invalid file type or content — it must be rejected.
4. Replace a document and verify version history increases.
5. Confirm post-audition requirement is locked before acceptance.
6. Confirm notifications appear after admin review.

### Admin role

1. Open an applicant record.
2. Review a document as accepted, revision required, and rejected.
3. Verify the student sees the correct status and feedback.
4. Change application status to `ACCEPTED`.
5. Verify post-audition requirement unlocks for the student.
6. Try to submit Performer's Profile as a non-accepted student directly through the API — it must return `403`.
7. Add/edit/remove a calendar event and a form/resource.
8. Check activity logs for the actions above.

### Security

1. Open a private file URL directly without logging in — it must be denied.
2. Try to download another student's document as a student — it must return `403`.
3. Verify cookies are HttpOnly in browser developer tools.
4. In production, verify cookies are `Secure`.

---

## Phase 6 — Deployment preparation

Before deploying:

1. Set `NODE_ENV=production`.
2. Use a strong random `JWT_SECRET`.
3. Change `SEED_ADMIN_PASSWORD` and re-run the seed if needed.
4. Set `CLIENT_ORIGIN` to the public domain.
5. Configure SMTP with `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM`.
6. Serve behind HTTPS so the HttpOnly session cookie can be marked `Secure`.
7. Keep `server/uploads` outside any public static directory. It is already private and streamed only by authorized endpoints.
8. Run migrations with `npx prisma migrate deploy`.
9. Start with `npm start`.

Recommended production commands:

```powershell
npm ci
npx prisma generate
npx prisma migrate deploy
npm start
```

---

## API map

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a student applicant |
| `POST` | `/api/auth/login` | Login with GSuite email and password |
| `POST` | `/api/auth/logout` | Clear the session cookie |
| `GET` | `/api/auth/me` | Current user, profile, application, status, unread count |
| `POST` | `/api/auth/forgot-password` | Submit a password-reset request |

### Student

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/student/dashboard` | Dashboard data |
| `GET` | `/api/student/profile` | Student profile |
| `PUT` | `/api/student/profile` | Update student profile |
| `GET` | `/api/student/application` | Application and derived status |
| `GET` | `/api/student/requirements` | Requirements with lock state and document status |

### Documents

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/documents/upload` | Upload pre-audition document |
| `POST` | `/api/documents/post/upload` | Upload post-audition document; requires `ACCEPTED` |
| `PUT` | `/api/documents/:id/replace` | Replace own document and keep version history |
| `GET` | `/api/documents/my-documents` | Own submitted documents |
| `GET` | `/api/documents/:id` | Document metadata |
| `GET` | `/api/documents/:id/download` | Stream file; add `?download=1` to force download |

### Admin

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/dashboard` | Statistics and cultural-group breakdown |
| `GET` | `/api/admin/applicants` | Paginated applicant list |
| `GET` | `/api/admin/applicants/:id` | Applicant detail |
| `PUT` | `/api/admin/applicants/:id/status` | Update application status |
| `POST` | `/api/admin/applicants/:id/archive` | Archive or restore applicant |
| `GET` | `/api/admin/documents` | All documents |
| `PUT` | `/api/admin/documents/:id/review` | Review a document |
| `GET` | `/api/admin/activity-logs` | Paginated audit trail |
| `GET` | `/api/admin/reports` | Report data |
| `GET/POST/PUT` | `/api/admin/cultural-groups` | Manage cultural groups |
| `GET/POST/PUT/DELETE` | `/api/admin/events` | Manage calendar events |
| `GET/POST/PUT/DELETE` | `/api/admin/resources` | Manage forms/manual/certificate resources |

### Notifications and resources

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/notifications` | Current user's notifications |
| `PUT` | `/api/notifications/:id/read` | Mark one notification read |
| `PUT` | `/api/notifications/read-all` | Mark all notifications read |
| `GET` | `/api/resources` | Public-facing forms/manual/certificate resources |
| `GET` | `/api/resources/events` | Active calendar events |
| `GET` | `/api/resources/cultural-groups` | Active cultural groups |
| `GET` | `/api/resources/contact` | Contact settings from the database |

---

## Notes

- Private files are stored in `server/uploads` with randomized filenames. Original filenames are metadata only.
- Uploads are validated by MIME type, extension, size limit, and magic bytes.
- Document preview defaults to inline for PDF/images; `?download=1` forces attachment.
- All dashboard statistics are computed with Prisma queries against PostgreSQL.
- The two reference screenshots were not available in this session, so the student dashboard follows the written tab structure and design description. If the screenshots are provided later, the CSS can be adjusted for closer pixel matching without changing the backend.
