# Contributing to Blokhouse

Thank you for your interest in Blokhouse! This guide will help you get started.

## Local Setup

### Prerequisites
- Node.js >= 18
- Git

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/d4sw4r/blokhouse.git
   cd blokhouse
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

4. **Set up the database**
   ```bash
   # PostgreSQL is required, e.g.:
   docker run -d --name blokhouse-db -p 5432:5432 \
     -e POSTGRES_USER=blokhouse -e POSTGRES_PASSWORD=change-me -e POSTGRES_DB=blokhouse postgres:16-alpine
   npm run db:migrate
   npx prisma db seed
   ```

   Changing `prisma/schema.prisma`? Create a migration and commit it:
   ```bash
   npx prisma migrate dev --name describe-your-change
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The app will then be available at `http://localhost:3000`.

## Coding Guidelines

- **TypeScript preferred**: We use TypeScript for better code quality
- **ESLint**: Code must pass ESLint checks (`npm run lint`)
- **Tests**: Not mandatory, but welcome. If you want to write tests, use the existing test structure

## Pull Request Process

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-description
   ```

2. **Commit changes**
   - Use meaningful commit messages
   - Prefer small, focused commits

3. **Open a PR**
   - Use a descriptive title
   - Fill out the PR template (don't forget the checklist!)
   - Target the `main` branch

4. **Review**
   - Wait patiently for feedback
   - Implement requested changes

## Releasing

1. Bump `version` in `package.json`.
2. Set `version` and `appVersion` in `charts/blokhouse/Chart.yaml` to the same value.
3. Move the `Unreleased` section of `CHANGELOG.md` to `## [X.Y.Z] - YYYY-MM-DD`.
4. Merge the release PR, then tag the merge commit `vX.Y.Z` and push the tag.

The publish workflow refuses a tag that does not match `package.json` and `Chart.yaml`.
It then pushes the image, pushes the chart to `oci://ghcr.io/d4sw4r/charts`, and writes the GitHub release notes.

## Issue Labels

| Label | Description |
|-------|-------------|
| `bug` | Something is not working as expected |
| `enhancement` | New features or improvements |
| `documentation` | Related to documentation |
| `good first issue` | Suitable for beginners |

## Questions?

If anything is unclear, simply open an issue or discuss in the PR.
