FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npm ci --omit=dev --ignore-scripts && \
    # prisma generate no conecta a la DB — los valores dummy satisfacen prisma.config.ts en build-time
    DIRECT_URL=postgresql://x:x@localhost:5432/x DATABASE_URL=postgresql://x:x@localhost:5432/x npx prisma generate

COPY src ./src

# Usuario no-root para reducir superficie de ataque
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app
USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/health || exit 1

CMD ["node", "src/index.js"]
