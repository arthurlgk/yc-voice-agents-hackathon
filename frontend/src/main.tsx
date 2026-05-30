import { StrictMode, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import {
  PipecatClientProvider,
  PipecatClientAudio,
} from "@pipecat-ai/client-react";
import App from "./App";
import { pipecatClient } from "./lib/pipecat";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/*
      client-react 1.6 bundles its own copy of the client-js types, so the
      PipecatClient from @pipecat-ai/client-js is structurally identical but a
      distinct nominal type. Cast to the provider's expected prop type; it's the
      same class at runtime.
    */}
    <PipecatClientProvider
      client={
        pipecatClient as unknown as ComponentProps<
          typeof PipecatClientProvider
        >["client"]
      }
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
      {/* Plays the agent's audio track. Mounted once, app-wide. */}
      <PipecatClientAudio />
    </PipecatClientProvider>
  </StrictMode>,
);
