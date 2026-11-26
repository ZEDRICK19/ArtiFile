$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$serverDir = Join-Path $root 'server'
$envPath = Join-Path $serverDir '.env'

if (-not (Test-Path $envPath)) {
  throw "Missing $envPath. Copy server\.env.example to server\.env first."
}

# Read DATABASE_URL from server\.env so connection details stay in one place.
$databaseUrl = ''
foreach ($line in Get-Content $envPath) {
  if ($line -match '^\s*DATABASE_URL\s*=\s*"?(.*?)"?\s*$') {
    $databaseUrl = $matches[1]
    break
  }
}

if (-not $databaseUrl) {
  throw 'DATABASE_URL was not found in server\.env.'
}

foreach ($line in Get-Content $envPath) {
  if ($line -match '^\s*PORT\s*=\s*"?(\d+)"?') {
    $appPort = $matches[1]
    break
  }
}

$dbHost = 'localhost'
$dbPort = '5432'
$databaseName = 'artifile'
$appPort = '5000'

if ($databaseUrl -match '://[^:/@]+(?::[^@/]*)?@([^:/]+)(?::(\d+))?/([^?/]+)') {
  $dbHost = $matches[1]
  if ($matches[2]) { $dbPort = $matches[2] }
  $databaseName = $matches[3]
}

$dbPassword = ''
if ($databaseUrl -match '://[^:/@]+:([^@]+)@') {
  $dbPassword = [System.Uri]::UnescapeDataString($matches[1])
}
$env:PGPASSWORD = $dbPassword

# Locate psql either on PATH or in a standard PostgreSQL installation.
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
  $candidates = @(
    (Join-Path ${env:ProgramFiles} 'PostgreSQL\*\bin\psql.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'PostgreSQL\*\bin\psql.exe')
  )
  foreach ($pattern in $candidates) {
    $found = Get-ChildItem $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
      $psql = $found.FullName
      break
    }
  }
}

if (-not $psql) {
  throw 'psql.exe was not found. Install PostgreSQL first or add it to PATH.'
}

$psqlExe = if ($psql -is [System.Management.Automation.CommandInfo]) { $psql.Source } else { $psql }
$binDir = Split-Path $psqlExe -Parent

# If DATABASE_URL uses a private port and nothing is listening, start an isolated
# PostgreSQL cluster under the temp directory. This avoids conflicting with an
# existing PostgreSQL service on port 5432 and needs no administrator rights.
$listening = Get-NetTCPConnection -LocalPort $dbPort -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
  $pgCtlExe = Join-Path $binDir 'pg_ctl.exe'
  $initDbExe = Join-Path $binDir 'initdb.exe'
  $pgData = Join-Path $env:TEMP 'opencode\artifile-pgdata'
  $pgLog = Join-Path $env:TEMP 'opencode\artifile-pg.log'

  if (-not (Test-Path $pgCtlExe) -or -not (Test-Path $initDbExe)) {
    throw "PostgreSQL server tools were not found next to $psqlExe."
  }

  if (-not (Test-Path $pgData)) {
    Write-Host 'Initializing a private ArtiFile PostgreSQL cluster...' -ForegroundColor Cyan
    & $initDbExe -D $pgData -U postgres --auth=trust --encoding=UTF8 --no-locale
    if ($LASTEXITCODE -ne 0) { throw 'Could not initialize the PostgreSQL cluster.' }
  }

  Write-Host "Starting PostgreSQL on $($dbHost):$dbPort..." -ForegroundColor Cyan
  & $pgCtlExe -D $pgData -o "-p $dbPort -h $dbHost" -l $pgLog -w start
  if ($LASTEXITCODE -ne 0) {
    Get-Content $pgLog -ErrorAction SilentlyContinue | Select-Object -Last 30
    throw 'Could not start PostgreSQL.'
  }
}

# Create the configured database if it does not already exist.
$exists = & $psqlExe -U postgres -h $dbHost -p $dbPort -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$databaseName'"
if ($LASTEXITCODE -ne 0) {
  throw 'Could not connect to PostgreSQL. Check DATABASE_URL and the postgres password.'
}
if ($exists -ne '1') {
  & $psqlExe -U postgres -h $dbHost -p $dbPort -d postgres -c "CREATE DATABASE $databaseName;"
  if ($LASTEXITCODE -ne 0) {
    throw "Could not create the $databaseName database."
  }
  Write-Host "Created database: $databaseName" -ForegroundColor Green
} else {
  Write-Host "Database already exists: $databaseName" -ForegroundColor Green
}

Set-Location $serverDir

if (-not (Test-Path (Join-Path $serverDir 'node_modules'))) {
  Write-Host 'Installing backend dependencies...' -ForegroundColor Cyan
  npm install
}

Write-Host 'Generating Prisma Client...' -ForegroundColor Cyan
npx prisma generate

if (Test-Path (Join-Path $serverDir 'prisma\migrations')) {
  Write-Host 'Applying migrations...' -ForegroundColor Cyan
  npx prisma migrate deploy
} else {
  Write-Host 'Creating initial migration...' -ForegroundColor Cyan
  npx prisma migrate dev --name init
}

Write-Host 'Seeding admin, groups, requirements, forms, and settings...' -ForegroundColor Cyan
npm run seed

Write-Host ''
Write-Host "ArtiFile is starting at http://localhost:$appPort" -ForegroundColor Green
Write-Host 'Press Ctrl+C to stop the server.' -ForegroundColor DarkGray
Write-Host ''

npm run dev
