# ONLINE-01C-12: compile the canonical combat adapter once in a disposable
# builder. Runtime remains Node + pg only: no Vite/React/TS/esbuild.
FROM node:22-alpine AS core-build
WORKDIR /build
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/game-core/package.json ./packages/game-core/package.json
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY packages/game-core/src ./packages/game-core/src
COPY scripts/build-api-game-core.mjs ./scripts/build-api-game-core.mjs
RUN node scripts/build-api-game-core.mjs /build/bundle/frozenBattle.mjs \
 && test -s /build/bundle/frozenBattle.mjs

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /srv/api
COPY --chown=node:node services/api/package.json services/api/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
 && npm cache clean --force
COPY --chown=node:node services/api/src ./src
COPY --chown=node:node services/api/sql ./sql
COPY --from=core-build --chown=node:node /build/bundle/frozenBattle.mjs ./game-core/frozenBattle.mjs
USER node
EXPOSE 8080
CMD ["node","src/server.mjs"]
