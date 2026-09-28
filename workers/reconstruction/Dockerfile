# RECON-004C: pin runtime/build tags; package retrieval occurs only at image-build time.
FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04 AS colmap-build
ARG COLMAP_GIT_REF=4.1.1
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends build-essential ca-certificates cmake git libboost-all-dev libceres-dev libeigen3-dev libflann-dev libfreeimage-dev libgflags-dev libgoogle-glog-dev libmetis-dev libsqlite3-dev ninja-build \
  && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch "${COLMAP_GIT_REF}" https://github.com/colmap/colmap.git /src/colmap \
  && git -C /src/colmap rev-parse HEAD > /build-colmap-commit \
  && cmake -S /src/colmap -B /build/colmap -GNinja -DCMAKE_BUILD_TYPE=Release -DGUI_ENABLED=OFF -DCUDA_ENABLED=ON \
  && cmake --build /build/colmap --target colmap --parallel 2

FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04
COPY --from=node:24.14.0-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=colmap-build /build/colmap/src/colmap/exe/colmap /usr/local/bin/colmap
COPY --from=colmap-build /build-colmap-commit /usr/local/share/graftvision/colmap-commit
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends libboost-program-options1.74.0 libceres2 libfreeimage3 libgflags2.2 libgoogle-glog0v5 libsqlite3-0 \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --gid 10001 graftvision \
  && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin graftvision \
  && mkdir -p /var/lib/graftvision/reconstruction \
  && chown graftvision:graftvision /var/lib/graftvision/reconstruction
WORKDIR /srv/graftvision
COPY workers/reconstruction/entrypoint.sh /usr/local/bin/graftvision-reconstruction-worker
RUN chmod 0555 /usr/local/bin/graftvision-reconstruction-worker
USER 10001:10001
ENV NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    RECONSTRUCTION_ENGINE_EXECUTABLE=/usr/local/bin/colmap \
    RECONSTRUCTION_ENGINE_REQUIRED_VERSION=4.1.1 \
    RECONSTRUCTION_CUDA_REQUIRED_VERSION=12.4 \
    RECONSTRUCTION_WORKSPACE_ROOT=/var/lib/graftvision/reconstruction
ENTRYPOINT ["/usr/local/bin/graftvision-reconstruction-worker"]
