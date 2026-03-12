# Schedule Manager - Spring 2026

University Schedule Management System for London Metropolitan University built as a single **Next.js** app with App Router API routes for Vercel deployment.

## Features

- **View schedules** in Table or Timetable (weekly grid) views
- **Filter** by program (BIT/BBA), year, section, day, class type, instructor, room, and module
- **CRUD operations** - Create, edit, and delete schedule entries
- **Statistics dashboard** - See class counts by type and instructor count
- **JWT auth** with admin and instructor roles
- **WhatsApp + Telegram webhook support**
- **368 schedule records** seedable from the Spring 2026 timetable dataset

## Data Model

Each schedule entry contains:
- **Day** (Sunday-Friday)
- **Time** (start/end)
- **Class Type** (Lecture, Tutorial, Workshop)
- **Module** (code + title)
- **Instructor**
- **Group** (e.g., C1, C1+C2+C3)
- **Room** (name, block, level)
- **Program** (BIT/BBA) + Year + Section

## Quick Start

### 1. Install

```bash
cd frontend
npm install
```

### 2. Configure environment

```bash
# Required for Vercel / production
DATABASE_URL=postgresql://...
JWT_SECRET=...

# Optional integrations
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
VALIDATE_TWILIO_SIGNATURE=false
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
```

### 3. Seed local development data

```bash
cd frontend
npm run seed
```

If `DATABASE_URL` is not set locally, the app uses `frontend/data/scheduler.db`.

### 4. Start development

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Vercel

- Set the Vercel project root to `frontend/`
- Keep `DATABASE_URL` pointed at Postgres in Vercel
- Configure Telegram to call `POST /api/telegram/webhook`
- Configure Twilio to call `POST /whatsapp/webhook`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schedules` | List schedules (with filters) |
| GET | `/api/schedules/:id` | Get single schedule |
| POST | `/api/schedules` | Create schedule |
| PUT | `/api/schedules/:id` | Update schedule |
| DELETE | `/api/schedules/:id` | Delete schedule |
| GET | `/api/schedules/instructors` | List all instructors |
| GET | `/api/schedules/rooms` | List all rooms |
| GET | `/api/schedules/programs` | List all programs |
| GET | `/api/schedules/sections` | List all sections |
| GET | `/api/schedules/modules` | List all modules |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user |
| GET | `/api/announcements` | Active announcements |
| GET | `/api/programs/summary` | Program analytics |
| GET | `/api/instructors/dashboard` | Dashboard stats |
| POST | `/api/telegram/webhook` | Telegram webhook |
| POST | `/whatsapp/webhook` | Twilio WhatsApp webhook |

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Server layer**: Next.js Route Handlers, TypeORM, Zod
- **Database**: Postgres on Vercel, SQLite for local development
- **Data**: Extracted from "Time Schedule for Spring 2026.xlsx"
