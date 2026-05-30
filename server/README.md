# Lin Garden — Nemotron restaurant ordering bot (server)

A [Pipecat](https://pipecat.ai) voice agent for a Chinese restaurant. A caller
orders food for pickup or delivery; the bot reads the live menu from Supabase,
resolves spoken dish names to real menu rows, and writes the order (plus a call
record) back to Supabase. Built on the hackathon's **NVIDIA Nemotron** open-model
stack.

Pipeline: **Nemotron Speech Streaming STT** to **Nemotron-3-Super-120B LLM**
(vLLM, OpenAI-compatible) to **Gradium TTS**.

## Files

| File | Role |
| --- | --- |
| `bot.py` | The agent: pipeline, tool registration, transports (WebRTC plus Twilio), call lifecycle |
| `restaurant/` | Business logic: Supabase client, menu read, name resolution, order placement, prompt |
| `restaurant/menu.py` | Reads `menu_variant_listing` and renders the menu as KV-markdown for the prompt |
| `restaurant/catalog.py` | Resolves a spoken dish name (plus size) to a real menu row |
| `restaurant/orders.py` | `place_order` tool schema and handler, plus the calls-row helpers |
| `restaurant/prompts/` | The English order-taker system prompt and its loader |
| `nemotron_llm.py` | `VLLMOpenAILLMService`: vLLM LLM with a corrected TTFB metric |
| `nvidia_stt.py` | `NVidiaWebSocketSTTService`: WebSocket client for Nemotron ASR |
| `test_nemotron_llm.py` | Unit test for the TTFB metric (no network needed) |

## Run locally (WebRTC)

Prerequisites: Python 3.11+, [`uv`](https://docs.astral.sh/uv/), a Gradium key,
reachable NVIDIA Nemotron endpoints (event-hosted), and a Supabase **secret**
key for the staging project.

```bash
cp .env.example .env          # then fill GRADIUM_API_KEY and SUPABASE_SECRET_KEY
uv sync                       # install deps, create .venv
uv run bot.py                 # ENV=local comes from .env
```

Open <http://localhost:7860>, click **Connect**, and talk. First launch takes
about 20 seconds while Pipecat downloads the VAD and turn-detection models. On
startup the bot reads the full menu from Supabase, so watch the logs for the
menu build line and confirm there is no Supabase auth error.

## Test

```bash
uv run pytest                 # runs test_nemotron_llm.py
```

## Environment variables

See `.env.example`. For a local WebRTC run you need `ENV=local`,
`GRADIUM_API_KEY`, the `NVIDIA_*` / `NEMOTRON_*` endpoint vars, plus
`SUPABASE_URL` and `SUPABASE_SECRET_KEY` (the secret key, not the publishable
key, because the agent INSERTs orders and calls, which RLS blocks for anon).
`RESTAURANT_SLUG` defaults to `lin-garden` and `AGENT_ID` to `yc_hackathon`.
Twilio vars are only needed for the phone path.

> The NVIDIA ASR/LLM endpoints are event-hosted and may only be live during the
> hackathon. If a local call produces no transcription or no LLM reply, confirm
> the endpoints are reachable before debugging the code.
