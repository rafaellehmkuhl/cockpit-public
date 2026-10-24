#!/bin/sh
# Copy the demo server to the VPS and recreate its container. The first deploy generates the control key there.
set -eu
DIR=/root/docker-projects/apdc-demos
HERE=$(dirname "$0")
ssh vps "mkdir -p $DIR && { [ -f $DIR/.env ] || echo CONTROL_KEY=\$(openssl rand -hex 12) > $DIR/.env; }"
scp -q -r "$HERE/server.mjs" "$HERE/index.html" "$HERE/join.html" "$HERE/vendor" "$HERE/docker-compose.yml" vps:$DIR/
ssh vps "cd $DIR && docker compose up -d --force-recreate"
