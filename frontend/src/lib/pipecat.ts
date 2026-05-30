import { PipecatClient } from "@pipecat-ai/client-js";
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport";

// Where the browser POSTs its WebRTC offer. A relative path (default) is proxied
// by Vite to the agent on :7860; for a deployed agent set VITE_PIPECAT_CONNECT_URL
// to the absolute offer URL. The SmallWebRTC transport reads the URL from its
// constructor (its connect() takes no args), so we set it here once.
const CONNECT_URL = import.meta.env.VITE_PIPECAT_CONNECT_URL || "/api/offer";

// One client for the app lifetime. The provider in main.tsx hands it to the
// React hooks; connect()/disconnect() are driven by the Start/End Call button.
// The offer endpoint is passed via webrtcRequestParams (the current API; the
// older `webrtcUrl` option is deprecated). connect() takes no args.
export const pipecatClient = new PipecatClient({
  transport: new SmallWebRTCTransport({
    webrtcRequestParams: { endpoint: CONNECT_URL },
  }),
  enableMic: true,
  enableCam: false,
});
