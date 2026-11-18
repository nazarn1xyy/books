# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace @libify/api --include-workspace-root
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @libify/api

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN npm install --no-save --omit=dev @node-rs/argon2@2.2.2 && npm cache clean --force
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/drizzle ./drizzle
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "--max-old-space-size=96", "dist/server.js"]
