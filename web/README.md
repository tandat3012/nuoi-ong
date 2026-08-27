# Nuôi Ong Web

Next.js frontend for the V1 equipment, tools, materials, inventory, assets, and maintenance scope.

## Architecture

- `app/` owns routes, layouts, loading states, and error boundaries.
- `features/` owns business-capability UI and feature-specific code.
- `shared/` owns generic API transport, layout components, configuration, and cross-feature types.

Feature folders follow business capabilities rather than database tables. See [`features/README.md`](features/README.md) for the local convention.

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The frontend expects the NestJS API at `http://localhost:5050` by default. Override it with `NEXT_PUBLIC_API_URL` when needed.

## V1 routes

- `/dashboard`
- `/catalog`
- `/inventory`
- `/receipts`
- `/issues`
- `/assets`
- `/maintenance`
- `/scan` and `/scan/[assetCode]`

## Checks

```bash
pnpm lint
pnpm build
```
