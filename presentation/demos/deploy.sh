#!/bin/sh
# Copy the demo server and the boat SITL to the VPS and recreate their containers. The first deploy generates the
# control key, the SITL's and camera's secret paths and the camera's publish password there; none ever leaves the VPS.
set -eu
DIR=/root/docker-projects/apdc-demos
HERE=$(dirname "$0")
ssh vps "mkdir -p $DIR && { [ -f $DIR/.env ] || echo CONTROL_KEY=\$(openssl rand -hex 12) > $DIR/.env; } && for key in SITL_PATH CAMERA_PATH CAMERA_PUBLISH_PASS; do grep -q ^\$key= $DIR/.env || echo \$key=\$(openssl rand -hex 12) >> $DIR/.env; done"
scp -q -r "$HERE/server.mjs" "$HERE/index.html" "$HERE/join.html" "$HERE/camera-world.html" "$HERE/obstacle-map.js" "$HERE/gimbal-view.js" "$HERE/diy-widget" "$HERE/vendor" "$HERE/sitl" "$HERE/camera" "$HERE/docker-compose.yml" vps:$DIR/
# The RTSP server's publish password goes into its config on the VPS, so it never leaves there.
ssh vps "cd $DIR && sed \"s/__PUBLISH_PASS__/\$(grep ^CAMERA_PUBLISH_PASS= .env | cut -d= -f2)/\" camera/mediamtx.yml > camera/mediamtx.rendered.yml"
# The SITL only restarts when its image changes; the demo server always restarts to pick up its mounted files.
ssh vps "cd $DIR && docker compose up -d --build && docker compose up -d --force-recreate apdc-demos"
