# Repository Guidelines

## Project Structure & Module Organization
BowlingScoreCardVibes is a Next.js application under `bowling-scorecard/`, with application code in `bowling-scorecard/src`, Prisma schema and migrations in `bowling-scorecard/prisma`, static assets in `bowling-scorecard/public`, and sample scorecards in `bowling-scorecard/TestImages`. The Python ML service lives under `ml-service/`. `docker-compose.yml` provides the local infrastructure and can also define containerized application services.

## Build, Test, and Development Commands
The default development workflow runs dependencies in Docker and the Next.js application directly on the host for fast hot reloading. From `bowling-scorecard/`, use:
```bash
npm run dev:full
```
`dev:full` runs `deps:up`, applies Prisma migrations and generates the client on the host, then starts `next dev`. The local `.env` therefore uses host-facing dependency URLs such as `localhost:5432`, `localhost:6379`, and `localhost:9000`. Do not replace those with Compose service names for this workflow.

Common flows from `bowling-scorecard/`:
```bash
npm install
npm run deps:up       # start db, Redis, MinIO, and ML service in Docker
npm run dev:prepare   # deploy Prisma migrations and generate the client on the host
npm run dev           # start only Next.js on the host
npm run dev:full      # run all three steps above
npm run deps:down     # stop the Docker dependency services
npm run build
npm test
```

Do not use an unqualified `docker compose up` as the default development command: the checked-in local environment is host-oriented, so the containerized `app`, `app-migrate`, and `queue-worker` services do not receive Docker-network hostnames. Use the package scripts unless explicitly testing or repairing the fully containerized workflow.

## Coding Style & Naming Conventions
Both packages are TypeScript-first; keep 2-space indentation and single quotes as seen in `bowling-scorecard/src/App.tsx`. Use PascalCase for React components and TypeScript types, camelCase for hooks, utilities, and backend handlers. Favor functional components plus hooks, co-locate helper styles or extract them into `src/utils`, and keep Express routes thin controller shells. Run `npm run lint --prefix backend` before committing.

## Testing Guidelines
Frontend tests use CRA's Jest + React Testing Library stack (see `bowling-scorecard/src/App.test.tsx` and `setupTests.ts`). Name files `*.test.tsx` alongside the component, focus on user flows (image upload, score correction), and run `npm test -- --watch` while developing. Every UI change must be validated in the running application through the Chrome DevTools MCP server before the work is considered complete. Exercise the affected user flow, inspect relevant console and network activity, verify the result at representative viewport sizes when responsiveness could be affected, and capture screenshots for PR evidence when the appearance or interaction changes. Backend currently lacks automated tests; add Vitest/Jest suites under `backend/src/__tests__` whenever you ship logic-heavy modules.

## Database & Bootstrap Fixtures
When adding or changing Prisma schema models, relations, or persisted UI state, update both the Prisma migration history and `bowling-scorecard/scripts/bootstrap-dev-session.cjs` when the new state should exist in local seeded data. Keep bootstrap seeding deterministic and idempotent: clear or upsert bootstrap-owned rows before inserting replacements, expose useful env/CLI overrides for seeded counts, and update `.codex/skills/bowling-bootstrap-50-devtools/SKILL.md` if expected bootstrap output or coverage changes. For team/player state, seed enough data to exercise the Teams and Players tabs after `BOOTSTRAP_RANDOM_GAMES=true npm run bootstrap:session -- --headless`.

The bootstrap session creates the development-only admin user `dev+bootstrap@example.com` with password `devpassword123` unless overridden by `BOOTSTRAP_USER_EMAIL` or `BOOTSTRAP_USER_PASSWORD`. It also creates nine ordinary users by default (`dev+user01@example.com` through `dev+user09@example.com`) using the same password unless `BOOTSTRAP_EXTRA_USER_PASSWORD` is set. These credentials are local fixtures and must not be reused for production or shared environments.

## Commit & Pull Request Guidelines
Existing history follows `type(scope): description` (e.g., `feat(frontend): show uploaded image beside paginated scorecards`). Keep the imperative mood, mention the touched area, and include issue IDs when available. PRs should outline intent, list test evidence (CLI output or screenshots for UI), mention any schema/API changes, and link relevant tickets. Include before/after captures from `TestImages/` whenever the UI shifts.

## Security & Configuration Tips
Load API keys (OpenAI, Anthropic, Sentry DSN) via a local `.env`; `backend/src/index.ts` auto-imports `dotenv/config`, so restart the server after updates. Never commit secrets or raw user score images. When sharing builds, scrub `validated-score-for-mcb.json` of personal details and rely on Docker or preview environments for review.
