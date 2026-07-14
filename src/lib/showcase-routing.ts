// Parses the deployed URL shape every channel of this template (or a real
// scaffolded widget) uses -- /latest/, /dev/, /v<version>/ -- so main.tsx can
// tell a "hub" page (no recognized channel suffix, e.g. this repo's own
// /template/) from a "channel" page (a specific release/dev build) using
// nothing but window.location.pathname. No router needed for two states.
export type Channel =
  | { kind: "latest" }
  | { kind: "dev" }
  | { kind: "version"; version: string }

export function channelLabel(channel: Channel): string {
  switch (channel.kind) {
    case "latest":
      return "latest"
    case "dev":
      return "dev"
    case "version":
      return `v${channel.version}`
  }
}

/**
 * `hubPath` is the current path with the trailing channel segment stripped,
 * e.g. "/grist-widget-sdk/template/latest/" -> "/grist-widget-sdk/template/".
 * `channel` is null when the path itself already looks like a hub (no
 * recognized suffix) -- e.g. this repo's own bare /template/, or a local
 * `pnpm dev` server at "/".
 */
export function parseShowcasePath(pathname: string): {
  channel: Channel | null
  hubPath: string
} {
  const trimmed = pathname.replace(/\/+$/, "")
  const segments = trimmed.split("/")
  const last = segments[segments.length - 1] ?? ""

  let channel: Channel | null = null
  if (last === "latest") channel = { kind: "latest" }
  else if (last === "dev") channel = { kind: "dev" }
  else {
    const match = /^v(\d+\.\d+\.\d+(?:-[\w.]+)?)$/.exec(last)
    if (match) channel = { kind: "version", version: match[1] }
  }

  const hubPath = channel ? segments.slice(0, -1).join("/") + "/" : pathname
  return { channel, hubPath }
}
