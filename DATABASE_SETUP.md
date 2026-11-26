# PostgreSQL setup guide for ArtiFile

ArtiFile uses PostgreSQL for every operational record. There is no in-memory demo backend and no mock data.

The system is currently running with:

```text
App:    http://localhost:5000
Health: http://localhost:5000/api/health
DB:     PostgreSQL 17.12 at 127.0.0.1:5433, database "artifile"
```

---

## Why port 5433

A pre-existing PostgreSQL 19 service was already listening on port `5432` and rejected the `postgres` password configured for this project. Stopping that service requires administrator rights, so ArtiFile uses an isolated PostgreSQL 17 cluster on port `5433`.

The private cluster lives at:

```text
C:\Users\joeya\AppData\Local\Temp\opencode\artifile-pgdata
```

`run.ps1` starts it automatically if it is not running.

---

## One-command setup and start

From the project root:

```powershell
.\run.ps1
```

This script:

1. Reads `server\.env`
2. Starts the private PostgreSQL cluster if needed
3. Creates the `artifile` database if missing
4. Installs dependencies if needed
5. Generates Prisma Client
6. Applies or creates the migration
7. Seeds admin, groups, requirements, forms, manual, certificate, events, settings, and the sample student
8. Starts the server on the configured `PORT`

---

## Manual setup

If you want to run each step yourself:

```powershell
cd "C:\Users\joeya\OneDrive\Desktop\artifile\server"
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev
```

Open:

```text
http://localhost:5000
```

---

## Database connection

`server\.env` currently contains:

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/artifile?schema=public"
PORT=5000
CLIENT_ORIGIN="http://localhost:5000"
GSUITE_DOMAIN="@g.batstate-u.edu.ph"
SEED_SAMPLE_DATA="true"
```

If you want to use a different PostgreSQL instance, change `DATABASE_URL` to match its host, port, user, password, and database name.

---

## Seeded accounts

```text
Admin:   cultureandarts.alangilan@g.batstate-u.edu.ph / ChangeThisStrongPassword123!
Student: sample.student@g.batstate-u.edu.ph           / SamplePass123!
```

Public registration always creates `STUDENT` accounts and requires an email ending in `@g.batstate-u.edu.ph`.

---

## Useful database commands

```powershell
# Health check
Invoke-RestMethod http://localhost:5000/api/health

# Browse data with Prisma Studio
cd "C:\Users\joeya\OneDrive\Desktop\artifile\server"
npm run studio

# Check the private cluster directly
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -U postgres -h 127.0.0.1 -p 5433 -d artifile -c "\dt"
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `psql` is not recognized | Use the full path under `C:\Program Files\PostgreSQL\17\bin`, or add that folder to `PATH` |
| `password authentication failed for user "postgres"` on port 5432 | That is the existing PostgreSQL 19 service. Use the ArtiFile cluster on port 5433 instead |
| `could not connect / connection refused` | Start the private cluster: `& 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe' -D "$env:TEMP\opencode\artifile-pgdata" -o '-p 5433 -h 127.0.0.1' -l "$env:TEMP\opencode\artifile-pg.log" -w start` |
| `database "artifile" does not exist` | Run `run.ps1`, or create it with `psql -U postgres -h 127.0.0.1 -p 5433 -d postgres -c "CREATE DATABASE artifile;"` |
| `Port 5000 is already in use` | Find the owner with `Get-NetTCPConnection -LocalPort 5000` and stop that process, or change `PORT` in `server\.env` |
| Migration fails with an inconsistent schema | `npx prisma migrate reset` (deletes data), then `npm run seed` |
| Seed says admin already exists | That is fine; the seed is idempotent |
| `@` domain rejection on login | Use an email ending in `@g.batstate-u.edu.ph` |
