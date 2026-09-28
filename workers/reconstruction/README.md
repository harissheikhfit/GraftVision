# CUDA reconstruction worker

RECON-004C defines a Linux/NVIDIA-only worker image for COLMAP 4.1.1 and CUDA 12.4. The image builds COLMAP during image construction, records the resolved source commit at `/usr/local/share/graftvision/colmap-commit`, and performs no package download while processing a job.

Run it with the NVIDIA Container Toolkit, a read-only root filesystem, one explicitly selected GPU, a bounded writable mount at `/var/lib/graftvision/reconstruction`, no Docker socket, no privileged mode, and no broad host mounts. The entrypoint requires a server-owned worker entrypoint and never accepts storage paths, clinic input, or secrets from a clinic client.

The local macOS developer path remains sparse-only. A dense-required job must fail closed without the CUDA worker; sparse mode is never reported as dense.
