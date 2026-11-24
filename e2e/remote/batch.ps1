# Started by the E2EBatch scheduled task, so the harness runs on this machine's logged-in desktop (session 1) and
# drives the app with no network in between. Runs each line of batch.txt with cmd, in order, each into its own
# run-<n>.log; batch.log gets one line per run, so it can be read while the batch goes on. A run that takes longer
# than 6 minutes is stopped, with its test app, and the batch moves on.
$dir = Join-Path $env:USERPROFILE 'e2e'
$log = Join-Path $dir 'batch.log'
Set-Location (Join-Path $dir 'harness')
Remove-Item "$dir\run-*.log" -ErrorAction SilentlyContinue
"BATCH START $(Get-Date -Format o)" | Set-Content $log
$n = 0
foreach ($line in Get-Content (Join-Path $dir 'batch.txt')) {
  if (-not $line.Trim() -or $line.StartsWith('#')) { continue }
  $n++
  $runLog = Join-Path $dir "run-$n.log"
  $p = Start-Process cmd -ArgumentList "/c $line > `"$runLog`" 2>&1" -PassThru -WindowStyle Hidden
  if (-not $p.WaitForExit(360000)) {
    Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'node.exe' -and $_.CommandLine -match 'run\.mjs') -or ($_.Name -match '^(chrome|Cockpit)\.exe$' -and $_.CommandLine -match 'cockpit-e2e-') } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    "RUN $n TIMED OUT" | Add-Content $runLog
  }
  $summary = (Get-Content $runLog | Select-String '^\s*(\S+ )?(PERF-\d|wheel zoom:|drag pan:|idle:|RUN .* TIMED OUT)' | ForEach-Object { $_.Line.Trim() }) -join ' | '
  "RUN $n $summary" | Add-Content $log
}
"BATCH DONE $(Get-Date -Format o)" | Add-Content $log
