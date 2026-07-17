# OPS-03 Rollback Target

Rollback target preserved before OPS-03 changes:

- Project: `one-time-ot99-staging-96b42905`
- Project ID: `7c8eee26-7a6a-4684-826d-9f4377d67d46`
- Environment: `staging`
- Environment ID: `11edf8a2-0160-45b4-a039-b15b4beb4c10`

## Web

- Service: `ot99-web`
- Service ID: `9fb6d9f4-4f50-4df6-868b-c18a9b83d2f2`
- Deployment ID: `e2821230-66ed-4dca-87f5-a01a4137b4df`
- Builder: Nixpacks via `/railway.web.staging.json`
- Deployment message: `OPS-02 exact SHA 96b429053d13a139595ed3bd0ea3c854cc2500e8 web nixpacks-no-dockerfile`
- Image digest: `sha256:8137fe4d1db1f8bf9436a8a35ecc5bc1b1a6f49cf98efd63dd9c61ec589c8b62`

## Worker

- Service: `ot99-worker`
- Service ID: `76e7fdc2-99b9-4a82-ba55-5dff3723398f`
- Deployment ID: `26327b9e-0dc8-474b-8148-882f016f5379`
- Builder: Nixpacks via `/railway.worker.staging.json`
- Deployment message: `OPS-02 exact SHA 96b429053d13a139595ed3bd0ea3c854cc2500e8 worker nixpacks-no-dockerfile`
- Image digest: `sha256:afcf30272bb5a62d448c8c2c25c2b83a20085b17b5492caa03caadad98958d6f`

## Original PostgreSQL Service

- Service: `Postgres`
- Service ID: `e6671cb7-178a-4821-b977-7b6e24c0c052`
- Deployment ID: `738803fe-935b-4e02-b2b7-c71c3df10972`
- Image: `ghcr.io/railwayapp-templates/postgres-ssl:18`
- Volume ID: `8d070607-8692-4c1a-88cd-0231fb593e68`

## Procedure

1. Keep this rollback target available until the OPS-03 Docker deployment is healthy.
2. If the OPS-03 web or worker deployment fails, redeploy the listed OPS-02 Nixpacks deployment or reset service configuration to the listed Nixpacks config files and redeploy SHA `96b429053d13a139595ed3bd0ea3c854cc2500e8`.
3. If PG16 switch fails, repoint isolated staging web/worker `DATABASE_URL` to the original isolated staging PostgreSQL service and redeploy.
4. Do not touch production, DNS, BNA runtime, real sends, real charges, or provider canaries during rollback.
