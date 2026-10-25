# Renders the camera world in headless Chromium and publishes it over RTSP with ffmpeg.
FROM node:22-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium ffmpeg fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY stream.mjs .
CMD ["node", "stream.mjs"]
