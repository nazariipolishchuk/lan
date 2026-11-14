# HLS greenness on the laptop, sharing one tile queue with the VPS.
#
# The VPS walks data/logs/tiles.txt forward (run_all.sh); the laptop walks it backward from the last line.
# The laptop runs several lanes in parallel (one window each). A lane claims a tile by creating
# data/logs/claims/<tile> (atomic CreateNew), so two lanes never take the same tile.
# Before each tile a lane asks the VPS whether it has started that tile; if so the queues have met and
# the lane stops. After each tile the lane copies its .ok markers (not the data) to the VPS, so the VPS
# skips those tile-years. Restart-safe: finished tile-years have .ok markers here and there.
# Progress is printed in each window and appended to data/logs/run_laptop.log.
#
# The server address and key come from the environment (LAN_VPS, LAN_VPS_KEY), never from the repository:
#   $env:LAN_VPS = 'user@host'; $env:LAN_VPS_KEY = 'C:\path\to\key'
#   powershell -ExecutionPolicy Bypass -File pipeline\jobs\run_laptop.ps1 [-From 41] [-To 90] [-Workers 4] [-Lanes 4]
# Without -Lane the script clears old claims and opens -Lanes windows; with -Lane N it is one lane.
#   USA: -Region us -Years 2026 -From 1 -To 784   (tiles_us.txt, work/fields_us, work/ndvi_us)
param([int]$From = 41, [int]$To = 90, [int]$Workers = 4, [int]$Lanes = 4, [int]$Lane = 0,
      [string]$Region = 'ua', [string]$Years = '2026,2025,2024,2023,2022,2021,2020,2019,2018,2017,2016')

$ErrorActionPreference = 'Continue'
Set-Location (Join-Path $PSScriptRoot '..')
$env:LAN_LOGS_DIR = (Resolve-Path '..\data\logs').Path
$sfx = if ($Region -eq 'us') { '_us' } else { '' }
New-Item -ItemType Directory -Force -Path "..\data\work\ndvi$sfx" | Out-Null
$ndvi = (Resolve-Path "..\data\work\ndvi$sfx").Path
$fieldsDir = (Resolve-Path "..\data\work\fields$sfx").Path
$claims = Join-Path $env:LAN_LOGS_DIR "claims$sfx"
$log = Join-Path $env:LAN_LOGS_DIR "run_laptop$sfx.log"
$tiles = Get-Content (Join-Path $env:LAN_LOGS_DIR "tiles$sfx.txt") | ForEach-Object { ($_ -split ' ')[0] }
$years = $Years -split ',' | ForEach-Object { [int]$_ }
$vpsNdvi = "lan/data/work/ndvi$sfx/"
$vps = $env:LAN_VPS
$sshArgs = @('-i', $env:LAN_VPS_KEY, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20',
             '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4')

if (-not $vps -or -not $env:LAN_VPS_KEY) { Write-Host 'Set LAN_VPS and LAN_VPS_KEY first.'; exit 1 }

if ($Lane -eq 0) {
  # launcher: fresh claims, then one window per lane (environment is inherited)
  if (Test-Path $claims) { Remove-Item -Path (Join-Path $claims '*') -Force -ErrorAction SilentlyContinue }
  New-Item -ItemType Directory -Force -Path $claims | Out-Null
  for ($i = 1; $i -le $Lanes; $i++) {
    Start-Process powershell -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath,
      '-From', $From, '-To', $To, '-Workers', $Workers, '-Lane', $i, '-Region', $Region, '-Years', $Years)
    Start-Sleep -Seconds 3
  }
  exit 0
}

$host.UI.RawUI.WindowTitle = "Lan HLS $Region lane $Lane, tiles $To down to $From"
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Say([string]$msg) {
  $line = "$(Get-Date -Format s) lane $Lane $msg"; Write-Host $line
  [System.IO.File]::AppendAllText($log, "$line`r`n", $utf8)
}

function VpsStarted([string]$tile) {
  # 'yes' if the VPS has begun this tile; 'unknown' if the VPS cannot be reached
  $out = & ssh @sshArgs $vps "grep -q ' $tile start' lan/logs/run_all.log && echo yes || echo no" 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $out) { return 'unknown' }
  return ($out | Select-Object -Last 1).Trim()
}

function PushMarkers([string]$tile) {
  $ok = Get-ChildItem -Path $ndvi -Filter "${tile}_*.ok" | ForEach-Object { $_.FullName }
  if ($ok) { & scp @sshArgs -q @ok "${vps}:$vpsNdvi" 2>$null; return $LASTEXITCODE -eq 0 }
  return $false
}

function Claim([string]$tile) {
  try { [System.IO.File]::Open((Join-Path $claims $tile), 'CreateNew').Close(); return $true } catch { return $false }
}

function RunTile([string]$tile, [int]$w) {
  # each lane appends its JSON lines through .NET (UTF-8), so parallel lanes do not garble the log
  & uv run -q python jobs/run_tile.py $tile @years --workers $w --fields $fieldsDir --out $ndvi 2>&1 | ForEach-Object {
    $s = "$_"; Write-Host $s; [System.IO.File]::AppendAllText($log, "$s`r`n", $utf8) }
  return $LASTEXITCODE
}

Say "start ($Workers download threads)"
for ($n = $To; $n -ge $From; $n--) {
  $tile = $tiles[$n - 1]
  $done = @(Get-ChildItem -Path $ndvi -Filter "${tile}_*.ok" -ErrorAction SilentlyContinue).Count
  if ($done -ge $years.Count) { continue }
  if (-not (Claim $tile)) { continue }
  $started = VpsStarted $tile
  if ($started -eq 'yes') { Say "tile $n $tile already started on the VPS: queues met, stopping"; break }
  if ($started -eq 'unknown') { Say "VPS not reachable; continuing (markers are pushed later)" }
  $freeGb = [math]::Round((Get-PSDrive C).Free / 1GB, 1)
  if ($freeGb -lt 8) { Say "STOP low disk ${freeGb} GB"; break }
  Say "tile $n $tile start (disk free ${freeGb} GB)"
  if ((RunTile $tile $Workers) -ne 0) {
    Say "tile $tile failed, retry with 2 workers"
    if ((RunTile $tile 2) -ne 0) { Say "tile $tile failed twice" }
  }
  if (PushMarkers $tile) { Say "tile $n $tile done, markers copied to the VPS" } else { Say "tile $n $tile done, markers NOT copied (VPS unreachable?)" }
}
Say "finished"
Write-Host 'Finished. This window can be closed.'
