# Deploy the Node API

## Vercel setup

1. Import `19Hamid/hooded-vulture-backend`.
2. Use the repository root and the **Other** framework preset. `api/chat.js` is the serverless entry point.
3. Use Node.js 22.x or a compatible later version and install with `npm ci`.
4. Add `GROQ_API_KEY` as a **Secret** in the intended Production and Preview environments.
5. Deploy and verify a real `POST /api/chat` response.

The checked-in `vercel.json` sets a 30-second function duration. The provider client has a 20-second timeout.

## Environment configuration

- `GROQ_MODEL` defaults to `openai/gpt-oss-20b`. Another model must be available to the account and support the completion parameters.
- `ALLOWED_ORIGINS` adds exact frontend origins, separated by commas.
- The live BeakSpeak origin and its existing team's frontend previews are allowed by default.
- Localhost origins are available for local development.
- Configure both Redis values for shared usage counters. Keep the token as a Secret.

Real credentials belong in Vercel or an ignored local `.env`. The repository's `.env.example` contains empty secrets.

## Paired releases

1. Deploy the backend.
2. Confirm `POST /api/chat` returns `200` with a nonempty `reply`.
3. Point frontend Production `REACT_APP_BACKEND_URL` at the API's production base URL.
4. Deploy the frontend.
5. Test the live site, including a follow-up question.

For previews, use a frontend branch's Preview variable to point at its matching API preview. Deployment environment values are captured when the deployment is created.

## Replacing a rejected key

Create a replacement in [Groq](https://console.groq.com/keys). In the backend's Vercel **Environment Variables**, edit `GROQ_API_KEY`, replace the value, select **Secret** and save it in the intended environments. Redeploy to apply it.

Enter credentials directly in the provider and hosting dashboards. Revoke a superseded key at the provider when it is no longer needed.

## Usage controls

`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` enable shared atomic counters. A configured Redis failure stops the request before the provider call.

Without Redis, limits apply to each warm instance and do not set a deployment-wide budget. Configure provider spending controls and appropriate platform rate limits according to traffic and the hosting plan.

## Release checks

- Correct key and model in Production.
- Real API reply and successful browser preflight.
- Correct frontend API URL after its rebuild.
- Safe runtime-log errors with request references.
- Provider quota and shared usage-control configuration understood.

Official references: [Vercel Functions](https://vercel.com/docs/functions), [environment variables](https://vercel.com/docs/environment-variables) and [Groq models](https://console.groq.com/docs/models).
