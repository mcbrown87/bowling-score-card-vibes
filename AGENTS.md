# Repository Guidelines

## Project Structure & Module Organization
BowlingScoreCardVibes pairs a React front end (`bowling-scorecard/`) with a Node/Express service (`backend/`). UI code lives under `bowling-scorecard/src` (components, utils, types), static assets in `public/`, and docs plus sample captures in `docs/` and `TestImages/`. The API lives in `backend/src`, compiled to `backend/dist`. `docker-compose.yml` coordinates both services, and `validated-score-for-mcb.json` stores regression data.

## Build, Test, and Development Commands
Run installs separately for each package or via npm's `--prefix`. Common flows:
```bash
npm install --prefix backend
npm install --prefix bowling-scorecard
npm run dev --prefix backend          # hot-reloads the Express API
npm start --prefix bowling-scorecard  # CRA dev server on 3000
npm run dev:full --prefix bowling-scorecard  # runs frontend + backend concurrently
npm run build --prefix bowling-scorecard     # production React build
npm run lint --prefix backend
npm test --prefix bowling-scorecard
```
Prefer `docker compose up --build` when validating the full stack.

## Coding Style & Naming Conventions
Both packages are TypeScript-first; keep 2-space indentation and single quotes as seen in `bowling-scorecard/src/App.tsx`. Use PascalCase for React components and TypeScript types, camelCase for hooks, utilities, and backend handlers. Favor functional components plus hooks, co-locate helper styles or extract them into `src/utils`, and keep Express routes thin controller shells. Run `npm run lint --prefix backend` before committing.

## Testing Guidelines
Frontend tests use CRA's Jest + React Testing Library stack (see `bowling-scorecard/src/App.test.tsx` and `setupTests.ts`). Name files `*.test.tsx` alongside the component, focus on user flows (image upload, score correction), and run `npm test -- --watch` while developing. Exercise UI changes through the Chrome DevTools MCP server so you can verify the app in-browser, collect console/network logs, and attach screenshots alongside PRs. Backend currently lacks automated tests; add Vitest/Jest suites under `backend/src/__tests__` whenever you ship logic-heavy modules.

## Commit & Pull Request Guidelines
Existing history follows `type(scope): description` (e.g., `feat(frontend): show uploaded image beside paginated scorecards`). Keep the imperative mood, mention the touched area, and include issue IDs when available. PRs should outline intent, list test evidence (CLI output or screenshots for UI), mention any schema/API changes, and link relevant tickets. Include before/after captures from `TestImages/` whenever the UI shifts.

## Security & Configuration Tips
Load API keys (OpenAI, Anthropic, Sentry DSN) via a local `.env`; `backend/src/index.ts` auto-imports `dotenv/config`, so restart the server after updates. Never commit secrets or raw user score images. When sharing builds, scrub `validated-score-for-mcb.json` of personal details and rely on Docker or preview environments for review.
