import { useState } from "react"

import { ScaffoldFooter } from "@/components/scaffold-footer"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { channelLabel, type Channel } from "@/lib/showcase-routing"
import { devUrl, useVersions, versionUrl } from "@/lib/showcase-versions"
import { cn } from "@/lib/utils"

// Shown instead of the widget tree on a specific channel build
// (/latest/, /dev/, /v<version>/) when it's opened directly in a browser tab
// -- not the rich showcase hub (that's `TemplateLanding`, shown when the URL
// has no recognized channel suffix). Deliberately minimal, with its own hero
// distinct from the hub's: this page's job is just to explain what you're
// looking at, help you jump to a different build, and help you paste this
// exact URL into Grist.
function VersionChips({ current }: { current: Channel }) {
  const { versions } = useVersions()

  function chipClass(active: boolean) {
    return cn(
      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border text-muted-foreground hover:text-foreground",
    )
  }

  return (
    <div className="mb-8 flex flex-wrap justify-center gap-2">
      {versions !== null && versions.length > 0 && (
        <a
          href={versionUrl(versions[0].version)}
          className={chipClass(
            current.kind === "version" && current.version === versions[0].version,
          )}
        >
          latest
        </a>
      )}
      <a href={devUrl()} className={chipClass(current.kind === "dev")}>
        dev
      </a>
      {versions?.map((v) => (
        <a
          key={v.version}
          href={versionUrl(v.version)}
          className={chipClass(
            current.kind === "version" && current.version === v.version,
          )}
        >
          v{v.version}
        </a>
      ))}
    </div>
  )
}

export function ChannelNotice({
  channel,
  hubPath,
}: {
  channel: Channel
  hubPath: string
}) {
  const [copied, setCopied] = useState(false)
  const url = window.location.href

  function copyUrl() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
      <p className="mb-2 text-center text-sm font-medium text-muted-foreground">
        grist-widget-template · {channelLabel(channel)}
      </p>
      <h1 className="text-center font-heading text-2xl font-semibold tracking-tight">
        Grist isn't loaded here
      </h1>
      <p className="mx-auto mt-3 mb-8 max-w-sm text-center text-sm text-muted-foreground">
        You're viewing the <span className="font-mono">{channelLabel(channel)}</span>{" "}
        build directly, outside of Grist.
      </p>

      <VersionChips current={channel} />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Use this as a Grist custom widget</CardTitle>
          <CardDescription>
            Paste this URL into Grist's custom widget URL field.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input readOnly value={url} onFocus={(e) => e.target.select()} />
            <Button type="button" onClick={copyUrl}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <a
        href={hubPath}
        className="text-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        ← Back to the template home
      </a>

      <ScaffoldFooter />
    </div>
  )
}
