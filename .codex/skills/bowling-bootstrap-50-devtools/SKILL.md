---
name: bowling-bootstrap-50-devtools
description: Use for BowlingScoreCardVibes when the user wants to bootstrap the local app with enough seeded random games to exercise pagination and connect Chrome DevTools MCP for browser verification or UI work.
---

# Bowling Bootstrap Pagination DevTools

## Purpose

Seed the local BowlingScoreCardVibes app with random bootstrap player/team history that crosses the 50-image pagination boundary, then connect the Chrome DevTools MCP browser to the running app and log in as the bootstrap admin user.

## Workflow

1. Work from the project root:

```text
/Users/mcbrown/Documents/DEV/BowlingScoreCardVibes
```

2. Run the bootstrap script headlessly from the frontend package:

```bash
BOOTSTRAP_RANDOM_GAMES=true npm run bootstrap:session -- --headless
```

Use this workdir:

```text
/Users/mcbrown/Documents/DEV/BowlingScoreCardVibes/bowling-scorecard
```

3. If Docker daemon access is denied, rerun the same command with escalation. The bootstrap script may start Docker services.

4. Watch for these success lines:

```text
Seeded 60 bootstrap images for dev+bootstrap@example.com.
Random mode enabled: seeded 240 varied games across 4 players.
Team mode enabled: assigned bootstrap images across 4 teams (...).
Logged in as dev+bootstrap@example.com.
```

5. Verify services from the project root:

```bash
docker compose ps
docker compose exec -T app wget -qO- http://ml-service:8000/health
```

Expected ML response:

```json
{"status":"ok"}
```

6. Connect Chrome DevTools MCP:

- Use `mcp__chrome_devtools__.list_pages`.
- Select an existing page if one is available, otherwise open `http://localhost:3000`.
- Navigate to `http://localhost:3000/login`.
- Log in with:

```text
Email: dev+bootstrap@example.com
Password: devpassword123
```

- Wait for the home page and verify signed-in text for `Bootstrap User`.
- Navigate to `/library` or `/admin` based on the user's task.

## Notes

- The bootstrap script deletes and replaces prior bootstrap fixture images for the bootstrap user before seeding.
- `BOOTSTRAP_RANDOM_GAMES=true` defaults to 60 images so pagination is exercised; override with `BOOTSTRAP_IMAGE_COUNT` or `--image-count`.
- Random mode creates one varied random game per configured player per seeded image and assigns images round-robin across teams. Override players with `BOOTSTRAP_RANDOM_PLAYER_NAMES` and teams with `BOOTSTRAP_RANDOM_TEAM_NAMES` or `--random-team-names`.
- The bootstrap user is expected to be an admin. If `/admin` is forbidden, run this from `bowling-scorecard`:

```bash
npm run user:set-role -- dev+bootstrap@example.com ADMIN
```

## Browser Profile Lock Recovery

If a previous interactive bootstrap browser causes a `ProcessSingleton` or `SingletonLock` error, kill the stale bootstrap browser process:

```bash
pkill -f '/Users/mcbrown/Documents/DEV/BowlingScoreCardVibes/bowling-scorecard/output/playwright/bootstrap-profile'
```

Then rerun the headless bootstrap command.
