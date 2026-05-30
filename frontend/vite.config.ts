import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The browser talks to the Pipecat agent (SmallWebRTC offer endpoint) and,
// later, to any other agent HTTP routes through a same-origin /api proxy. This
// keeps the front end free of CORS / mixed-content concerns and means the only
// thing that changes between local and cloud is the proxy target (or the
// VITE_PIPECAT_CONNECT_URL env var, if you point it at an absolute URL).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.PIPECAT_AGENT_ORIGIN || "http://localhost:7860",
        changeOrigin: true,
      },
    },
  },
});
