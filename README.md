# BeakSpeak API

The Node.js backend for [BeakSpeak](https://beakspeak-chatbot.vercel.app/), an educational chatbot about hooded vultures.

The API validates chat requests, adds the selected assistant personality and calls a hosted language model through Groq. It runs as a Vercel Function.

**[Frontend repository](https://github.com/19Hamid/hooded-vulture-frontend)** · **[API reference](docs/API.md)** · **[Deployment guide](docs/DEPLOYMENT.md)**

## Run locally

Requirements: **Node.js 22 or later**, npm and a Groq API key for chat.

```bash
git clone https://github.com/19Hamid/hooded-vulture-backend.git
cd hooded-vulture-backend
npm ci
cp .env.example .env
```

Set `GROQ_API_KEY` in `.env`, then start the server:

```bash
node --env-file=.env scripts/dev-server.js
```

The endpoint is **http://localhost:3001/api/chat**.

On PowerShell, use `Copy-Item .env.example .env` instead of `cp`. If the shell or hosting service already supplies the environment, `npm start` starts the same local server.

## Example request

```bash
curl -i http://localhost:3001/api/chat \
  -H 'Content-Type: application/json' \
  --data '{"text":"Why are hooded vultures important?","personality":"normal","history":[]}'
```

Success returns `reply` and `requestId`. See the [API reference](docs/API.md) for the full contract and errors.

## Configuration

| Variable | Purpose |
| --- | --- |
| `GROQ_API_KEY` | Server-only provider key; required for chat |
| `GROQ_MODEL` | Model identifier; defaults to `openai/gpt-oss-20b` |
| `ALLOWED_ORIGINS` | Additional exact browser origins, separated by commas |
| `UPSTASH_REDIS_REST_URL` | Optional HTTPS endpoint for shared usage counters |
| `UPSTASH_REDIS_REST_TOKEN` | Token for that Redis endpoint; configure both Redis values together |

Store provider and Redis credentials as hosting-platform secrets. Keep local values in the ignored `.env` and commit only the empty `.env.example`.

Model availability and quotas depend on the Groq account. See [Groq's model documentation](https://console.groq.com/docs/models).

## Request handling

- JSON bodies are limited to 64 KiB and messages to 1–2,000 characters.
- History accepts six complete user/assistant turns and 12,000 characters.
- Client-provided system messages are rejected.
- Completions are capped at 1,024 tokens and replies at 4,000 characters.
- Provider calls time out after 20 seconds with no automatic retries.
- The Vercel Function has a 30-second maximum duration.
- Errors return safe messages and request references.

The backend does not persist chat transcripts. The client supplies recent history with each request. Error logs contain diagnostic metadata rather than message text, credentials or raw provider errors.

## Usage limits

The code supports these fixed-window limits:

| Scope | Limit |
| --- | --- |
| Per IP | 10 requests per minute |
| Global | 120 requests per minute |
| Global | 1,000 requests per 24-hour window |

With both Redis variables configured, counters are atomic and shared across instances. A configured Redis failure returns `503` before calling Groq.

Without Redis, counters live in each warm process. They reset when that process is replaced and do not enforce a deployment-wide quota. This repository does not provision Redis.

CORS controls browser origins and does not authenticate API clients. Configure provider spending controls and appropriate platform rate limits for a public deployment.

## Tests

```bash
npm test
```

Tests mock Groq and need no live key. They cover validation, context, personalities, CORS, provider failures, timeouts and rate limiting.

## Project structure

| Path | Contents |
| --- | --- |
| `api/chat.js` | Handler, validation, provider call and errors |
| `lib/rate-limit.js` | In-memory and shared Redis counters |
| `scripts/dev-server.js` | Local HTTP server |
| `tests/chat.test.js` | API regression tests |
| `.env.example` | Configuration template with empty secrets |
| `vercel.json` | Function duration |

Created by [Hamid](https://github.com/19Hamid).
