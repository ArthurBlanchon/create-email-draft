import { useState } from "react"

import { ScaffoldFooter } from "@/components/scaffold-footer"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { devUrl, formatDate, useVersions, versionUrl } from "@/lib/showcase-versions"

// The showcase "hub" page: rendered whenever this deploy's URL has no
// recognized channel suffix (see src/lib/showcase-routing.ts) -- this repo's
// own bare /template/, or a local `pnpm dev` server. Individual channel
// builds (/latest/, /dev/, /v<version>/) render `ChannelNotice` instead when
// not embedded in Grist, with a link back here. Its hero introduces the
// template project itself -- deliberately different from ChannelNotice's
// hero, which is about the specific build you're looking at. Same component
// for this repo's own showcase as for a real scaffolded widget that happens
// to have something deployed at its own bare root; the only per-deploy
// difference is which /v<version>/ dirs actually exist upstream.

// A ready-to-paste instruction for an AI coding agent, not a human. Written
// to work first-shot: it explains *why* to scaffold into a subdirectory
// (create-grist-widget's CLI refuses a non-empty target -- and a repo
// Claude Code is already connected to always has a .git folder) rather than
// just saying "scaffold and push", which left room for the agent to try
// (and fail) `npm create grist-widget .` in place.
const CLAUDE_CODE_PROMPT = `Scaffold a new Grist custom widget here using \`npm create grist-widget\` (https://www.npmjs.com/package/create-grist-widget). This repo is an empty git clone already connected to GitHub, so scaffold into a new subdirectory first -- the CLI refuses a non-empty target directory, and this one already has a .git folder. Then push the scaffold's \`main\` and \`dev\` branches to this repository's own \`origin\` remote, so the bundled GitHub Pages deploy workflow runs. Report back the /latest/ and /v<version>/ GitHub Pages URLs once it's live.`

function CopyableBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-muted p-4 pr-16 text-xs whitespace-pre-wrap">
        <code>{text}</code>
      </pre>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="absolute top-2 right-2"
        onClick={copy}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  )
}

function CreateRepoButton() {
  return (
    <div className="mt-2 ml-5">
      <Button asChild>
        <a href="https://github.com/new" target="_blank" rel="noreferrer">
          Create a new repository
        </a>
      </Button>
    </div>
  )
}

// The fastest path: GitHub's own "generate from template" flow, with
// history included so gh-pages/Pages content comes along -- no
// create-grist-widget CLI, no local install. See the template README's
// "Used GitHub's 'Use this template' button instead of `npm create
// grist-widget`?" note for what this trades away (package.json rename,
// version reset) in exchange for zero local setup.
function CopyStarterRepoButton() {
  return (
    <div className="mt-2 ml-5">
      <Button asChild>
        <a
          href="https://github.com/arthurblanchon/grist-widget-template/generate"
          target="_blank"
          rel="noreferrer"
        >
          Copy starter repo
        </a>
      </Button>
    </div>
  )
}

export function TemplateLanding() {
  const { versions, error } = useVersions()

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-10 text-center">
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          grist-widget-template
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Build a Grist custom widget in minutes
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          A React + TypeScript + Tailwind starting point for{" "}
          <code className="text-foreground">grist-widget-sdk</code>. Scaffold
          your own copy, or browse what's already been released below.
        </p>
      </header>

      <div className="mb-10 rounded-lg border p-4">
        <h2 className="mb-3 font-heading text-base font-semibold">
          Quickstart
        </h2>
        <ol className="list-inside list-decimal space-y-3 text-sm text-muted-foreground">
          <li>
            Copy this starter repo. On the next page, check{" "}
            <strong className="text-foreground">Include all branches</strong>{" "}
            so GitHub Pages comes already configured — no manual Settings
            step.
            <CopyStarterRepoButton />
          </li>
          <li>
            Your new widget starts deploying on its first push. Ask your AI
            coding agent for two URLs: the{" "}
            <strong className="text-foreground">dev</strong> build (auto-reloads
            as you iterate) and the{" "}
            <strong className="text-foreground">latest</strong> build (ready to
            paste into a production Grist document).
          </li>
        </ol>
        <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">
            If your AI can't see the new widget repo,
          </strong>{" "}
          check its GitHub App has been granted access to it:{" "}
          <a
            href="https://github.com/apps/claude"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Claude
          </a>
          ,{" "}
          <a
            href="https://github.com/apps/chatgpt-codex-connector"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Codex
          </a>
          , or{" "}
          <a
            href="https://github.com/apps/cursor"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Cursor
          </a>
          .
        </div>
      </div>

      <div className="mb-10 rounded-lg border p-4">
        <h2 className="mb-3 font-heading text-base font-semibold">
          Prefer the CLI?
        </h2>
        <Tabs defaultValue="claude-code">
          <TabsList className="mb-4">
            <TabsTrigger value="claude-code">Using Claude Code?</TabsTrigger>
            <TabsTrigger value="manual">Manual setup</TabsTrigger>
          </TabsList>

          <TabsContent value="claude-code">
            <ol className="list-inside list-decimal space-y-3 text-sm text-muted-foreground">
              <li>
                Create a new, empty GitHub repo for the widget.
                <CreateRepoButton />
              </li>
              <li>
                Install the{" "}
                <a
                  href="https://github.com/apps/claude"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Claude GitHub App
                </a>{" "}
                on that repo.
              </li>
              <li>
                Start a Claude Code session connected to it and paste this
                prompt:
                <div className="mt-2 ml-5">
                  <CopyableBlock text={CLAUDE_CODE_PROMPT} />
                </div>
              </li>
            </ol>
          </TabsContent>

          <TabsContent value="manual">
            <ol className="list-inside list-decimal space-y-3 text-sm text-muted-foreground">
              <li>
                Scaffold it and try it locally:
                <div className="mt-2 ml-5">
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">
                    <code>{`npm create grist-widget my-widget
cd my-widget
pnpm install
pnpm dev`}</code>
                  </pre>
                </div>
              </li>
              <li>
                Create a new, empty GitHub repo for the widget.
                <CreateRepoButton />
              </li>
              <li>
                Push it:
                <div className="mt-2 ml-5">
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">
                    <code>{`git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main
git push origin dev`}</code>
                  </pre>
                </div>
              </li>
              <li>
                Once that first push's workflow run completes (it creates a{" "}
                <code className="text-foreground">gh-pages</code> branch),
                enable Pages: Settings → Pages → Source → "Deploy from a
                branch" → branch <code className="text-foreground">gh-pages</code>{" "}
                → <code className="text-foreground">/ (root)</code>.
                <p className="mt-2 text-xs text-muted-foreground">
                  Not <code className="text-foreground">main</code> — that
                  serves this repo's raw, unbuilt source instead of the built
                  site (a blank page with a{" "}
                  <code className="text-foreground">/src/main.tsx</code> 404
                  in the console).
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  If that first run fails with a permissions error pushing to{" "}
                  <code className="text-foreground">gh-pages</code>, Settings
                  → Actions → General → Workflow permissions → "Read and
                  write permissions" fixes it — most repos don't need this.
                </p>
              </li>
            </ol>
          </TabsContent>
        </Tabs>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold">
            Released template versions
          </h2>
          <a
            href={devUrl()}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Live dev preview →
          </a>
        </div>
        {error ? (
          <p className="text-sm text-muted-foreground">
            Couldn't load the version list.
          </p>
        ) : versions === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No versions published yet.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border">
            {versions.map((v, i) => (
              <li
                key={v.version}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">v{v.version}</span>
                  {i === 0 && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                      latest
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatDate(v.publishedAt)}
                  </span>
                </div>
                <a
                  href={versionUrl(v.version)}
                  className="text-sm underline underline-offset-4 hover:text-foreground"
                >
                  Preview
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ScaffoldFooter />
    </div>
  )
}
