FROM node:22-bookworm-slim AS frontend-build
WORKDIR /workspace/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts
COPY frontend/index.html frontend/vite.config.js ./
COPY frontend/src ./src
RUN npm run build

FROM node:22-bookworm-slim AS backend-dependencies
WORKDIR /workspace/backend
COPY backend/package.json backend/package-lock.json ./
COPY backend/prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3001 STATIC_DIR=/app/public ENABLE_LEGACY_ROUTES=false
WORKDIR /app
COPY --from=backend-dependencies --chown=node:node /workspace/backend/node_modules ./node_modules
COPY --chown=node:node backend/package.json backend/package-lock.json ./
COPY --chown=node:node backend/src/index.js ./src/index.js
COPY --chown=node:node backend/src/middleware/auth.js ./src/middleware/auth.js
COPY --chown=node:node backend/src/routes/auth.js backend/src/routes/damageClaims.js ./src/routes/
COPY --chown=node:node backend/src/services/claimProviders.js backend/src/services/damageClaimWorkflow.js ./src/services/
COPY --chown=node:node backend/scripts ./scripts
COPY --chown=node:node backend/prisma ./prisma
COPY --from=frontend-build --chown=node:node /workspace/frontend/dist ./public
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=4 CMD ["node", "-e", "fetch('http://127.0.0.1:3001/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "src/index.js"]
