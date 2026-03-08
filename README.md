# Schedule Manager - Spring 2026

University Schedule Management System for London Metropolitan University built with **Next.js** (frontend) and **NestJS** (backend).

## Features

- **View schedules** in Table or Timetable (weekly grid) views
- **Filter** by program (BIT/BBA), year, section, day, class type, instructor, room, and module
- **CRUD operations** - Create, edit, and delete schedule entries
- **Statistics dashboard** - See class counts by type and instructor count
- **Swagger API docs** at `/api/docs`
- **443 schedule records** pre-seeded from the Spring 2026 Excel timetable

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

### 1. Backend (NestJS - Port 3001)

```bash
cd backend
npm install
npm run seed      # Populate database from Excel data
npm run start:dev # Start dev server on port 3001
```

### 2. Frontend (Next.js - Port 3000)

```bash
cd frontend
npm install
npm run dev       # Start dev server on port 3000
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### API Documentation

Swagger UI available at [http://localhost:3001/api/docs](http://localhost:3001/api/docs)

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

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: NestJS 11, TypeORM, SQLite, Swagger
- **Data**: Extracted from "Time Schedule for Spring 2026.xlsx"
