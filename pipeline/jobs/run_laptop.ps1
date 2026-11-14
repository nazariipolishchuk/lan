# HLS greenness on the laptop, sharing one tile queue with the VPS.
#
# The VPS walks data/logs/tiles.txt forward (run_all.sh); the laptop walks it backward from the last line.
# Before each tile the laptop asks the VPS whether it has started that tile; if so the queues have met and
# the laptop stops. After each tile the laptop copies its .ok markers (not the data) to the VPS, so the VPS
# skips those tile-years. Restart-safe: finished tile-years have .ok markers here and there.
# Progress is printed in this window and appended to data/logs/run_laptop.log.
#
# The server address and key come from the environment (LAN_VPS, LAN_VPS_KEY), never from the repository:
#   $env:LAN_VPS = 'user@host'; $env:LAN_VPS_KEY = 'C:\path\to\key'
#   powershell -ExecutionPolicy Bypass -File pipeline\jobs\run_laptop.ps1 [-From 41] [-To 90] [-Workers 4]
param([int]$From = 41, [int]$To = 90, [int]$Workers = 4)

$ErrorActionPreference = 'Continue'
Set-Location (Join-Path $PSScriptRoot '..')
$env:LAN_LOGS_DIR = (Resolve-Path '..\data\logs').Path
$ndvi = (Resolve-Path '..\data\work\ndvi').Path
$log = Join-Path $env:LAN_LOGS_DIR 'run_laptop.log'
$tiles = Get-Content (Join-Path $env:LAN_LOGS_DIR 'tiles.txt') | ForEach-Object { ($_ -split ' ')[0] }
$years = 2026..2016
$vps = $env:LAN_VPS
$sshArgs = @('-i', $env:LAN_VPS_KEY, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20')
$host.UI.RawUI.WindowTitle = "Lan HLS (laptop) tiles $To down to $From"

function Say([string]$msg) { $line = "$(Get-Date -Format s) $msg"; Write-Host $line; Add-Content -Path $log -Value $line }

function VpsStarted([string]$tile) {
  # 'yes' if the VPS has begun this tile; 'unknown' if the VPS cannot be reached
  $out = & ssh @sshArgs $vps "grep -q ' $tile start' lan/logs/run_all.log && echo yes || echo no" 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $out) { return 'unknown' }
  return ($out | Select-Object -Last 1).Trim()
}

function PushMarkers([string]$tile) {
  $ok = Get-ChildItem -Path $ndvi -Filter "${tile}_*.ok" | ForEach-Object { $_.FullName }
  if ($ok) { & scp @sshArgs -q @ok "${vps}:lan/data/work/ndvi/" 2>$null; return $LASTEXITCODE -eq 0 }
  return $false
}

if (-not $vps -or -not $env:LAN_VPS_KEY) { Write-Host 'Set LAN_VPS and LAN_VPS_KEY first.'; exit 1 }
Say "queue $To down to $From start ($Workers download threads)"
for ($n = $To; $n -ge $From; $n--) {
  $tile = $tiles[$n - 1]
  $started = VpsStarted $tile
  if ($started -eq 'yes') { Say "tile $n $tile already started on the VPS: queues met, stopping"; break }
  if ($started -eq 'unknown') { Say "VPS not reachable; continuing (markers are pushed later)" }
  $freeGb = [math]::Round((Get-PSDrive C).Free / 1GB, 1)
  if ($freeGb -lt 8) { Say "STOP low disk ${freeGb} GB"; break }
  Say "tile $n $tile start (disk free ${freeGb} GB)"
  uv run -q python jobs/run_tile.py $tile @years --workers $Workers 2>&1 | Tee-Object -FilePath $log -Append
  if ($LASTEXITCODE -ne 0) {
    Say "tile $tile failed (exit $LASTEXITCODE), retry with 2 workers"
    uv run -q python jobs/run_tile.py $tile @years --workers 2 2>&1 | Tee-Object -FilePath $log -Append
    if ($LASTEXITCODE -ne 0) { Say "tile $tile failed twice" }
  }
  if (PushMarkers $tile) { Say "tile $n $tile done, markers copied to the VPS" } else { Say "tile $n $tile done, markers NOT copied (VPS unreachable?)" }
}
Say "laptop queue finished"
Write-Host 'Finished. This window can be closed.'
