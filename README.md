# Expense Tracker

A full-stack expense tracking app: React (Vite) frontend, Node.js/Express API and PostgreSQL database.

> Status: under active development. See `PROJECT_PLAN.txt` for the build plan and progress.

## Tech stack

- **Frontend:** React 19, Vite, React Router, TanStack Query, Redux Toolkit, Tailwind CSS, Recharts, i18next
- **Backend:** Node.js, Express, PostgreSQL (`pg`), JWT auth, Zod validation
- **Tooling:** ESLint, Prettier, Docker Compose, Jest, Vitest

## Prerequisites

- Node.js 20+ and npm
- PostgreSQL 15+ (or Docker)
- Git

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/MuhammadGitAcc/Expense-Tracker.git
cd Expense-Tracker
cd backend && npm install
cd ../frontend && npm install
```

### 2. Database

Create a PostgreSQL user and database, or run `docker compose up -d postgres`
(the container listens on port 5433).

```sql
CREATE USER expense_user WITH PASSWORD 'your_password';
CREATE DATABASE expense_tracker OWNER expense_user;
```

### 3. Environment files

```bash
cp backend/.env.example backend/.env     # then edit DATABASE_URL and the JWT secrets
cp frontend/.env.example frontend/.env
```

### 4. Run

```bash
# terminal 1
cd backend && npm run dev     # API on http://localhost:5000

# terminal 2
cd frontend && npm run dev    # app on http://localhost:5173
```

## Useful scripts

| Where    | Command           | What it does                  |
| -------- | ----------------- | ----------------------------- |
| backend  | `npm run dev`     | Start API with auto-reload    |
| backend  | `npm run migrate` | Run database migrations       |
| backend  | `npm run seed`    | Insert default data           |
| backend  | `npm test`        | Run backend tests             |
| frontend | `npm run dev`     | Start the dev server          |
| frontend | `npm run build`   | Production build              |
| both     | `npm run lint`    | Lint the code                 |
| both     | `npm run format`  | Format the code with Prettier |

## Project structure

```
backend/    Express API (routes, controllers, services, repositories)
frontend/   React app (pages, features, components)
docs/       Architecture, schema, API and deployment docs
```

## License

MIT
