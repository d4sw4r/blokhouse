# 1. Use an official Node.js image as the base
FROM node:26-alpine AS builder

# 2. Set the working directory
WORKDIR /app

# 3. Copy package manifests and the Prisma schema (postinstall runs `prisma generate`)
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma

# 4. Install dependencies
RUN npm ci

# 5. Copy the rest of the application files
COPY . .

# 7. Build (lint and type checks run in CI)
RUN npm run build

# 8. Use a lightweight Node.js image for production
FROM node:26-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 9. Copy necessary files from the builder stage
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/.next .next
COPY --from=builder /app/public public
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/prisma prisma
COPY --from=builder /app/prisma.config.ts .
COPY --from=builder /app/src/generated src/generated
COPY --from=builder /app/scripts scripts

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# /app/data holds the one-time initial admin password file; all application
# data lives in PostgreSQL (DATABASE_URL).
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app
USER nextjs

# 10. Expose port
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

# 11. Apply migrations, seed the first admin, start
CMD ["sh", "scripts/start.sh"]
