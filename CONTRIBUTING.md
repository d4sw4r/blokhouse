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
   npx prisma db push
   npx prisma db seed
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

## Issue Labels

| Label | Description |
|-------|-------------|
| `bug` | Something is not working as expected |
| `enhancement` | New features or improvements |
| `documentation` | Related to documentation |
| `good first issue` | Suitable for beginners |

## Questions?

If anything is unclear, simply open an issue or discuss in the PR.
