# Starts (or restarts) what a performance run needs on this machine, detached from ssh: the local tile server, the
# stand-in boat on port 80, and one Cockpit Lite server per build, each "name:port" serving
# Cockpit-builds\1.20.0-beta.2-<name>\resources\app\dist.
#   servers.ps1 base:5050 sz:5051 nr:5052
$dir = Join-Path $env:USERPROFILE 'e2e'
$builds = 'C:\Users\Rafael\Development\Cockpit-builds'
Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match '(tiles|serve|fake-boat)\.mjs' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
# Hidden, or the logon task leaves one console window per server on the desktop being measured.
$hidden = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }
$run = { param($cmd) $r = Invoke-CimMethod Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = $dir; ProcessStartupInformation = $hidden }
  if ($r.ReturnValue -ne 0) { throw "could not start: $cmd" } }
& $run "cmd /c node `"$dir\tiles.mjs`" `"$dir\tiles`" 8443 > `"$dir\tiles.log`" 2>&1"
& $run "cmd /c node `"$dir\fake-boat.mjs`" 80 `"$dir\sitl-messages.json`" > `"$dir\fake-boat.log`" 2>&1"
foreach ($b in $args) {
  $name, $port = $b -split ':'
  & $run "cmd /c node `"$dir\serve.mjs`" `"$builds\1.20.0-beta.2-$name\resources\app\dist`" $port > `"$dir\serve-$name.log`" 2>&1"
}
Start-Sleep 2
Get-ChildItem "$dir\*.log" | Where-Object { $_.Name -match '^(tiles|fake-boat|serve-)' } | ForEach-Object { "$($_.Name): $(Get-Content $_ -Raw)".Trim() }
