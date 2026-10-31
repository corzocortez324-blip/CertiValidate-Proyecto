FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# Se instala la versión de Prisma CLI fijada en package-lock.json (devDependency) en vez de
# descargar una versión no verificada con npx; después se eliminan las dependencias de desarrollo.
RUN npm ci --ignore-scripts && \
    # prisma generate no conecta a la DB — los valores dummy satisfacen prisma.config.ts en build-time
    DIRECT_URL=postgresql://x:x@localhost:5432/x DATABASE_URL=postgresql://x:x@localhost:5432/x ./node_modules/.bin/prisma generate && \
    npm prune --omit=dev

COPY src ./src

# Usuario no-root para reducir superficie de ataque
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app
USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/health || exit 1

CMD ["node", "src/index.js"]
