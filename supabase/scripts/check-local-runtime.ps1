<#
.SYNOPSIS
  Read-only prerequisite check for IshuriHUB's local Supabase stack.
.DESCRIPTION
  Does not install software, change Windows/WSL settings, start Docker, or contact hosted Supabase.
#>
param([int]$MinimumFreeDiskGB = 10)

$ErrorActionPreference = 'SilentlyContinue'
$failed = $false

function Report([string]$Name, [bool]$Ok, [string]$Detail) {
  $label = if ($Ok) { 'OK' } else { 'MISSING/NOT READY' }
  Write-Output ('[{0}] {1}: {2}' -f $label, $Name, $Detail)
  if (-not $Ok) { $script:failed = $true }
}

function Read-ConfigValue([string]$Text, [string]$Section, [string]$Key) {
  $sectionMatch = [regex]::Match($Text, '(?ms)^\[' + [regex]::Escape($Section) + '\]\s*$(.*?)(?=^\[|\z)')
  if (-not $sectionMatch.Success) { return $null }
  $valueMatch = [regex]::Match($sectionMatch.Groups[1].Value, '(?m)^\s*' + [regex]::Escape($Key) + '\s*=\s*([^#\r\n]+)')
  if (-not $valueMatch.Success) { return $null }
  return $valueMatch.Groups[1].Value.Trim().Trim('"')
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  Report 'Docker CLI' $false 'not found on PATH; install and start Docker Desktop.'
} else {
  $dockerVersion = (& $docker.Source --version 2>&1 | Out-String).Trim()
  $dockerInfo = (& $docker.Source info --format 'OSType={{.OSType}} ServerVersion={{.ServerVersion}}' 2>&1 | Out-String).Trim()
  $linuxEngine = $LASTEXITCODE -eq 0 -and $dockerInfo -match 'OSType=linux'
  Report 'Docker Desktop / Linux engine' $linuxEngine (($dockerVersion, $dockerInfo -replace '[\r\n]+', ' ') -join '; ')
}

$wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
if (-not $wsl) {
  Report 'WSL 2' $false 'wsl.exe not found; install WSL 2 and a Linux distribution.'
} else {
  $wslStatus = (& $wsl.Source --status 2>&1 | Out-String).Trim()
  $wslList = (& $wsl.Source --list --verbose 2>&1 | Out-String).Trim()
  $wslOk = $LASTEXITCODE -eq 0 -and $wslList -match '(?m)\s2\s*$' -and $wslStatus -notmatch 'not installed|not available'
  $wslDetail = (($wslStatus + ' ' + $wslList) -replace '[\r\n\0]+', ' ').Trim()
  if (-not $wslDetail) { $wslDetail = 'WSL is not installed or returned no status; install WSL 2 and a Linux distribution.' }
  Report 'WSL 2' $wslOk $wslDetail
}

$supabase = Get-Command supabase -ErrorAction SilentlyContinue
if ($supabase) {
  $version = (& $supabase.Source --version 2>&1 | Out-String).Trim()
  Report 'Supabase CLI' ($LASTEXITCODE -eq 0) $version
} else { Report 'Supabase CLI' $false 'not found on PATH.' }

$deno = Get-Command deno -ErrorAction SilentlyContinue
if ($deno) {
  $version = (& $deno.Source --version 2>&1 | Out-String).Trim()
  Report 'Deno' ($LASTEXITCODE -eq 0 -and $version -match 'deno\s+2\.') ($version -replace '[\r\n]+', '; ')
} else { Report 'Deno 2' $false 'not found on PATH.' }

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$driveRoot = [IO.Path]::GetPathRoot($root)
try {
  $drive = [IO.DriveInfo]::new($driveRoot)
  $freeGB = [math]::Round($drive.AvailableFreeSpace / 1GB, 1)
  Report "Free disk space on $driveRoot (minimum ${MinimumFreeDiskGB} GB)" ($freeGB -ge $MinimumFreeDiskGB) "${freeGB} GB available."
} catch { Report 'Free disk space' $false "unable to query volume: $($_.Exception.Message)" }

$port = 54322
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port)
try {
  $listener.Start()
  Report "Local database port $port" $true 'available.'
} catch {
  Report "Local database port $port" $false 'already bound or unavailable; inspect the existing listener before proceeding.'
} finally { $listener.Stop() }

$configPath = Join-Path $root 'supabase\config.toml'
if (-not (Test-Path -LiteralPath $configPath)) {
  Report 'Supabase configuration' $false "not found at $configPath."
} else {
  $config = Get-Content -Raw -LiteralPath $configPath
  $dbPort = Read-ConfigValue $config 'db' 'port'
  $major = Read-ConfigValue $config 'db' 'major_version'
  $migrationsEnabled = Read-ConfigValue $config 'db.migrations' 'enabled'
  $migrationFiles = @(Get-ChildItem (Join-Path $root 'supabase\migrations') -Filter '*.sql' -ErrorAction SilentlyContinue).Count
  $checks = ($dbPort -eq '54322' -and $major -eq '17' -and $migrationsEnabled -eq 'true' -and $migrationFiles -gt 0)
  Report 'Supabase local config' $checks "database port=$dbPort; PostgreSQL major=$major; migrations enabled=$migrationsEnabled; migration files=$migrationFiles."
}

if ($failed) {
  Write-Output 'Prerequisites are incomplete. This check made no changes. Do not run database commands until the missing items are resolved.'
  exit 1
}
Write-Output 'Prerequisites are ready. This check made no changes; use reviewed, non-resetting local database commands.'
exit 0
