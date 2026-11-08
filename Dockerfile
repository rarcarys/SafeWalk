FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24-bookworm-slim AS api
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY scripts/postgres-local.cjs ./scripts/postgres-local.cjs
COPY src/data ./src/data
USER node
EXPOSE 3001
CMD ["node", "server/auth.cjs"]
