#!/usr/bin/env sh
set -eu
: "${RECONSTRUCTION_WORKER_ENTRYPOINT:?RECONSTRUCTION_WORKER_ENTRYPOINT is required}"
: "${RECONSTRUCTION_WORKSPACE_ROOT:=/var/lib/graftvision/reconstruction}"
test -x /usr/local/bin/colmap
test "$(id -u)" = "10001"
test -d "$RECONSTRUCTION_WORKSPACE_ROOT"
exec node "$RECONSTRUCTION_WORKER_ENTRYPOINT"
