FROM node:20-alpine AS builder

WORKDIR /app

COPY artifacts/api-server/package.json artifacts/api-server/pnpm-lock.yaml* ./
COPY lib/api-spec/package.json lib/api-spec/pnpm-lock.yaml* ./lib/api-spec/
COPY lib/api-zod/package.json lib/api-zod/pnpm-lock.yaml* ./lib/api-zod/
COPY lib/api-client-react/package.json lib/api-client-react/pnpm-lock.yaml* ./lib/api-client-react/

RUN corepack enable && pnpm install --frozen-lockfile=false

COPY artifacts/api-server/src ./src
COPY artifacts/api-server/build.mjs ./
COPY lib/api-zod/src ./lib/api-zod/src
COPY lib/api-client-react/src ./lib/api-client-react/src
COPY lib/api-spec/openapi.yaml ./lib/api-spec/openapi.yaml

RUN pnpm --filter @remotectrl/api-zod generate || true
RUN pnpm --filter @remotectrl/api-client-react generate || true
RUN node build.mjs

FROM node:20-alpine AS runtime

ARG PORT=3000

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

COPY artifacts/api-server/package.json ./

EXPOSE ${PORT}

ENV NODE_ENV=production
ENV PORT=${PORT}

CMD ["node", "dist/index.mjs"]
