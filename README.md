# create-email-draft

A Grist custom widget: compose an email from the selected row and open it as
a draft in your mail client (`mailto:`). It fills To, Bcc, the subject and
the body from mapped columns, lets you drop or add recipients, insert a
diffusion list (type `/`), and records the status and its date on the row.
Diffusion lists come from a table you pick in the widget's settings
(Grist's "Open configuration").

<!-- install-url:start -->
**Install URL**, to paste into a Grist custom widget's URL field: <https://arthurblanchon.github.io/create-email-draft/latest/>
<!-- install-url:end -->

**Try it:** <https://arthurblanchon.github.io/create-email-draft/latest/demo/>, Grist running in your browser with sample data (nothing is saved).

## In Grist

Add a custom widget, paste the install URL, and set its access level to
**Full document access** (to write the status and read the diffusion lists).

Then map its columns:

| Column | Type | What it is |
| --- | --- | --- |
| `recipients` | Text | Bcc addresses, separated by `,` or `;` |
| `replyToEmail` | Text | To |
| `subject` | Text | the subject |
| `content` | Text, optional | the body |
| `removedRecipients` | Text, optional | addresses dropped from this mailing |
| `status` | Text, optional | written back: the draft's status |
| `statusDate` | DateTime, optional | written back: when |

## Code

The widget's own code is in `src/`:

- `src/app/App.tsx` is the whole widget: `GRIST_OPTIONS`, the compose form,
  and the settings panel for the diffusion lists, stored in the widget's
  options.

## Develop

Develop on the `dev` branch; every push deploys `/dev/`
(<https://arthurblanchon.github.io/create-email-draft/dev/>), which reloads itself in an
open Grist document a few seconds later.

| | |
| --- | --- |
| Install | `pnpm install` |
| Test (emulated Grist, no browser) | `pnpm test` |
| Lint, type-check, build | `pnpm lint`, `pnpm typecheck`, `pnpm build` |
| The widget in a real local Grist (Docker) | `pnpm demo` |
| Regenerate the demo page | `pnpm demo --save` |

`src/main.tsx` is one `mountGristWidget()` call from `grist-widget-sdk/app`:
inside Grist it renders the widget behind the SDK's connection and
column-mapping screens, with its alerts, in Grist's light or dark theme.
Opened anywhere else, it shows which build this is and the URL to paste into
Grist. The widget's code reads Grist only through `grist-widget-sdk`
([docs](https://gristwidgets.com/docs)), never the `grist` global.

`src/main.tsx`, the workflows and the build config are the template's: they
come from `create-grist-widget`, and `pnpm exec create-grist-widget upgrade`
(run on `dev` after Dependabot updates it) rewrites them
([Upgrading a widget](https://gristwidgets.com/docs/cli/upgrading)).
`AGENTS.md` says which files are which.

## Release

1. On `dev`, bump `package.json`'s `version`.
2. Open a pull request from `dev` into `main`, and merge it once its checks
   are green.

Merging builds `/v<version>/` and updates `/latest/` and their demo pages.
Without a version bump, nothing is published. The deploy workflow and its
one-time repository settings are described in the
[template's README](https://github.com/ArthurBlanchon/grist-widget-template#deployment).
