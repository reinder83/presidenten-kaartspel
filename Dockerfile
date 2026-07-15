# ---- Build the client ----
FROM node:22-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- Build the server ----
FROM node:22-alpine AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# ---- Runtime image ----
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=server-build /app/server/dist ./dist
COPY --from=client-build /app/client/dist ./public
EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
