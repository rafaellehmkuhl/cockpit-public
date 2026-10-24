# ArduRover SITL for the talk's boat, the same build as on the laptop: Rover-4.6.3, motorboat frame.
FROM debian:bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git g++ make python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch Rover-4.6.3 https://github.com/ArduPilot/ardupilot.git /ardupilot \
    && cd /ardupilot && git submodule update --init --depth 1 modules/waf modules/mavlink modules/DroneCAN/libcanard \
       modules/DroneCAN/dronecan_dsdlc modules/DroneCAN/pydronecan modules/DroneCAN/DSDL
RUN python3 -m venv /venv && /venv/bin/pip install -q empy==3.3.4 pexpect future pymavlink lxml dronecan
WORKDIR /ardupilot
RUN . /venv/bin/activate && ./waf configure --board sitl && ./waf rover -j4

FROM debian:bookworm-slim
COPY --from=build /ardupilot/build/sitl/bin/ardurover /usr/local/bin/ardurover
COPY --from=build /ardupilot/Tools/autotest/default_params/rover.parm /ardupilot/Tools/autotest/default_params/motorboat.parm /params/
COPY extra.parm /params/extra.parm
# The parameters and mission the SITL writes live here, so they survive a restart.
WORKDIR /data
CMD ["ardurover", "--model", "motorboat", "--home", "-27.5935,-48.4525,0,20", \
     "--defaults", "/params/rover.parm,/params/motorboat.parm,/params/extra.parm", "-I0"]
