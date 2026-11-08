import { mountGristWidget } from "grist-widget-sdk/app"

import "./index.css"
import App, { GRIST_OPTIONS } from "./app/App.tsx"

// Inside Grist: the widget, behind the SDK's connection screens and alerts,
// in Grist's light/dark theme. Opened anywhere else (`pnpm dev`, a deployed
// URL): a page saying where to see it, never a fake preview, since an
// emulator can't stand in for real Grist (see AGENTS.md). `pnpm test` is the
// local loop to trust.
mountGristWidget({ App, options: GRIST_OPTIONS, dev: import.meta.env.DEV })
