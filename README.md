# Nuoi Ong

Nuoi Ong combines farm equipment, materials, warehouse, asset, and maintenance management with a public customer storefront. The frontend uses Next.js 16 / React 19; the API uses NestJS 11, Drizzle ORM, and PostgreSQL. Clerk handles authentication.

## Project structure

```text
nuoi-ong/
├── web/
│   ├── app/                 # (auth), (dashboard), and (store) route groups
│   ├── features/            # Business UI, hooks, endpoint functions, and types
│   ├── shared/              # API transport, UI, layout, configuration, and types
│   ├── public/              # Static assets
│   └── proxy.ts             # Clerk protection for management routes
├── api/
│   ├── src/
│   │   ├── main.ts          # Validation, CORS, /api/v1 prefix, Swagger
│   │   ├── app.module.ts    # Module composition
│   │   ├── modules/         # auth, catalog, materials, warehouses, inventory,
│   │   │                    # assets, maintenance, commerce
│   │   ├── db/              # PostgreSQL connection and Drizzle schema
│   │   ├── common/          # Pagination, query validation, OpenAPI helpers
│   │   └── cloudinary/      # Image upload integration
│   ├── drizzle/             # SQL migrations and migration metadata
│   ├── scripts/             # Core and storefront seed scripts
│   └── test/                # HTTP and database integration tests
├── Dockerfile               # Web and API build targets
├── compose.yaml             # Web :3000, API :5050, PostgreSQL :5435 on host
└── graphify-out/             # Local generated graph, HTML, and audit report
```

`web/` and `api/` have separate package manifests, lockfiles, and pnpm workspace files; run package commands in the relevant application directory.

Management requests carry a Clerk JWT and, for farm-scoped operations, a `farmId` query parameter. Controllers enforce access and call services backed by Drizzle. The public `/api/v1/store` endpoints read the curated storefront catalog and availability from the configured sales warehouse. The browser cart does not reserve stock; checkout and order APIs are not implemented.

See [frontend routes and architecture](web/README.md), [feature ownership](web/features/README.md), [API modules and database layout](api/README.md), and [storefront implementation](web/features/commerce/README.md).

The local [Graphify report](graphify-out/GRAPH_REPORT.md) and [interactive graph](graphify-out/graph.html) describe extracted relationships. `graphify-out/` is ignored by Git, so these artifacts are available only after generation in the current checkout. Asset work is described in [the specification](ASSET_MANAGEMENT_SPEC.md) and [implementation phases](ASSET_MANAGEMENT_PHASES.md); those documents include planned work as well as implemented behavior.

## Local setup

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

2. Set `POSTGRES_PASSWORD`, `CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY` in `.env` for your local environment.

3. Start the local environment:

   ```bash
   docker compose up --build
   ```

The frontend is available at `http://localhost:3000` and the API at `http://localhost:5050`.

## Development commands

For processes running outside Docker, configure `api/.env` from `api/.env.example` and `web/.env.local` from `web/.env.example`. Set the web app's `NEXT_PUBLIC_API_URL` to `http://localhost:5050` for a local API. Run each application in its own terminal:

```bash
cd web && pnpm install && pnpm dev
cd api && pnpm install && pnpm start:dev
```

## Git workflow

Read [GIT_WORKFLOW.md](GIT_WORKFLOW.md) before performing Git-related work.
