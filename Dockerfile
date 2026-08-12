# syntax=docker/dockerfile:1

ARG BUN_VERSION=1.3.14

FROM oven/bun:${BUN_VERSION}-alpine AS build

WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
RUN bun install --frozen-lockfile

COPY src ./src
COPY tests ./tests
COPY public ./public
COPY train-ticket-be.json ./train-ticket-be.json

RUN bun run check
RUN rm -rf node_modules && bun install --frozen-lockfile --production

FROM oven/bun:${BUN_VERSION}-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    GRAPH_DATA_PATH=/app/train-ticket-be.json

COPY --from=build --chown=bun:bun /app/node_modules ./node_modules
COPY --chown=bun:bun package.json ./package.json
COPY --chown=bun:bun src ./src
COPY --chown=bun:bun public ./public
COPY --chown=bun:bun train-ticket-be.json ./train-ticket-be.json
COPY --chown=bun:bun --chmod=755 start.sh ./start.sh

USER bun

EXPOSE 3000

ENTRYPOINT ["./start.sh"]

