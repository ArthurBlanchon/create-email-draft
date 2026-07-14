# scaffold-latest

Base template to build a Grist widget with `grist-widget-sdk`.

`src/main.tsx` wraps the app with `GristWidgetProvider`, `GristBoundary`, and `GristSdkAlerts`. The latter maps `getGristSdkAlertDescriptors()` from the SDK to shadcn `Alert` (`src/components/grist-sdk-alerts.tsx` + `src/components/ui/alert.tsx`); keep them in sync with the playground when you change alert styling.

Opened outside a Grist iframe, `main.tsx` picks between two components purely by URL shape (`src/lib/showcase-routing.ts`, no router needed): a bare path with no recognized channel suffix renders `TemplateLanding` (its own hero, onboarding, and released-version index); `/latest/`, `/dev/`, or `/v<version>/` renders `ChannelNotice` instead — a distinct hero explaining which build this is, chips to jump to any other version/channel (`src/lib/showcase-versions.ts`), and a copy-this-URL helper for pasting into Grist's custom widget field. Both render `ScaffoldFooter` (`src/components/scaffold-footer.tsx`) at the bottom — a small, purely informational note ("Scaffolded from `create-grist-widget@X.Y.Z`") built from `package.json`'s `createGristWidgetVersion` field, which the CLI stamps on every real scaffold (`vite.config.ts` injects it as `__CREATE_GRIST_WIDGET_VERSION__`). Renders nothing if that field is absent, e.g. this pristine template source itself.

When actually embedded, `GristStatusChip` (`src/components/grist-status-chip.tsx`) shows a small pill with live handshake status — connecting, retrying with a countdown, connected, or unavailable — using `useAmbientGristHandshake()` from `grist-widget-sdk/advanced`. It must be mounted *inside* `GristWidgetProvider` (see `src/main.tsx`): it only observes that provider's own handshake manager and never mounts a second one, so it's purely observational and can never duplicate or race the real handshake (see `apps/docs/api/handshake.md`).

`src/App.tsx` uses `useGrist<TaskRow, TaskMapped>()` for the selected row (`w.record`, `w.mode`) and remounts the UI with `key={rowKey}` when the row changes — same pattern as `widgets/create-email-draft`. See `src/grist-types.example.ts` for typing patterns.

- **ESLint** blocks direct `grist` global usage in `src/` — use the SDK only.
- Uncomment `GRIST_OPTIONS.columns` in `App.tsx` to enable column mapping; `main.tsx` sets `GristBoundary gate="canRender"` when columns are declared. Mapping alerts use `GristSdkAlerts`.

To add widget tests later, see [Testing](https://github.com/ArthurBlanchon/grist-widget-sdk/blob/main/apps/docs/guide/testing.md) (`renderWithGrist` from `grist-widget-sdk/emulator/testing`).

**Monorepo dev:** this template resolves `grist-widget-sdk` from `packages/core/dist` (like the other widgets), not from SDK source. After changing the SDK, run `pnpm prebuild` or `pnpm --filter grist-widget-sdk build` before `pnpm dev`.

## How this template is distributed

This is the **source** template. It is consumed two ways:

- **In the SDK monorepo (development):** it's a workspace member and depends on
  the SDK via `"grist-widget-sdk": "workspace:^"`, resolved from
  `packages/core/dist`. Run `pnpm --filter grist-widget-sdk build` after
  changing the SDK, then `pnpm dev` here.
- **Externally (your own repo):** the `create-grist-widget` CLI
  (`npm create grist-widget my-widget`) copies this template and rewrites the
  dependency to the published npm range (`^0.x`), so nothing points back at
  this repo. See [Getting started](https://grist-widgets.com/guide/getting-started).

`pnpm-workspace.yaml` here only pre-approves esbuild's build script so a
standalone `pnpm install` (pnpm 11) exits cleanly; inside the monorepo it's
ignored (the root workspace governs).

### Live preview inside the monorepo (this template's own showcase)

This repo also deploys this template's own **unmodified** source to its own
GitHub Pages — a live showcase of exactly what `npm create grist-widget`
scaffolds, at `https://arthurblanchon.github.io/grist-widget-sdk/template/`.
Same workflow every widget already uses:

- Push template changes to the persistent `dev/template-showcase` branch —
  every push auto-deploys a live preview at `.../template/dev/` that
  self-reloads a few seconds later, same as a scaffolded widget's own `dev`
  channel. Kept around permanently (not deleted after each round), so
  `.../template/dev/` is always live to preview whatever's currently being
  iterated on here.
- Ready to release? **Bump `packages/create-grist-widget/package.json`'s
  version**, open a PR from your feature branch into `main`, and merge —
  merging is what actually publishes `.../template/v<version>/` +
  `.../template/latest/` (and a real `create-grist-widget` npm release,
  since that package embeds this template verbatim — see
  `scripts/build-template.mjs`). Merging without a version bump publishes
  nothing (same idempotent-skip rule as every other deploy pipeline here).

See `scripts/deploy/template-showcase.mjs` + `.github/workflows/
deploy-template-showcase.yml` (monorepo root) for the pipeline itself.

## Deployment

A bundled GitHub Actions workflow (`.github/workflows/deploy.yml` +
`scripts/deploy.mjs`) publishes this widget to **your own** GitHub Pages.

### The workflow: always develop on `dev`, release by merging to `main`

1. Commit and push to the `dev` branch (created for you at scaffold time).
   Every push auto-deploys a live preview at `/dev/` that self-reloads
   inside an open Grist document a few seconds later — paste that URL into
   a Grist doc once, then just keep pushing while you iterate.
2. Ready to publish a release? **Bump `package.json`'s `version`** as part
   of your `dev` branch changes, then open a PR from `dev` into `main`.
3. **Merge the PR.** This is the step that actually publishes — merging to
   `main` builds immutable `/v<version>/` and updates mutable `/latest/`.

> ⚠️ **Merging without bumping the version publishes nothing.** The release
> build is idempotent — it skips whenever `package.json`'s version already
> has a matching `v<version>/` directory published, which is always true if
> you forgot to bump it (it'll match whatever's already live). The PR merges
> cleanly and CI runs "successfully," but `/latest/` silently stays exactly
> as it was. Bump the version *before* merging, not after.

After merging, keep committing to the same `dev` branch for your next round
of changes — it's the permanent working/preview branch for this widget, not
a one-off feature branch to delete and recreate. Deleting it retires `/dev/`
automatically.

> ⚠️ **Used GitHub's "Use this template" button instead of `npm create
> grist-widget`?** That path copies this repo's default branch verbatim —
> it doesn't run any of the CLI's own setup (renaming `package.json`,
> titles, etc.), and whatever version happens to be checked into the
> source repo's `package.json` (which can be well past `0.0.1` — see below)
> comes along with it. You don't need to reset it by hand: your first real
> release always resolves to `v0.0.1` regardless of what `package.json`
> says, and that value stays untouched in the file — only the deploy
> pipeline's own idea of "which version is this" is overridden, once, for
> that first release. If you also checked **"Include all branches"** (to
> get `gh-pages`/Pages already set up, no manual Settings step), your first
> real release also automatically clears out every leftover `v<version>/`
> it finds — a `v<version>/` only counts as a genuine prior release once it
> carries a `showcase-meta.json` naming *this* repo (written by this
> pipeline's own `place` step), so on a repo with no genuine releases yet,
> everything else is provably inherited noise and gets safely wiped on your
> first push to `main`. Also on that same first release, every branch
> except `main`, `dev`, and `gh-pages` gets pruned, and `dev` gets
> force-reset to match `main`'s tip — a fresh widget always starts from
> `main == dev`, regardless of whether it came from the CLI (already true)
> or a template copy (may have inherited a stray branch, or a `dev` full of
> the source template's own unrelated preview history). All three of these
> only ever apply before your *first* genuine release — once one exists,
> they're permanently a no-op, so it's still safest to never manually
> re-seed `gh-pages` again after that point.

**One-time setup** (the workflow can't do this part for you):

1. **Settings → Pages** → Source: "Deploy from a branch" → branch `gh-pages`
   → `/ (root)`. The workflow creates the `gh-pages` branch itself the first
   time it runs (if it doesn't exist yet), but Pages needs to be pointed at
   it once.
   > ⚠️ **Not `main`.** If Pages is left on (or accidentally set to) `main`,
   > it serves this repo's raw, unbuilt source — including a script tag
   > pointing at `/src/main.tsx` — instead of the built site. The symptom is
   > a blank/black page with a 404 for `/src/main.tsx` in the browser
   > console, even though the workflow itself reports success (it pushed the
   > right build to `gh-pages`; Pages is just reading from the wrong place).
2. **Settings → Actions → General → Workflow permissions** → "Read and write
   permissions". New repos sometimes default the workflow's token to
   read-only, which would fail the push to `gh-pages` with a 403.
3. If the repo is private, set **Pages visibility to Public** — a widget
   embeds inside a Grist iframe, which needs a publicly reachable URL.

No manifest/widget-catalog file is generated — that's a multi-widget,
Grist-widget-repository concept this single-widget template doesn't need.
Paste your `/latest/` or `/v<version>/` URL directly into Grist's custom
widget URL field.

