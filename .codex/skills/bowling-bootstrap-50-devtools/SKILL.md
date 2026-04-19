---
name: bowling-bootstrap-50-devtools
description: Use for BowlingScoreCardVibes when the user wants to bootstrap the local app with 50 seeded random games and connect Chrome DevTools MCP for browser verification or UI work.
---

# Bowling Bootstrap 50 DevTools

## Purpose

Seed the local BowlingScoreCardVibes app with 50 random bootstrap games, then connect the Chrome DevTools MCP browser to the running app and log in as the bootstrap admin user.

## Workflow

1. Work from the project root:

```text
/Users/mcbrown/Documents/DEV/BowlingScoreCardVibes
```

2. Run the bootstrap script headlessly from the frontend package:

```bash
BOOTSTRAP_IMAGE_COUNT=50 BOOTSTRAP_RANDOM_GAMES=true npm run bootstrap:session -- --headless
```

Use this workdir:

```text
/Users/mcbrown/Documents/DEV/BowlingScoreCardVibes/bowling-scorecard
```

3. If Docker daemon access is denied, rerun the same command with escalation. The bootstrap script may start Docker services.

4. Watch for these success lines:

```text
Seeded 50 bootstrap images for dev+bootstrap@example.com.
Random mode enabled: seeded 50 varied games for player Bootstrap User.
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
- `BOOTSTRAP_RANDOM_GAMES=true` creates one varied random game per seeded image, so `BOOTSTRAP_IMAGE_COUNT=50` produces 50 games.
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
