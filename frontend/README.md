# Frontend (Lin Garden customer client)

Customer-facing web client for the Lin Garden voice agent. React 19 + Vite +
Tailwind, talking to the Pipecat agent over WebRTC (SmallWebRTC) and reading the
live order from Supabase.

The voice agent it connects to lives in [`../server`](../server).

## What it does

- **Voice call** — connects to the agent and streams mic audio over WebRTC.
- **Live transcript** — renders user + bot turns from RTVI events.
- **Live order card** — reads the order for the current call from Supabase and
  updates as the agent writes it. Degrades gracefully: if Supabase env is not
  set, the call and transcript still work and the card is disabled.

## Setup

```bash
cp .env.example .env   # then fill in the values below
npm install
npm run dev            # http://localhost:5173
```

Run the agent in another terminal first:

```bash
cd ../server
uv run python bot.py   # serves the WebRTC offer endpoint on :7860
```

The Vite dev server proxies `/api` → `http://localhost:7860`, so the browser
reaches the agent same-origin (no CORS).

## Environment

| Var | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL (browser read of the order card). |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase **publishable/anon** key. Never the secret key — it ships to the browser. |
| `VITE_PIPECAT_CONNECT_URL` | WebRTC offer endpoint. Default `/api/offer` (proxied to the local agent). For a deployed agent, set the absolute offer URL. |

## Scripts

- `npm run dev` — start the dev server.
- `npm run build` — type-check and build to `dist/`.
- `npm run lint` — `tsc --noEmit`.
