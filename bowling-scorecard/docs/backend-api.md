# Bowling Scorecard API

## Overview

The API now lives inside the Next.js app under `src/app/api`. It stores uploaded scorecards, queues LLM extraction jobs, and normalizes results into the shared `Game` shape used by the UI.

### Features

- Accepts base64 data URLs for scorecard images and persists them to S3-compatible storage.
- Queues extraction requests through BullMQ/Redis so the web request can return quickly.
- Supports Anthropic and OpenAI via `src/server/providers`, with a stub provider for local development.
- Normalizes LLM output into the `Game` shape and saves estimates in Postgres via Prisma.

## Environment

Copy `.env.example` to `.env.local` (or `.env`) and set:

- `DATABASE_URL`
- `REDIS_URL` and optional `SCORE_ESTIMATE_QUEUE`
- `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_REGION`, `STORAGE_USE_SSL`
- `OPENAI_API_KEY` / `OPENAI_MODEL`
- `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`
- `DEFAULT_PROVIDER` (`openai`, `anthropic`, or `stub`)
- `INCLUDE_LLM_RAW` (persist raw text responses when true)
- `NEXTAUTH_SECRET`, `AUTH_TRUST_HOST=true`, and `NEXTAUTH_URL`

## Running locally

1. Start dependencies with Docker: `docker compose up db redis minio minio-setup` (or `docker compose up` for everything).
2. Run the Next.js app + API: `npm run dev`.
3. Start the background worker that processes queued jobs: `npm run queue:worker` (requires Redis).

## Key routes

- `POST /api/extract-scores` — accepts `{ imageDataUrl, fileName? }`, stores the image, queues LLM extraction, and returns the stored image payload plus queue status.
- `POST /api/stored-images/[id]/rescore` — re-enqueue extraction for an existing stored image.
- `GET /api/stored-images` — list stored images for the signed-in user.
- `POST /api/client-logs` — lightweight client logging for diagnostics.
- `GET /api/health` — service status and the configured default provider.
