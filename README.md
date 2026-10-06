# BeakSpeak Node backend

This repository is the production Vercel backend for BeakSpeak. The frontend must POST to **`/api/chat`**, not the project root. The obsolete `_middleware.js` and tracked dependency directory have been removed.

## Setup

Use Node 22+. Run `npm ci`. Set the server-only `GROQ_API_KEY` in Vercel for each deployment environment. The key never belongs in the frontend. `GROQ_MODEL` is optional and defaults to `openai/gpt-oss-20b`; the old Llama model is now listed as enterprise-only by Groq. Keep the model override if the account has access to another supported model.

For local development, copy `.env.example` to `.env` and run `node --env-file=.env scripts/dev-server.js`. The endpoint runs on port 3001. `npm start` uses environment variables already supplied by the shell. Run `npm test` for regressions.

## Contract

Send JSON `{ "text": "Hello", "personality": "normal", "sessionId": "optional-unique-id", "history": [] }`.

Text must be a nonblank string with at most 2,000 characters. Personalities are normal, happy, or angry. History is optional: up to six complete user/assistant turns (12 messages, 12,000 total characters; each message at most 4,000). System roles from the client are rejected. The total request body is capped at 64 KiB. Session IDs are optional metadata; conversations are provided by the client and are not stored or shared on the server.

Success returns `{ "reply": "…", "requestId": "…" }`. Failures return an appropriate HTTP status and `{ "error": "safe message", "code": "…", "requestId": "…" }`. The same reference appears in `X-Request-Id`. Replies are capped at 1,024 completion tokens. Provider calls use a 20-second timeout and no automatic retries; the Vercel function has a 30-second limit.

CORS allows the production frontend and its preview URLs on Hamid's existing Vercel team. Add other exact origins to comma-separated `ALLOWED_ORIGINS`. Localhost is automatically allowed outside production. CORS is browser access control, not authentication.

## Rate limits and budget

Code enforces 10 messages per IP per minute, 120 globally per minute, and 1,000 globally per 24-hour window. Configure **both** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to make these counters atomic and shared across Vercel instances. A configured Redis outage fails closed and prevents a provider call. Without Redis, bounded in-memory counters only protect each warm instance; they are **not a deployment-wide quota**. Provisioning a Redis store is a separate account setup step; the code does not create or charge for one.

For a public deployment, also configure Vercel Firewall to rate-limit POST `/api/chat` by IP and set a Groq spend limit. Do not treat local counters or CORS as complete abuse protection. Redis keys hash IP addresses and expire automatically; no prompts or credentials are stored in them.

## Diagnose production errors

In the backend project's Vercel **Logs**, filter request path `/api/chat` and the relevant error status. Match the browser's reference to the JSON log's `requestId`. Logs include safe error category, configured model, provider HTTP status, and provider error code when available. They exclude user messages, API keys, raw SDK errors, and payloads.

- `SERVICE_NOT_CONFIGURED` / `MISSING_API_KEY`: configure `GROQ_API_KEY` for this environment and redeploy.
- `PROVIDER_AUTH_ERROR`: check the key and Groq project/account permissions in the provider console.
- `PROVIDER_CONFIG_ERROR`: check `GROQ_MODEL`, model access, and the safe provider code in the log.
- `PROVIDER_RATE_LIMIT`: wait for the Groq rate window and review quotas/spend limits.
- `PROVIDER_TIMEOUT` or `PROVIDER_UNAVAILABLE`: review provider availability and retry a small request.
- `RATE_LIMIT_UNAVAILABLE`: check the Redis URL/token and service availability.

The old production HTTP 500 has not been attributed to a specific provider error because runtime-log access was denied. This repair improves diagnostics and fixes known contract and dependency problems; validate a real reply on the preview before merging the backend, then merge the frontend.

Official references: [Groq models](https://console.groq.com/docs/models), [Groq errors](https://console.groq.com/docs/errors), [Vercel runtime logs](https://vercel.com/docs/logs/runtime), [Vercel rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).
