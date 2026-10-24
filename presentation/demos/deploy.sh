#!/bin/sh
# Copy the demo server and the boat SITL to the VPS and recreate their containers. The first deploy generates the
# control key and the SITL's secret path there; neither ever leaves the VPS.
set -eu
DIR=/root/docker-projects/apdc-demos
HERE=$(dirname "$0")
ssh vps "mkdir -p $DIR && { [ -f $DIR/.env ] || echo CONTROL_KEY=\$(openssl rand -hex 12) > $DIR/.env; } && { grep -q ^SITL_PATH= $DIR/.env || echo SITL_PATH=\$(openssl rand -hex 12) >> $DIR/.env; }"
scp -q -r "$HERE/server.mjs" "$HERE/index.html" "$HERE/join.html" "$HERE/obstacle-map.js" "$HERE/vendor" "$HERE/sitl" "$HERE/docker-compose.yml" vps:$DIR/
# The SITL only restarts when its image changes; the demo server always restarts to pick up its mounted files.
ssh vps "cd $DIR && docker compose up -d --build && docker compose up -d --force-recreate apdc-demos"
