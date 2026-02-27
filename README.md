# Schedule Hub

Monorepo timetable platform with:
- `Next.js` frontend (`apps/web`) split into **Admin Workspace** and **User Portal**.
- `NestJS` API + websocket gateway (`apps/api`).
- `PostgreSQL` + `Prisma` for source of truth and versioned schedules.
- `Redis` for cache, pub/sub, and `BullMQ` queues.
- XLSX parser package with canonical `Module View` mapping (`packages/parser`).

## Workspace Layout

- `apps/web`: route groups and separate shells.
  - Admin: `/admin/dashboard`, `/admin/board`, `/admin/imports`, `/admin/versions`, `/admin/conflicts`, `/admin/requests`, `/admin/approvals`, `/admin/policies`, `/admin/users`, `/admin/mappings`, `/admin/analytics`, `/admin/notifications`.
  - Portal: `/portal/my-week`, `/portal/today`, `/portal/rooms`, `/portal/notifications`, `/portal/calendar`, `/portal/profile`.
- `apps/api`: auth, imports, board API, mappings, notifications, analytics, calendar export, websocket realtime.
- `apps/api/src/worker.ts`: worker process for import queue, governance queues, and email delivery queue.
- `packages/parser`: XLSX parser, normalization, conflict detection.
- `packages/shared-types`: shared zod contracts.
- `infra/docker`: dev/prod compose + Dockerfiles + nginx config.

## Core Features

- Multi-role auth (`admin`, `staff`, `viewer`) with strict workspace split.
- Upload XLSX -> queued import -> parse/normalize/validate -> draft/validated/active version lifecycle.
- Parser priority: `Module View` -> repeated header tables -> `Week 0` exceptions.
- Activation guardrails with conflict checks and atomic activate/archive swap.
- Excel-style weekly board API (`GET /board/weekly`) for room-column rendering.
- Explicit user-lecturer mappings (`/admin/mappings`) with alias fallback when no explicit mapping exists.
- Notifications subsystem:
  - In-app notifications (`/portal/notifications`).
  - Alert rules (`/admin/notifications/rules`).
  - Email delivery queue + delivery logs (`alerts-email` queue).
- Calendar export (`GET /portal/calendar.ics`).
- Admin analytics (`/admin/analytics/lecturers`, `/admin/analytics/rooms`).
- Websocket events:
  - existing import/schedule/room events
  - `board.updated`
  - `notification.created`
  - `analytics.refreshed`
  - `request.created`
  - `request.submitted`
  - `approval.pending`
  - `approval.decided`
  - `policy.violation`
- Governance core:
  - governed request APIs (`/admin/requests/*`)
  - approval queue APIs (`/admin/approvals/*`)
  - policy studio APIs (`/admin/policies/*`)
  - risk/impact snapshots and immutable audit trail on state transitions

## Local Development (without Docker)

1. Install dependencies:

```bash
pnpm install
```

2. Generate Prisma client and sync DB:

```bash
pnpm --filter @schedule/api prisma:generate
pnpm --filter @schedule/api prisma:push
pnpm --filter @schedule/api prisma:seed
```

3. Start all services:

```bash
pnpm dev
```

Default seeded users:
- admin: `admin@schedule.local` / `admin12345`
- staff: `staff@schedule.local` / `staff12345`
- viewer: `viewer@schedule.local` / `viewer12345`

## Docker Development

```bash
cd infra/docker
docker compose -f docker-compose.dev.yml --env-file .env.dev up --build
```

Access:
- Web: `http://localhost:3000`
- API: `http://localhost:4000`

## Docker Production (Local Server / LAN)

```bash
cd infra/docker
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Nginx serves on port `80`.

## Environment Notes

New alert/email env vars:
- `ENABLE_TEST_EMAIL_ENDPOINT`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

If SMTP is unset, in-app notifications still work and email logs are marked failed.

For local Prisma migrations outside Docker, export `DATABASE_URL` first.

## Notes

- Default timezone: `Asia/Kathmandu`.
- Redis cache prefixes:
  - `schedule:active:*`
  - `rooms:availability:*`
  - `notifications:user:*`
- BullMQ queues:
  - `imports-schedule`
  - `requests-evaluation`
  - `approvals-notifications`
  - `alerts-email`
- Legacy routes (`/dashboard`, `/my-schedule`, `/rooms`, `/imports`, `/conflicts`) redirect to new workspace routes.
