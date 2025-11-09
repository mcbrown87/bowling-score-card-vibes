# Bowling Scorecard Backend API

## Overview

The backend service lives in the `backend/` directory. It exposes a single JSON endpoint that proxies OCR requests to supported LLM vendors (Anthropic Claude or OpenAI) and returns normalized bowling score data.

### Features

- Accepts base64 data URLs for scorecard images (works with files captured in the browser).
- Normalizes LLM responses into the `Game` shape used by the React front end.
- Supports Anthropic and OpenAI; choose providers per-request or via environment variables.
- Optional inclusion of the raw LLM text response for debugging.

## Environment

Copy `.env.example` to `.env` and fill in the API keys you intend to use:

```bash
cp backend/.env.example backend/.env
```

Key variables:

- `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`
- `OPENAI_API_KEY` / `OPENAI_MODEL`
- `DEFAULT_PROVIDER` (`anthropic` or `openai`)
- `PORT` (defaults to `4000`)

## Scripts

```bash
cd backend
npm install          # already executed, but re-run after pulling new deps
npm run dev          # start with nodemon + ts-node
npm run build        # emit to dist/
npm start            # run the compiled build (after npm run build)
```

## REST API

### `POST /api/extract-scores`

Request body:

```json
{
  "imageDataUrl": "data:image/jpeg;base64,...",
  "provider": "anthropic",
  "prompt": "optional override prompt"
}
```

Response (success):

```json
{
  "success": true,
  "provider": "anthropic",
  "games": [
    {
      "playerName": "Player 1",
      "frames": [
        {
          "rolls": [{"pins":10}],
          "isStrike": true,
          "isSpare": false,
          "score": 30
        }
      ],
      "tenthFrame": {
        "rolls": [{"pins":10},{"pins":10},{"pins":10}],
        "isStrike": true,
        "isSpare": false,
        "score": 300
      },
      "totalScore": 300
    }
  ],
  "rawResponse": "..." // only when INCLUDE_LLM_RAW=true
}
```

Response (failure):

```json
{
  "success": false,
  "error": "Message describing the validation or provider error"
}
```

### `GET /health`

Returns service status and the currently configured default provider.

## Front-End Integration

1. Start the backend (`npm run dev`).
2. Update the React app to call `POST http://localhost:4000/api/extract-scores` instead of invoking the SDKs directly (coming next).
3. Remove `dangerouslyAllowBrowser` flags once the front end uses the new proxy.
