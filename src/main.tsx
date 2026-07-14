import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { GristBoundary, GristWidgetProvider } from "grist-widget-sdk"

import { ChannelNotice } from "@/components/channel-notice"
import { GristSdkAlerts } from "@/components/grist-sdk-alerts"
import { GristStatusChip } from "@/components/grist-status-chip"
import { TemplateLanding } from "@/components/template-landing"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { parseShowcasePath } from "@/lib/showcase-routing"
import "./index.css"
import App, { GRIST_OPTIONS } from "./App.tsx"

// A Grist custom widget only ever runs embedded in Grist's own iframe.
// Opened directly in a browser tab (window.self === window.top), there's no
// Grist to connect to. Two different "not embedded" experiences, told apart
// purely by URL shape (see src/lib/showcase-routing.ts):
//   - no recognized channel suffix (this repo's own bare /template/, or a
//     local `pnpm dev` server) -> the rich showcase hub (TemplateLanding):
//     onboarding + a link to every released version and the dev channel.
//   - a recognized channel suffix (/latest/, /dev/, /v<version>/) -> a
//     minimal notice: which build this is, a link back to the hub, and a
//     copy-this-URL helper for pasting into Grist's custom widget field.
// The hub always wins over embedding -- /template/ is never meant to
// function as an actual widget, even if someone pastes it into Grist by
// mistake.
const isEmbedded = window.self !== window.top
const { channel, hubPath } = parseShowcasePath(window.location.pathname)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      {!channel ? (
        <div className="min-h-full w-full bg-background text-foreground">
          <TemplateLanding />
        </div>
      ) : isEmbedded ? (
        <GristWidgetProvider options={GRIST_OPTIONS}>
          <GristStatusChip />
          <GristBoundary
            gate={GRIST_OPTIONS.columns?.length ? "canRender" : "ready"}
          >
            <div className="min-h-full w-full bg-background text-foreground">
              <GristSdkAlerts>
                <App />
              </GristSdkAlerts>
            </div>
          </GristBoundary>
        </GristWidgetProvider>
      ) : (
        <div className="min-h-full w-full bg-background text-foreground">
          <ChannelNotice channel={channel} hubPath={hubPath} />
        </div>
      )}
    </ThemeProvider>
  </StrictMode>
)
