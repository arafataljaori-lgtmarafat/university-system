# DentPilot University Production Core - Phase 1

Secure TypeScript modular-monolith foundation for the DentPilot University academic and clinical workflow. `reference/prototype-v7/` is behavior and UX reference only; it is not production code.

## Local verification

1. Install Node.js 22 or newer and Docker Compose.
2. Copy `.env.example` to `.env` and keep the development values local only.
3. Run `npm ci`.
4. Run `npm run infra:up` and wait for PostgreSQL and MinIO health checks.
5. Run `npm run db:migrate` with `MIGRATION_DATABASE_URL`; never run migrations with `DATABASE_URL`.
6. Run `npm run db:seed` with `SEED_DATABASE_URL` (or the migration credential).
7. Run `npm run test:migration`, `npm run test:integration`, and `npm run ci`.
8. Start the API with `npm run api:dev` and the diagnostic web app with `npm run web:dev`.
9. Verify `/health/live`, `/health/ready`, `/openapi.json`, and `/docs`.

`dentpilot_app` is the runtime role and must remain `NOSUPERUSER NOBYPASSRLS`. `dentpilot_migrator` is used only by the release migration/seed step. The migration fails closed if the runtime role is missing or can bypass RLS.

Production operating procedures, limitations, and acceptance gates are in `docs/operations/runbook.md` and `docs/operations/known-limitations.md`.
