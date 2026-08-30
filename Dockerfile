ARG NODE_VERSION=22-bookworm-slim

# ==========================================
# BASE
# ==========================================
FROM node:${NODE_VERSION} AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable \
    && corepack prepare pnpm@11.15.1 --activate


# ==========================================
# WEB BUILD
# ==========================================
FROM base AS web-build

WORKDIR /app

ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

COPY web/package.json \
     web/pnpm-lock.yaml* \
     web/pnpm-workspace.yaml* \
     ./

RUN --mount=type=cache,id=pnpm-web,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY web/ ./

RUN --mount=type=cache,id=nextjs,target=/app/.next/cache \
    pnpm build


# ==========================================
# WEB RUNTIME
# ==========================================
FROM node:${NODE_VERSION} AS web

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=web-build --chown=node:node /app/public ./public
COPY --from=web-build --chown=node:node /app/.next/standalone ./
COPY --from=web-build --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

CMD ["node", "server.js"]


# ==========================================
# API BUILD
# ==========================================
FROM base AS api-build

WORKDIR /app

COPY api/package.json \
     api/pnpm-lock.yaml* \
     api/pnpm-workspace.yaml* \
     ./

RUN --mount=type=cache,id=pnpm-api,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY api/ ./

RUN pnpm build

RUN --mount=type=cache,id=pnpm-api,target=/pnpm/store \
    pnpm prune --prod


# ==========================================
# API RUNTIME
# ==========================================
FROM node:${NODE_VERSION} AS api

WORKDIR /app

ENV NODE_ENV=production

COPY --from=api-build --chown=node:node /app/package.json ./package.json
COPY --from=api-build --chown=node:node /app/node_modules ./node_modules
COPY --from=api-build --chown=node:node /app/dist ./dist

USER node

EXPOSE 5050

CMD ["node", "dist/main.js"]
