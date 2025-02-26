# 1. Use an official Node.js image as the base
FROM node:22-alpine AS builder

# 2. Set the working directory
WORKDIR /app

# 3. Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# 4. Install dependencies
RUN npm install --frozen-lockfile

# 5. Copy the rest of the application files
COPY . .

# 6. Generate prisma Client
RUN npx prisma generate

# 7. Disable ESLint and TypeScript errors during the build
RUN NEXT_DISABLE_ESLINT=1 NEXT_DISABLE_TYPECHECK=1 npm run build

# 8. Use a lightweight Node.js image for production
FROM node:22-alpine AS runner

WORKDIR /app

# 9. Copy necessary files from the builder stage
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/.next .next
COPY --from=builder /app/public public
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/prisma prisma

# 10. Expose port
EXPOSE 3000

# 11. Start the Next.js application
CMD ["npm", "run", "rs"]
