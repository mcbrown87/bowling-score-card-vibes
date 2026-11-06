---
name: bowling-bootstrap-50-devtools
description: Use for BowlingScoreCardVibes when the user wants mixed league and standard seeded scorecards, enough images to exercise pagination, and Chrome DevTools MCP connected for browser verification or UI work.
---

# Bowling Bootstrap Pagination DevTools

## Purpose

Seed the local BowlingScoreCardVibes app with mixed random scorecards that cross the 50-image pagination boundary: league images have two teams and eight scores, while standard images have one team and four scores. Then connect the Chrome DevTools MCP browser to the running app and log in as the bootstrap admin user.

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
Seeded 9 additional bootstrap users (dev+user01@example.com, ...).
Random mode enabled: seeded 320 varied games across 8 players (20 league images with 8 scores; 40 standard images with 4).
Team mode enabled: assigned bootstrap images across 4 teams (...).
Roster status enabled: seeded 4 disabled player statuses (...).
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
- Random mode marks every third seeded image as a league game. With the default eight-player fixture, league images contain eight scores split first-four/last-four across two teams; all other images contain four scores for one team. Override players with `BOOTSTRAP_RANDOM_PLAYER_NAMES` and teams with `BOOTSTRAP_RANDOM_TEAM_NAMES` or `--random-team-names`. Configure eight player names when complete league fixtures are required.
- Random team mode seeds one disabled roster-player status per team by default so the Teams tab can exercise persisted roster status. Override the count with `BOOTSTRAP_DISABLED_ROSTER_PLAYER_COUNT` or `--disabled-roster-player-count`.
- The bootstrap user is expected to be an admin. If `/admin` is forbidden, run this from `bowling-scorecard`:
- The bootstrap script also creates 9 ordinary users by default so admin tenancy flows can add existing users. Override with `BOOTSTRAP_EXTRA_USER_COUNT`, `BOOTSTRAP_EXTRA_USER_PASSWORD`, `BOOTSTRAP_EXTRA_USER_EMAIL_PREFIX`, or `BOOTSTRAP_EXTRA_USER_EMAIL_DOMAIN`.
- Additional users use the same password as the bootstrap admin unless `BOOTSTRAP_EXTRA_USER_PASSWORD` is set.

```text
dev+user01@example.com
devpassword123
```

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
