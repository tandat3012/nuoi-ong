# Nuoi Ong

Nuoi Ong is a web application with a Next.js frontend and a NestJS API.

## Project structure

- `web/` — Next.js frontend.
- `api/` — NestJS API.
- `compose.yaml` — local container environment, including PostgreSQL.

## Local setup

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

2. Set a secure local value for `POSTGRES_PASSWORD` in `.env`.

3. Start the local environment:

   ```bash
   docker compose up --build
   ```

The frontend is available at `http://localhost:3000` and the API at `http://localhost:5050`.

## Development commands

Install dependencies and run each application from its own directory:

```bash
cd web && pnpm install && pnpm dev
cd api && pnpm install && pnpm start:dev
```

## Git workflow

Read [GIT_WORKFLOW.md](GIT_WORKFLOW.md) before performing Git-related work.
