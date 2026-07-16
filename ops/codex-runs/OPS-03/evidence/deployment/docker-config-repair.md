# OPS-03 Docker Config Repair

Initial OPS-03 web deploy attempt:

- Deployment ID: `40fc8171-0a4e-42d3-ae31-80252a5281a8`
- Status: `FAILED`
- Failure point: before associated build.
- Railway config error: service config at `railway.web.staging.json` not found.
- Active rollback web deployment after failure: `e2821230-66ed-4dca-87f5-a01a4137b4df`, still running.

Repair:

- Added `railway.web.staging.json`.
- Added `railway.worker.staging.json`.
- Both service config files select `DOCKERFILE` builder and `Dockerfile`.

Docker build proof is pending the next successful Railway deployment.

## Runtime File Repair

Second OPS-03 web deploy attempt:

- Deployment ID: `f43e7c54-fca3-45d9-8680-d7d63bda5ae4`
- Dockerfile build: succeeded.
- Docker image digest reported by Railway build logs: `sha256:664187da5fda5268046ce6482c2c48409e55268db07ed005988cde62bb82c7d8`
- Runtime health: failed.
- Root cause: `/app/ops/commercial/ot87/family-plan.v1.json` was absent from the Docker runtime image.

Repair:

- Dockerfile now copies `ops/commercial` into the build and runtime stages.
- The production image still does not copy `tests/`.
