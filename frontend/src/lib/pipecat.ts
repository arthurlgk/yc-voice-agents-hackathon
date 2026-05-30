import { PipecatClient } from "@pipecat-ai/client-js";
import type { APIRequest } from "@pipecat-ai/client-js";
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport";
import { DailyTransport } from "@pipecat-ai/daily-transport";

// Two connection modes, selected by VITE_PIPECAT_MODE:
//
//   "local" (default) — talk to the local Pipecat dev runner over SmallWebRTC.
//     The browser POSTs a WebRTC offer to VITE_PIPECAT_CONNECT_URL (default
//     /api/offer, proxied by Vite to :7860). The URL lives on the transport;
//     connect() takes no args, so connectParams is undefined.
//
//   "cloud" — talk to a deployed Pipecat Cloud agent over Daily. The browser
//     POSTs to PCC's /start REST endpoint, which provisions a Daily room and
//     returns { dailyRoom, dailyToken }; DailyTransport joins it. We pass that
//     request as connectParams; the hook calls client.connect(connectParams).
//
// NOTE: in cloud mode the public API key ships in the browser bundle — anyone
// can read it and start sessions (capped per deployment). Acceptable for a demo;
// for production, proxy /start through a server route that holds the key.
const MODE = import.meta.env.VITE_PIPECAT_MODE === "cloud" ? "cloud" : "local";

const CONNECT_URL = import.meta.env.VITE_PIPECAT_CONNECT_URL || "/api/offer";
const AGENT_NAME = import.meta.env.VITE_PIPECAT_AGENT_NAME;
const API_KEY = import.meta.env.VITE_PIPECAT_API_KEY;
const PCC_BASE = "https://api.pipecat.daily.co/v1/public";

// One client for the app lifetime. The provider in main.tsx hands it to the
// React hooks; connect()/disconnect() are driven by the Start/End Call button.
export const pipecatClient = new PipecatClient({
  transport:
    MODE === "cloud"
      ? new DailyTransport()
      : new SmallWebRTCTransport({
          // The offer endpoint is passed via webrtcRequestParams (the current
          // API; the older `webrtcUrl` option is deprecated).
          webrtcRequestParams: { endpoint: CONNECT_URL },
        }),
  enableMic: true,
  enableCam: false,
});

// Params for client.connect(). Local: undefined (URL is on the transport).
// Cloud: the PCC /start request; DailyTransport reads { dailyRoom, dailyToken }
// from the response and joins the room.
export const connectParams: APIRequest | undefined =
  MODE === "cloud"
    ? {
        endpoint: `${PCC_BASE}/${AGENT_NAME}/start`,
        headers: new Headers({ Authorization: `Bearer ${API_KEY}` }),
        requestData: { createDailyRoom: true },
      }
    : undefined;

if (MODE === "cloud" && (!AGENT_NAME || !API_KEY)) {
  console.warn(
    "[pipecat] VITE_PIPECAT_MODE=cloud but VITE_PIPECAT_AGENT_NAME and/or VITE_PIPECAT_API_KEY are not set — the cloud connect will fail.",
  );
}
