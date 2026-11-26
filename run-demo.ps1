$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$serverDir = Join-Path $root 'server'

if (-not (Test-Path (Join-Path $serverDir 'demo\server.js'))) {
  throw 'Demo server not found at server\demo\server.js.'
}

Set-Location $serverDir

Write-Host ''
Write-Host '=========================================' -ForegroundColor Cyan
Write-Host '  ArtiFile DEMO MODE (no database)' -ForegroundColor Cyan
Write-Host '  URL:  http://localhost:5000' -ForegroundColor Cyan
Write-Host '  API:  in-memory mock data' -ForegroundColor Cyan
Write-Host ''
Write-Host '  Student: sample.student@g.batstate-u.edu.ph / SamplePass123!' -ForegroundColor White
Write-Host '  Admin:   cultureandarts.alangilan@g.batstate-u.edu.ph / ChangeThisStrongPassword123!' -ForegroundColor White
Write-Host '  Other GSuite emails create a new student with your chosen password.' -ForegroundColor White
Write-Host ''
Write-Host '  Changes reset when the server stops.' -ForegroundColor DarkGray
Write-Host '  Press Ctrl+C to stop.' -ForegroundColor DarkGray
Write-Host '=========================================' -ForegroundColor Cyan
Write-Host ''

npm run dev:demo
