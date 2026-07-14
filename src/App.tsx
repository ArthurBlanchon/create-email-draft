import { Button } from "@/components/ui/button"
import {
  useGrist,
  useWidgetMetadata,
  type UseGristOptions,
  type UseGristResult,
} from "grist-widget-sdk"

import type { TaskMapped, TaskRow } from "./grist-types.example"

export const GRIST_OPTIONS: UseGristOptions = {
  requiredAccess: "read table",
  // Uncomment to require column mapping in the widget config panel:
  // columns: [{ name: "title", type: "Text" }, { name: "done", type: "Bool" }],
}

export const WIDGET_METADATA = {
  title: "Scaffold Latest",
  description:
    "Starter template for building Grist widgets with React and Vite.",
} as const

function GristSelectionDebug({ w }: { w: UseGristResult }) {
  return (
    <details className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 p-3 text-xs">
      <summary className="cursor-pointer font-medium text-muted-foreground">
        Grist selection debug
      </summary>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono">
        <dt className="text-muted-foreground">status</dt>
        <dd>{w.status}</dd>
        <dt className="text-muted-foreground">mode</dt>
        <dd>{w.mode}</dd>
        <dt className="text-muted-foreground">isReady</dt>
        <dd>{String(w.isReady)}</dd>
        <dt className="text-muted-foreground">record.id</dt>
        <dd>{w.record?.id != null ? String(w.record.id) : "—"}</dd>
      </dl>
      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-background/80 p-2">
        {w.record != null
          ? JSON.stringify(w.record, null, 2)
          : "null (no row selected)"}
      </pre>
    </details>
  )
}

function TemplateBody({ w }: { w: UseGristResult }) {
  if (w.mode === "empty") {
    return (
      <div className="flex flex-col gap-4 p-6 text-sm">
        <p>Select a row in Grist to start.</p>
        <GristSelectionDebug w={w} />
      </div>
    )
  }

  if (w.mode === "new-row") {
    return (
      <div className="flex flex-col gap-4 p-6 text-sm">
        <p>Create the new row in Grist, then continue here.</p>
        <GristSelectionDebug w={w} />
      </div>
    )
  }

  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">Widget connected to Grist</h1>
          <p>Record id: {String(w.record?.id ?? "")}</p>
          <p>You can now render values from the selected record.</p>
          <Button className="mt-2">Button</Button>
        </div>
        <GristSelectionDebug w={w} />
        <div className="font-mono text-xs text-muted-foreground">
          (Press <kbd>d</kbd> to toggle dark mode)
        </div>
      </div>
    </div>
  )
}

/**
 * Remount the body when the selected row changes (same pattern as
 * `widgets/create-email-draft`). Keeps local `useState` in sync with Grist.
 */
export function App() {
  useWidgetMetadata(WIDGET_METADATA)

  const w = useGrist<TaskRow, TaskMapped>()
  const rowKey =
    w.record && typeof w.record.id === "number"
      ? String(w.record.id)
      : w.mode

  return <TemplateBody key={rowKey} w={w} />
}

export default App
