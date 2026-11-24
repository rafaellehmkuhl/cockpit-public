#!/usr/bin/env bash
# Run a batch of harness commands on the measured machine itself and bring the results back. The harness runs there
# (remote/batch.ps1, started by the E2EBatch task on the logged-in desktop) against the stand-in boat, local tiles and
# Cockpit Lite servers started by remote/servers.ps1, so nothing crosses the network while it measures: the link to the
# box only carries this script's start, its polling, and the copy back, all of which survive the link dropping.
#   remote/box-batch.sh <batch.txt> <local results folder> [host]
# batch.txt holds one cmd.exe line per run, run from the harness folder, e.g.
#   set PERF_TILES=1&& node run.mjs PERF-92 --arms bare --app "C:\...\chrome.exe" --url http://127.0.0.1:5050 --vehicle 127.0.0.1 --out C:\Users\Rafael\e2e\out\<name>
set -euo pipefail
batch=$1
results=$2
host=${3:-desktop}
here=$(cd "$(dirname "$0")/.." && pwd)
ssh_=(ssh -o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=10)
scp_=(scp -q -o BatchMode=yes -o ConnectTimeout=15)
# Retries a command while the link is down, for up to 30 min.
retry() { for i in $(seq 1 90); do "$@" 2>/dev/null && return 0; sleep 20; done; return 1; }

tgz=$(mktemp -t harness).tgz
(cd "$here" && COPYFILE_DISABLE=1 tar czf "$tgz" run.mjs lib cases fixtures remote)
retry "${scp_[@]}" "$tgz" "$here/remote/batch.ps1" "$host:e2e/"
retry "${scp_[@]}" "$batch" "$host:e2e/batch.txt"
rm -f "$tgz"
retry "${ssh_[@]}" "$host" '$d="$env:USERPROFILE\e2e"; Remove-Item -Recurse -Force "$d\harness" -ErrorAction SilentlyContinue;
  New-Item -ItemType Directory -Force "$d\harness" | Out-Null; tar -xzf "$d\$(Split-Path -Leaf (Get-ChildItem $d\*.tgz | Sort LastWriteTime | Select -Last 1))" -C "$d\harness";
  Get-ChildItem -Recurse -Force "$d\harness" -Filter "._*" | Remove-Item -Force; Remove-Item "$d\*.tgz"; Remove-Item "$d\batch.log" -ErrorAction SilentlyContinue; Start-ScheduledTask E2EBatch'
echo "batch started on $host"

seen=0
until retry "${ssh_[@]}" "$host" 'Get-Content $env:USERPROFILE\e2e\batch.log -ErrorAction Stop' > "$results.log.tmp" && grep -q "BATCH DONE" "$results.log.tmp"; do
  lines=$(wc -l < "$results.log.tmp")
  [ "$lines" -gt "$seen" ] && tail -n +"$((seen + 1))" "$results.log.tmp"
  seen=$lines
  sleep 30
done
tail -n +"$((seen + 1))" "$results.log.tmp"
mkdir -p "$results"
mv "$results.log.tmp" "$results/batch.log"
# The run logs and every --out folder the batch named, packed on the box and copied back in one go: many small files
# over a flaky link took minutes.
outs=$(grep -o -- '--out [^ ]*' "$batch" | awk '{print $2}' | sort -u | sed 's#^C:\\Users\\Rafael\\e2e\\##' | tr '\n' ' ')
retry "${ssh_[@]}" "$host" "cd \$env:USERPROFILE\\e2e; tar -czf results.tgz (Get-ChildItem run-*.log).Name $outs"
retry "${scp_[@]}" "$host:e2e/results.tgz" "$results/results.tgz"
tar -xzf "$results/results.tgz" -C "$results" && rm "$results/results.tgz"
echo "results in $results"
