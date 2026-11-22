# D-044: compilar React SOMENTE no estágio de build. O servidor público
# não recebe node_modules, Vitest, Vite, fontes TS nem o lockfile.
FROM node:22-alpine AS build
WORKDIR /app

# Dependências fixadas e camada cacheável. Workspaces precisam existir no npm ci.
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/game-core/package.json ./packages/game-core/package.json
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build:web \
 && test -s /app/apps/web/dist/index.html

# Apenas arquivos efetivamente servidos pelo server.mjs (Node core-only).
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/server.mjs ./server.mjs
COPY --from=build --chown=node:node /app/landing.html ./landing.html
COPY --from=build --chown=node:node /app/assets/pokemon-gifs ./assets/pokemon-gifs
COPY --from=build --chown=node:node /app/apps/web/dist ./apps/web/dist

USER node
EXPOSE 8080
# Railway atualmente sobrepõe CMD com "npm start". Ambos iniciam o mesmo Node,
# e não existe mais npm prestart nem build em produção.
CMD ["node", "server.mjs"]
