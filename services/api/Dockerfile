# ONLINE-01B — separate private API; never ship Vite, React, GIFs or
# browser game. Requires services/api/package-lock.json generated with npm.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /srv/api
COPY --chown=node:node services/api/package.json services/api/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
 && npm cache clean --force
COPY --chown=node:node services/api/src ./src
COPY --chown=node:node services/api/sql ./sql
USER node
EXPOSE 8080
CMD ["node","src/server.mjs"]
