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
