# create-email-draft

A Grist custom widget built with `grist-widget-sdk`: compose an email draft
from the linked Grist row and hand it off to the user's mail client. It reads
recipients / reply-to / subject / body from mapped columns, lets you pick a
diffusion list and drop individual recipients, and opens a prefilled
`mailto:` draft (tracking send status/date back on the row).

`src/App.tsx` reads the selected row via `useGristContext<DraftMappedRecord>()`,
renders the compose UI, and — when opened via the widget's config action —
shows a `DiffusionConfigPanel` for editing the diffusion list stored in the
widget options. It declares and exports `GRIST_OPTIONS` (`full` access, plus
the mapped columns: recipients / replyToEmail / subject / content /
removedRecipients / status / statusDate) and `WIDGET_METADATA`.

`src/main.tsx` wraps the app with `GristWidgetProvider`, `GristBoundary`, and
`GristSdkAlerts`. Opened outside a Grist iframe, `main.tsx` renders the
showcase hub (`TemplateLanding`) at a bare path, or a `ChannelNotice` on
`/latest/`, `/dev/`, `/v<version>/` (`src/lib/showcase-routing.ts`); when
embedded, `GristStatusChip` shows live handshake status. `GristSdkAlerts`
maps `getGristSdkAlertDescriptors()` from the SDK to shadcn `Alert`.

- **ESLint** blocks direct `grist` global usage in `src/` — use the SDK only.
- Mapping alerts use `GristSdkAlerts`; the mapped columns are declared in
  `GRIST_OPTIONS` (in `src/App.tsx`).

To add widget tests later, see [Testing](https://github.com/ArthurBlanchon/grist-widget-sdk/blob/main/apps/docs/guide/testing.md) (`renderWithGrist` from `grist-widget-sdk/emulator/testing`).

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

