## 1. What is this?

A restaurant receptionist voice agent for Lin Garden, a real Chinese restaurant. A customer calls on the phone or taps a button in the browser, talks to the agent like they would a host, and orders food. By the time they hang up, the order is already in the database with items, sizes, tax, and pickup or delivery details. On the web client, the order card fills in on screen as the customer speaks.

This is built to solve a real problem. The restaurant misses calls during the dinner rush, and every missed call is a missed order. The agent answers every time, writes a real order to a real database, and the owner sees it live. That is also why evaluation matters so much here: an agent that silently fails on a real customer is worse than no agent, so I leaned hard on Cekura to catch those failures before a customer would.

## 2. Demo video

**Note that when ordering the volume is low, please turn up the volume during the ordering part if possible**

**Use 2x speed to have 1 minute video**

**I am uploading a version of this demo under the same root directory with better audio, but it may be after the deadline**

https://www.loom.com/share/fd81c79c1560498ebc47209c693c14a2

A link with better audio (same demo video) is here but after the deadline: https://www.loom.com/share/4716c78a97fc4465b42bec1628be5947
## 3. How I used Cekura, Nemotron, and Pipecat

**Pipecat** is the orchestration. The pipeline runs Nemotron Speech Streaming STT into Nemotron-3-Super 120B into Gradium TTS. The same bot serves a browser over SmallWebRTC and a phone over Twilio without changing the conversation logic. I registered a `place_order` function tool with `llm.register_function`; inside the handler I resolve each spoken dish to a menu row, compute subtotal, 7% tax, and total, then call one Postgres RPC, `place_order_atomic`, on Supabase. The bot mints a call_id and pushes it to the browser over RTVI, and the React client opens a Supabase realtime channel filtered on that call_id so the order card redraws the moment voice writes the row. No polling.

**Nemotron** is the open model doing the actual ordering: understanding a messy spoken order, reading it back, handling changes, and deciding when to call the tool. The 120B model followed multi-step tool instructions well.

**Cekura** is where the project earned its keep. I ran 18 auto-generated caller scenarios against the deployed agent and used the results as a spec checker. The first run was a wake-up call: 0 of 18, every call connected but the agent produced zero audio. Cekura caught a class of failure no local check would. The agent greeted me fine in the local sandbox but was silent on the deployed path, because the bot handled SmallWebRTC and WebSocket runner arguments but not Daily, and Pipecat Cloud starts every session over Daily, so the bot returned before building the pipeline. I added the Daily entry point, redeployed, and re-ran.

Once the connection worked, the suite turned into a precise spec-adherence checker with transcript timestamps. It pinpointed real logic bugs: it asked "small or large" on combos and skipped the required rice and appetizer questions, never spoke a mandatory upcharge line, mishandled an auto-apply promo, and on red-team scenarios it read raw POS codes aloud. One eval symptom, the agent going silent, pointed straight at a latent code bug: a transient Supabase error in the order loop was caught too narrowly, so any other exception left the tool call unanswered and the model hung. I fixed that to always answer the tool call, added structured combo modifiers after verifying the database schema, and shipped it with unit tests.

Result across five iterations: 0 of 18 (silent in production) to 7 of 18 with real behavioral signal, plus a hardened, tested, deployed agent and a set of consistently passing scenarios that now act as a regression baseline. The remaining items (a clean batched re-run to measure the lift, the deferred transfer-to-human tool, an out-of-stock flag) are the next loop.

## 4. What is new during the hackathon

I came in with the receptionist concept from a prior restaurant project, so the problem space was familiar. Everything in this repo is new work on the sponsor stack: the entire Pipecat pipeline, the swap to Nemotron and Gradium, the order tool for Pipecat function calling, the call_id handshake to the browser, the React voice client, the Supabase realtime order card, and the full Cekura evaluation loop with the connection fix and prompt and code hardening it drove. The idea is borrowed; the implementation here is built from scratch.

I also tried the LemonSlice avatar plugin, because an on-screen face is a nice touch for a customer ordering at a kiosk in the store. I got the avatar set up and attempted the connection, but it runs over a Daily room rather than the simple WebRTC transport the rest of the app uses, so it needs a different setup path than I had time to finish. I am one step away: I only need to route the TTS audio to the avatar participant and the lip sync follows. It is a fast follow.

## 5. Feedback on the tools

**Pipecat.** The pipeline reads cleanly and matches how you think about a call: speech in, model, speech out. Swapping any stage was a one-object change, and the transport abstraction letting one bot serve browser and phone was the best part. The function tool experience was excellent once I learned to treat the tool description as a behavior contract, not a comment; telling the model exactly when to call it and how to handle edits removed most of the double-ordering I expected to fight. Better docs and examples on writing tool descriptions this way would help a lot of builders. One rough edge: my first deployment failed with a generic "infrastructure unavailable, please contact support," and the deployment log showed nothing failing. A more specific error, plus how to actually reach support, would have saved real time.

**Nemotron.** The 120B model handled multi-step tool instructions and order read-backs well and stayed coherent across order changes in the same call. Cold start was the weak point: first calls had noticeably high latency before the agent spoke. Faster time to first token on a cold session would matter a lot for a phone agent, where a few seconds of silence reads as a dropped call.

**Cekura.** The single most useful thing was the failure taxonomy: splitting infrastructure failures from workflow failures let me fix the connection before judging behavior, instead of conflating them and wasting iterations. The auto self-improvement loop is what made this a real project rather than a demo; the evals doubled as a regression baseline and the behavioral symptoms pointed straight at code-level bugs. One friction point worth flagging: on the first run there was no Daily entry point path for Cekura, so even though I could connect over WebRTC locally, the Cekura tests failed until I added that entry point. Sizing matters too: firing 18 parallel calls against a low max-agents pool caused concurrency rejections that looked like failures, so the run size needs to match the agent's concurrency ceiling.

## 6. Live link

https://yc-voice-agents-hackathon-production.up.railway.app/