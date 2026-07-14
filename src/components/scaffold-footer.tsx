// Shown on the showcase hub and channel pages, never inside Grist (there's
// no room, and it's not relevant to using the widget). Purely informational:
// which create-grist-widget release this repo's package.json was scaffolded
// from -- distinct from the repo's own `version`, which the deploy pipeline
// always starts fresh at 0.0.1 regardless of this value (see
// scripts/deploy.mjs's `plan()`). Renders nothing for the pristine template
// source itself, or any copy predating this field.
export function ScaffoldFooter() {
  if (!__CREATE_GRIST_WIDGET_VERSION__) return null

  return (
    <p className="mt-10 text-center text-xs text-muted-foreground">
      Scaffolded from{" "}
      <code className="text-foreground">create-grist-widget@{__CREATE_GRIST_WIDGET_VERSION__}</code>
    </p>
  )
}
