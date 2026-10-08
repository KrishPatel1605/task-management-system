# Task Management System (REST API)

A backend REST API where authenticated users manage tasks and **admins** get extra permissions (view all tasks, edit any task, and the exclusive right to change a task's status).

## Technologies used

- Node.js (18+) and Express.js
- PostgreSQL, accessed through [Knex](https://knexjs.org) (query builder, migrations and seeders)
- JWT (`jsonwebtoken`) for authentication, `bcryptjs` for password hashing
- `zod` for request validation, `helmet` + `cors` + `express-rate-limit` for basic hardening
- Node's built-in test runner for integration tests

## Project structure

```
.
├── knexfile.js                  # DB connection + migration/seed paths
├── .env.example
├── postman/                     # Postman collection (user + admin flows)
├── test/api.test.js             # integration tests
└── src/
    ├── server.js                # starts the HTTP server
    ├── app.js                   # Express app, middleware, routes
    ├── config/                  # environment config
    ├── db/
    │   ├── index.js             # knex instance
    │   ├── migrations/          # users + tasks tables
    │   └── seeds/               # admin + regular user + sample tasks
    ├── middleware/              # auth (JWT + role guard), validation, error handling
    ├── validators/              # zod schemas
    ├── controllers/             # auth + task logic
    ├── routes/
    └── utils/
```

## Setup

### 1. Prerequisites
Node.js 18+ and a running PostgreSQL server.

### 2. Install
```bash
npm install
```

### 3. Database configuration
Create an empty database (the migrations create the tables; no SQL file is used):
```bash
createdb task_management        # or: psql -U postgres -c "CREATE DATABASE task_management;"
```

### 4. Environment variables
```bash
cp .env.example .env            # then edit the values
```

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP port | `3000` |
| `NODE_ENV` | `development` / `production` | `development` |
| `DATABASE_URL` | Full Postgres URL (optional; overrides `DB_*`) | – |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Postgres connection | `localhost`, `5432`, `task_management`, `postgres`, – |
| `JWT_SECRET` | **Required.** Secret used to sign tokens | – |
| `JWT_EXPIRES_IN` | Token lifetime | `1d` |
| `BCRYPT_ROUNDS` | bcrypt cost factor | `10` |
| `SEED_ADMIN_PASSWORD`, `SEED_USER_PASSWORD` | Passwords used by the seeder | see below |

### 5. Run migrations and seeders
```bash
npm run db:setup        # = npm run migrate && npm run seed
```
Other helpers: `npm run migrate:rollback`, `npm run seed` (idempotent, safe to re-run).

### 6. Run the application
```bash
npm start               # normal start
npm run dev             # auto-restart on file changes
```
Health check: `GET http://localhost:3000/health`

### 7. Run the tests
Needs a migrated and seeded database (step 5):
```bash
npm test
```

## Test credentials (created by the seeder)

| Role | Email | Password |
|---|---|---|
| admin | `admin@example.com` | `Admin@123` |
| user | `user@example.com` | `User@123` |

These are development-only credentials. Change them via `SEED_*_PASSWORD` for any real deployment.

## Database schema

**users**: `id`, `name`, `email` (unique), `password` (bcrypt hash), `role` (`user` | `admin`, CHECK constraint), `created_at`, `updated_at`

**tasks**: `id`, `user_id` (FK → `users.id`, `ON DELETE CASCADE`, indexed), `title`, `description`, `status` (`Pending` | `In Progress` | `Testing` | `Completed`, CHECK constraint, default `Pending`), `created_at`, `updated_at`

One user has many tasks; every task belongs to the user who created it.

## API endpoints

Base URL: `http://localhost:3000`. Protected endpoints need the header `Authorization: Bearer <token>`.
All responses are JSON: `{ "success": true|false, "message"?, "data"?, "errors"? }`.

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | public | Register (`name`, `email`, `password` of at least 8 chars). Always creates role `user`. Returns user + token |
| POST | `/api/auth/login` | public | Login (`email`, `password`). Returns user + JWT |
| GET | `/api/auth/me` | any user | Current user |
| POST | `/api/tasks` | user, admin | Create a task (`title`, optional `description`). Status starts as `Pending` |
| GET | `/api/tasks` | user, admin | Users: own tasks. Admins: all tasks. Query: `status`, `page` (default 1), `limit` (default 10, max 100) |
| GET | `/api/tasks/:id` | owner, admin | Get one task |
| PUT | `/api/tasks/:id` | owner, admin | Update `title` and/or `description` |
| PATCH | `/api/tasks/:id/status` | **admin only** | Set `status` to one of the four allowed values |

Status codes: `400` validation error, `401` missing/invalid token or bad credentials, `403` role not allowed, `404` task not found (or not yours), `409` email already registered.

### Example
```bash
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"Admin@123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.token')

curl -X PATCH localhost:3000/api/tasks/1/status -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"status":"Testing"}'
```

## Postman

Import `postman/Task-Management-System.postman_collection.json` and run the collection (or its folders in order: Auth → Regular user → Admin → Access control checks). Logins automatically store the tokens and created task ids in collection variables, and each request has assertions. `baseUrl` defaults to `http://localhost:3000`.

## Assumptions and design decisions

- **Status is admin-only.** Task create/edit endpoints reject a `status` field (400) so regular users cannot bypass the rule. New tasks always start as `Pending`. Admins use `PATCH /api/tasks/:id/status`.
- **Admins can view and edit all users' tasks** (the brief allows this explicitly for admins). `GET /api/tasks` returns every task for admins. Tasks an admin creates belong to the admin.
- **Regular users get `404`, not `403`, for other users' tasks**, so the existence of other users' task ids is not revealed.
- **Public registration can only create regular users**; a `role` in the body is rejected. Admins exist only via seeding.
- The auth middleware re-reads the user from the database on each request, so deleted users or role changes take effect immediately even with an unexpired token.
- Passwords are stored as bcrypt hashes. Login gives the same response for an unknown email and a wrong password, and timing is equalised.
- No delete-task endpoint, since it was not requested.
- Roles and statuses use `text` columns with CHECK constraints rather than native Postgres enums, which keeps future migrations simple.
- `.env` is git-ignored; only `.env.example` with placeholder values is included.
