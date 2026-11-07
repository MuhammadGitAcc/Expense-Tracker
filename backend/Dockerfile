# Backend image. Build from the backend/ folder:  docker build -t expense-tracker-api .
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies first so this layer is cached until package files change.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY database ./database

# Writable folders for logs and uploads, then drop root privileges.
RUN mkdir -p logs uploads && chown -R node:node /app
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/v1/health || exit 1

CMD ["node", "src/server.js"]