# 1. Use an official Node.js image as the base
FROM node:18-alpine AS builder

# 2. Set the working directory
WORKDIR /app

# 3. Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# 4. Install dependencies
RUN npm install --frozen-lockfile

# 5. Copy the rest of the application files
COPY . .

ENV DATABASE_URL=file:./dev.db
RUN npx prisma generate
RUN npx prisma db push


# RUN npx prisma db seed

# ENV NEXTAUTH_SECRET="dude-its-so-random"

# 6. Disable ESLint and TypeScript errors during the build
RUN NEXT_DISABLE_ESLINT=1 NEXT_DISABLE_TYPECHECK=1 npm run build

# 7. Use a lightweight Node.js image for production
FROM node:18-alpine AS runner

WORKDIR /app

# 8. Copy necessary files from the builder stage
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/.next .next
COPY --from=builder /app/public public
COPY --from=builder /app/node_modules node_modules
COPY --from=builder ./app/prisma/dev.db /app/dev.db

# 9. Expose port
EXPOSE 3000

# 10. Start the Next.js application
CMD ["npm", "run", "start"]
