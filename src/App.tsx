import { useEffect, useMemo, useRef, useState } from "react"

import {
  useGristContext,
  useWidgetMetadata,
  type UseGristOptions,
  type UseGristResult,
  type GristColumnInfo,
} from "grist-widget-sdk"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronDown, Plus, Settings, X } from "lucide-react"

const TEXT = {
  title: "Draft your email",
  subtitle: "Simply create a draft email using mailto",
  replyToPlaceholder: "Enter email address",
  subjectLabel: "Object:",
  subjectPlaceholder: "Enter email subject",
  contentLabel: "Email Content",
  contentPlaceholder: "Write your email content here...",
  additionalRecipientsLabel: "Additional Recipients",
  emailPlaceholder: "Enter email address",
  addRecipientBtn: "Add Recipient",
  composeBtn: "Create email",
  noRecipientsError: "No recipient emails found",
  invalidReplyToError: "Please enter at least one valid recipient in To:",
  noSubjectError: "Please enter an email subject",
  noContentError: "Please enter email content or configure a content column",
  invalidEmailError: "Please enter a valid email address",
  emailExistsError: "This email is already in the recipients list",
  emailOpened: "Email composer opened in your default email client",
  recipientsSelected: "recipients selected",
  removedFrom: "Removed {email} from recipients",
  restoredTo: "Restored {email} to recipients",
  addedTo: "Added {email} to recipients",
  removedFromManual: "Removed {email} from manual recipients",
  contentInfoText:
    "Content auto-filled from first table row. Start with [Subject] to auto-fill subject.",
  contentInfoSubject:
    "Subject and content auto-filled from first table row. Subject was extracted from [Subject].",
  configTitle: "Configuration",
  configSubtitle: "Configure diffusion lists for quick Bcc insertion",
  diffusionTableLabel: "Diffusion List Table",
  diffusionTablePlaceholder: "Select a table…",
  diffusionNameColumnLabel: "Display Name Column",
  diffusionEmailsColumnLabel: "Emails Column",
  diffusionColumnPlaceholder: "Select a column…",
  diffusionPickerHint: "Type / to insert a diffusion list",
  noDiffusionLists: "No matching diffusion lists",
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function splitRecipientTokens(raw: string): string[] {
  return raw
    .split(/[;,]/)
    .map((token) => token.trim())
    .filter(Boolean)
}

/** Between addresses in generated mailto: links (Outlook-style). */
const MAILTO_ADDR_SEP = ";"

let _openConfigHandler: (() => void) | null = null

type ToastType = "success" | "error" | null

type DraftMappedRecord = {
  recipients?: unknown
  replyToEmail?: unknown
  subject?: unknown
  content?: unknown
  removedRecipients?: unknown
  status?: unknown
  statusDate?: unknown
}
type DraftFormSeed = {
  recipientsText: string
  removedRecipientsText: string
  replyTo: string
  subject: string
  content: string
  status: string
  statusDate: string
}

const emptyDraftSeed: DraftFormSeed = {
  recipientsText: "",
  removedRecipientsText: "",
  replyTo: "",
  subject: "",
  content: "",
  status: "",
  statusDate: "",
}

function buildSeed(
  record: Record<string, unknown> | null,
  mappedRecord: DraftMappedRecord | null
): DraftFormSeed {
  if (!record) return emptyDraftSeed
  const mapped = mappedRecord ?? {}
  return {
    recipientsText: String(mapped.recipients ?? ""),
    removedRecipientsText: String(mapped.removedRecipients ?? ""),
    replyTo: String(mapped.replyToEmail ?? ""),
    subject: String(mapped.subject ?? ""),
    content: String(mapped.content ?? ""),
    status: String(mapped.status ?? ""),
    statusDate: String(mapped.statusDate ?? ""),
  }
}

type DiffusionConfig = {
  diffusionTableId: string
  diffusionNameColumn: string
  diffusionEmailsColumn: string
}

type DiffusionEntry = {
  id: number
  name: string
  emails: string[]
}

function parseDiffusionConfig(
  opts: Record<string, unknown> | null
): DiffusionConfig | null {
  if (!opts) return null
  const tableId = opts.diffusionTableId
  const nameCol = opts.diffusionNameColumn
  const emailsCol = opts.diffusionEmailsColumn
  if (
    typeof tableId === "string" &&
    tableId &&
    typeof nameCol === "string" &&
    nameCol &&
    typeof emailsCol === "string" &&
    emailsCol
  ) {
    return {
      diffusionTableId: tableId,
      diffusionNameColumn: nameCol,
      diffusionEmailsColumn: emailsCol,
    }
  }
  return null
}

export const GRIST_OPTIONS: UseGristOptions = {
  requiredAccess: "full",
  hasCustomOptions: true,
  onEditOptions: () => _openConfigHandler?.(),
  columns: [
    { name: "recipients", title: "Bcc:", type: "Text", optional: false },
    { name: "replyToEmail", title: "To:", type: "Text", optional: false },
    { name: "subject", title: "Object:", type: "Text", optional: false },
    { name: "content", title: "Content:", type: "Text", optional: true },
    {
      name: "removedRecipients",
      title: "Removed Bcc",
      type: "Text",
      optional: true,
    },
    { name: "status", title: "Status", type: "Text", optional: true },
    {
      name: "statusDate",
      title: "Status date",
      type: "DateTime",
      optional: true,
    },
  ],
}

export const WIDGET_METADATA = {
  title: "Create Email Draft",
  description: "Compose an email draft from Grist row data and recipients.",
} as const

export function App() {
  useWidgetMetadata(WIDGET_METADATA)

  const w = useGristContext<DraftMappedRecord>()
  const [showConfig, setShowConfig] = useState(false)

  useEffect(() => {
    _openConfigHandler = () => setShowConfig(true)
    return () => {
      _openConfigHandler = null
    }
  }, [])

  const rowKey =
    w.record && typeof w.record.id === "number" ? String(w.record.id) : "none"
  const diffusionConfig = parseDiffusionConfig(w.widgetOptions)

  if (showConfig) {
    return (
      <DiffusionConfigPanel w={w} onClose={() => setShowConfig(false)} />
    )
  }

  return (
    <CreateDraftEmailForm
      key={rowKey}
      w={w}
      diffusionConfig={diffusionConfig}
    />
  )
}

function DiffusionConfigPanel({
  w,
  onClose,
}: {
  w: UseGristResult<DraftMappedRecord>
  onClose: () => void
}) {
  const [tables, setTables] = useState<string[]>([])
  const [columns, setColumns] = useState<GristColumnInfo[]>([])
  const [selectedTable, setSelectedTable] = useState("")
  const [selectedNameCol, setSelectedNameCol] = useState("")
  const [selectedEmailsCol, setSelectedEmailsCol] = useState("")
  const [columnsLoading, setColumnsLoading] = useState(false)

  const wRef = useRef(w)
  wRef.current = w

  useEffect(() => {
    const config = parseDiffusionConfig(wRef.current.widgetOptions)
    if (config) {
      setSelectedTable(config.diffusionTableId)
      setSelectedNameCol(config.diffusionNameColumn)
      setSelectedEmailsCol(config.diffusionEmailsColumn)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void wRef.current.listTables().then(setTables)
  }, [])

  useEffect(() => {
    if (!selectedTable) {
      setColumns([])
      return
    }
    setColumnsLoading(true)
    void wRef.current
      .listColumns(selectedTable)
      .then(setColumns)
      .catch(() => setColumns([]))
      .finally(() => setColumnsLoading(false))
  }, [selectedTable])

  const handleSave = async () => {
    await w.patchWidgetOptions({
      diffusionTableId: selectedTable,
      diffusionNameColumn: selectedNameCol,
      diffusionEmailsColumn: selectedEmailsCol,
    })
    onClose()
  }

  const canSave = selectedTable && selectedNameCol && selectedEmailsCol

  return (
    <main className="mx-auto h-dvh max-w-3xl px-4 pt-3 pb-4 text-sm">
      <section className="flex h-full min-h-0 flex-col">
        <header className="mb-6">
          <div className="mb-1 flex items-center gap-2 pt-1">
            <Settings className="size-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">{TEXT.configTitle}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {TEXT.configSubtitle}
          </p>
        </header>

        <div className="flex flex-col gap-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {TEXT.diffusionTableLabel}
            </label>
            <div className="relative">
              <select
                className="w-full appearance-none rounded-md border bg-background px-3 py-2 pr-8 text-sm outline-none focus:border-ring"
                value={selectedTable}
                onChange={(e) => {
                  setSelectedTable(e.target.value)
                  setSelectedNameCol("")
                  setSelectedEmailsCol("")
                }}
              >
                <option value="">{TEXT.diffusionTablePlaceholder}</option>
                {tables.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {selectedTable && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {TEXT.diffusionNameColumnLabel}
                </label>
                <div className="relative">
                  <select
                    className="w-full appearance-none rounded-md border bg-background px-3 py-2 pr-8 text-sm outline-none focus:border-ring"
                    value={selectedNameCol}
                    onChange={(e) => setSelectedNameCol(e.target.value)}
                    disabled={columnsLoading}
                  >
                    <option value="">
                      {TEXT.diffusionColumnPlaceholder}
                    </option>
                    {columns.map((c) => (
                      <option key={c.colId} value={c.colId}>
                        {c.label && c.label !== c.colId ? `${c.label} (${c.colId})` : c.colId}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {TEXT.diffusionEmailsColumnLabel}
                </label>
                <div className="relative">
                  <select
                    className="w-full appearance-none rounded-md border bg-background px-3 py-2 pr-8 text-sm outline-none focus:border-ring"
                    value={selectedEmailsCol}
                    onChange={(e) => setSelectedEmailsCol(e.target.value)}
                    disabled={columnsLoading}
                  >
                    <option value="">
                      {TEXT.diffusionColumnPlaceholder}
                    </option>
                    {columns.map((c) => (
                      <option key={c.colId} value={c.colId}>
                        {c.label && c.label !== c.colId ? `${c.label} (${c.colId})` : c.colId}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-3">
            <Button
              onClick={() => void handleSave()}
              disabled={!canSave}
            >
              Save
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}

function CreateDraftEmailForm({
  w,
  diffusionConfig,
}: {
  w: UseGristResult<DraftMappedRecord>
  diffusionConfig: DiffusionConfig | null
}) {
  const { isAvailable, record, mappedRecord, mappings, table } = w

  const seed = buildSeed(record, mappedRecord)
  const [recipientsText, setRecipientsText] = useState(seed.recipientsText)
  const [removedRecipientsText, setRemovedRecipientsText] = useState(
    seed.removedRecipientsText
  )
  const [replyTo, setReplyTo] = useState(seed.replyTo)
  const [subject, setSubject] = useState(seed.subject)
  const [content, setContent] = useState(seed.content)
  const [status, setStatus] = useState(seed.status)
  const [statusDate, setStatusDate] = useState(seed.statusDate)
  const [renderNowTs] = useState(() => Date.now())
  const [toInput, setToInput] = useState("")
  const [recipientInput, setRecipientInput] = useState("")

  const hasSelectedRow = !!record
  const recordId = typeof record?.id === "number" ? record.id : null
  const mappingReady = w.columnMappingStatus.ok

  const [toastMessage, setToastMessage] = useState("")
  const [toastType, setToastType] = useState<ToastType>(null)

  const t = (text: string, replacements?: Record<string, string>) => {
    let value = text
    if (!replacements) return text
    for (const [k, v] of Object.entries(replacements)) {
      value = value.replace(`{${k}}`, v)
    }
    return value
  }

  useEffect(() => {
    if (!toastMessage || !toastType) return
    const timeout = window.setTimeout(() => {
      setToastMessage("")
      setToastType(null)
    }, 3000)
    return () => window.clearTimeout(timeout)
  }, [toastMessage, toastType])

  const [diffusionEntries, setDiffusionEntries] = useState<DiffusionEntry[]>(
    []
  )
  const [diffusionLoading, setDiffusionLoading] = useState(false)
  const [showDiffusionPicker, setShowDiffusionPicker] = useState(false)
  const [diffusionPickerIndex, setDiffusionPickerIndex] = useState(0)
  const bccInputRef = useRef<HTMLInputElement>(null)
  const formWRef = useRef(w)
  formWRef.current = w

  const diffusionConfigKey = diffusionConfig
    ? `${diffusionConfig.diffusionTableId}:${diffusionConfig.diffusionNameColumn}:${diffusionConfig.diffusionEmailsColumn}`
    : ""

  useEffect(() => {
    if (!diffusionConfig || !w.isReady) {
      setDiffusionEntries([])
      return
    }
    const { diffusionTableId, diffusionNameColumn, diffusionEmailsColumn } =
      diffusionConfig
    setDiffusionLoading(true)
    void formWRef.current
      .fetchTableRows(diffusionTableId)
      .then((rows) => {
        const entries: DiffusionEntry[] = rows
          .map((row) => ({
            id: row.id as number,
            name: String(
              (row as Record<string, unknown>)[diffusionNameColumn] ?? ""
            ),
            emails: splitRecipientTokens(
              String(
                (row as Record<string, unknown>)[diffusionEmailsColumn] ?? ""
              )
            ).filter((e) => EMAIL_RE.test(e)),
          }))
          .filter((e) => e.name && e.emails.length > 0)
        setDiffusionEntries(entries)
      })
      .catch(() => setDiffusionEntries([]))
      .finally(() => setDiffusionLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diffusionConfigKey, w.isReady])

  const diffusionFilter = useMemo(() => {
    const slashIdx = recipientInput.lastIndexOf("/")
    if (slashIdx < 0) return ""
    return recipientInput.substring(slashIdx + 1).toLowerCase()
  }, [recipientInput])

  const filteredDiffusionEntries = useMemo(() => {
    if (!showDiffusionPicker) return []
    if (!diffusionFilter) return diffusionEntries
    return diffusionEntries.filter((e) =>
      e.name.toLowerCase().includes(diffusionFilter)
    )
  }, [diffusionEntries, diffusionFilter, showDiffusionPicker])

  const recipients = useMemo(
    () => Array.from(new Set(splitRecipientTokens(recipientsText))),
    [recipientsText]
  )
  const removedRecipients = useMemo(
    () =>
      Array.from(
        new Set(
          splitRecipientTokens(removedRecipientsText)
            .map((item) => item.toLowerCase())
            .filter((email) => EMAIL_RE.test(email))
        )
      ),
    [removedRecipientsText]
  )
  const toRecipients = useMemo(
    () =>
      Array.from(
        new Set(splitRecipientTokens(replyTo).map((item) => item.toLowerCase()))
      ),
    [replyTo]
  )
  const invalidToRecipients = useMemo(
    () => toRecipients.filter((email) => !EMAIL_RE.test(email)),
    [toRecipients]
  )
  const invalidRecipients = useMemo(
    () => recipients.filter((email) => !EMAIL_RE.test(email)),
    [recipients]
  )
  const toFieldError =
    invalidToRecipients.length > 0
      ? `${invalidToRecipients.length} invalid recipient${invalidToRecipients.length > 1 ? "s" : ""}`
      : ""
  const recipientsFieldError =
    invalidRecipients.length > 0
      ? `${invalidRecipients.length} invalid recipient${invalidRecipients.length > 1 ? "s" : ""}`
      : ""
  const normalizedStatus = status.trim().toLowerCase()
  const isSent = normalizedStatus === "sent"
  const canMarkSent = normalizedStatus === "created"
  const formattedStatusDate = useMemo(() => {
    if (!statusDate.trim()) return ""
    const parsed = new Date(statusDate)
    if (Number.isNaN(parsed.getTime())) return statusDate
    return parsed.toLocaleDateString()
  }, [statusDate])
  const statusDateRelative = useMemo(() => {
    if (!statusDate.trim()) return ""
    const parsed = new Date(statusDate)
    if (Number.isNaN(parsed.getTime())) return ""

    const diffMs = Math.max(0, renderNowTs - parsed.getTime())
    const dayMs = 24 * 60 * 60 * 1000
    const days = Math.floor(diffMs / dayMs)

    if (days <= 0) return "today"
    if (days === 1) return "1 day ago"
    if (days < 30) return `${days} days ago`

    const months = Math.floor(days / 30)
    if (months === 1) return "1 month ago"
    if (months < 12) return `${months} months ago`

    const years = Math.floor(months / 12)
    return years === 1 ? "1 year ago" : `${years} years ago`
  }, [statusDate, renderNowTs])
  const lastDraftLabel = useMemo(() => {
    if (normalizedStatus !== "created" || !formattedStatusDate) return ""
    return `Last draft created on ${formattedStatusDate}`
  }, [normalizedStatus, formattedStatusDate])

  const showSuccess = (message: string) => {
    setToastType("success")
    setToastMessage(message)
  }

  const showError = (message: string) => {
    setToastType("error")
    setToastMessage(message)
  }

  const saveField = async (
    fieldName:
      | "recipients"
      | "removedRecipients"
      | "replyToEmail"
      | "subject"
      | "content"
      | "status"
      | "statusDate",
    value: string
  ) => {
    if (recordId === null) return
    const mappedColumnId = mappings[fieldName]
    if (typeof mappedColumnId !== "string" || mappedColumnId === "id") return
    await table.update({
      id: recordId,
      fields: { [mappedColumnId]: value },
    })
  }

  const saveRecipients = async (nextRecipients: string[]) => {
    const value = nextRecipients.join(", ")
    setRecipientsText(value)
    await saveField("recipients", value)
  }
  const saveToRecipients = async (nextToRecipients: string[]) => {
    const value = nextToRecipients.join(", ")
    setReplyTo(value)
    await saveField("replyToEmail", value)
  }
  const saveRemovedRecipients = async (nextRemovedRecipients: string[]) => {
    const value = nextRemovedRecipients.join(", ")
    setRemovedRecipientsText(value)
    await saveField("removedRecipients", value)
  }
  const saveStatus = async (nextStatus: string) => {
    setStatus(nextStatus)
    await saveField("status", nextStatus)
  }
  const saveStatusDate = async (nextStatusDate: string) => {
    setStatusDate(nextStatusDate)
    await saveField("statusDate", nextStatusDate)
  }

  const removeEmail = async (email: string) => {
    const next = recipients.filter((item) => item !== email)
    await saveRecipients(next)
    if (EMAIL_RE.test(email) && !removedRecipients.includes(email)) {
      await saveRemovedRecipients([...removedRecipients, email])
    }
    showSuccess(t(TEXT.removedFrom, { email }))
  }

  const commitRecipientTokens = async (rawValue: string) => {
    const tokens = splitRecipientTokens(rawValue).map((token) =>
      token.toLowerCase()
    )

    if (!tokens.length) return

    const next = [...recipients]
    let addedCount = 0
    let hasInvalid = false
    let hasDuplicate = false

    for (const email of tokens) {
      if (!EMAIL_RE.test(email)) {
        hasInvalid = true
        continue
      }
      if (next.includes(email)) {
        hasDuplicate = true
        continue
      }
      next.push(email)
      addedCount += 1
    }

    if (!addedCount) {
      if (hasInvalid) showError(TEXT.invalidEmailError)
      else if (hasDuplicate) showError(TEXT.emailExistsError)
      return
    }

    const restored = tokens.filter((email) => next.includes(email))
    const nextRemoved = removedRecipients.filter(
      (email) => !restored.includes(email)
    )
    await saveRecipients(next)
    await saveRemovedRecipients(nextRemoved)
    setRecipientInput("")
    showSuccess(`${addedCount} recipient${addedCount > 1 ? "s" : ""} added`)
  }

  const removeLastEmail = async () => {
    const last = recipients.at(-1)
    if (!last) return
    await removeEmail(last)
  }
  const removeToEmail = async (email: string) => {
    const next = toRecipients.filter((item) => item !== email)
    await saveToRecipients(next)
  }
  const removeLastToEmail = async () => {
    const last = toRecipients.at(-1)
    if (!last) return
    await removeToEmail(last)
  }
  const commitToTokens = async (rawValue: string) => {
    const tokens = splitRecipientTokens(rawValue).map((token) =>
      token.toLowerCase()
    )
    if (!tokens.length) return

    const next = [...toRecipients]
    let addedCount = 0
    let hasInvalid = false
    let hasDuplicate = false

    for (const email of tokens) {
      if (!EMAIL_RE.test(email)) {
        hasInvalid = true
        continue
      }
      if (next.includes(email)) {
        hasDuplicate = true
        continue
      }
      next.push(email)
      addedCount += 1
    }

    if (!addedCount) {
      if (hasInvalid) showError(TEXT.invalidReplyToError)
      else if (hasDuplicate) showError(TEXT.emailExistsError)
      return
    }

    await saveToRecipients(next)
    setToInput("")
    showSuccess(`${addedCount} recipient${addedCount > 1 ? "s" : ""} added`)
  }
  const restoreEmail = async (email: string) => {
    if (!EMAIL_RE.test(email)) return
    const nextRecipients = recipients.includes(email)
      ? recipients
      : [...recipients, email]
    const nextRemoved = removedRecipients.filter((item) => item !== email)
    await saveRecipients(nextRecipients)
    await saveRemovedRecipients(nextRemoved)
    showSuccess(t(TEXT.restoredTo, { email }))
  }

  const selectDiffusionEntry = async (entry: DiffusionEntry) => {
    const next = [...recipients]
    let addedCount = 0
    for (const email of entry.emails) {
      if (!next.includes(email)) {
        next.push(email)
        addedCount += 1
      }
    }
    if (addedCount > 0) {
      const nextRemoved = removedRecipients.filter(
        (e) => !entry.emails.includes(e)
      )
      await saveRecipients(next)
      await saveRemovedRecipients(nextRemoved)
      showSuccess(
        `Added ${addedCount} recipient${addedCount > 1 ? "s" : ""} from "${entry.name}"`
      )
    }
    setRecipientInput("")
    setShowDiffusionPicker(false)
  }

  const composeEmail = () => {
    if (!mappingReady) {
      return
    }

    if (recipients.length === 0) {
      showError(TEXT.noRecipientsError)
      return
    }
    if (invalidRecipients.length > 0) {
      showError(TEXT.invalidEmailError)
      return
    }

    if (toRecipients.length === 0 || invalidToRecipients.length > 0) {
      showError(TEXT.invalidReplyToError)
      return
    }

    if (!subject.trim()) {
      showError(TEXT.noSubjectError)
      return
    }

    if (!content.trim()) {
      showError(TEXT.noContentError)
      return
    }

    const mailto = `mailto:${encodeURIComponent(toRecipients.join(MAILTO_ADDR_SEP))}?bcc=${encodeURIComponent(
      recipients.join(MAILTO_ADDR_SEP)
    )}&subject=${encodeURIComponent(subject.trim())}&body=${encodeURIComponent(content.trim())}`

    try {
      // Avoid cross-origin frame access (SecurityError on window.parent.open).
      window.open(mailto, "_blank", "noopener,noreferrer")
    } catch {
      // Fallback for strict popup policies.
      window.location.href = mailto
    }

    showSuccess(TEXT.emailOpened)
    const now = new Date().toISOString()
    void saveStatus("created")
    void saveStatusDate(now)
  }
  const markAsSent = async () => {
    const now = new Date().toISOString()
    await saveStatus("sent")
    await saveStatusDate(now)
    showSuccess("Status updated to sent")
  }

  return (
    <main className="mx-auto h-dvh max-w-3xl px-4 pt-3 pb-4 text-sm">
      <section className="flex h-full min-h-0 flex-col">
        <header className="relative mb-4">
          {toastMessage ? (
            <div
              className={
                toastType === "error"
                  ? "pointer-events-none absolute top-0 right-0 left-0 z-10 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700 shadow-sm"
                  : "pointer-events-none absolute top-0 right-0 left-0 z-10 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-green-700 shadow-sm"
              }
            >
              {toastMessage}
            </div>
          ) : null}
          <div className="mb-1 flex items-center justify-between gap-3 pt-1">
            <h1 className="text-lg font-semibold">{TEXT.title}</h1>
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className={
                  isAvailable === true
                    ? "size-2 animate-pulse rounded-full bg-green-500"
                    : "size-2 animate-pulse rounded-full bg-red-500"
                }
              />
              {isAvailable === null
                ? "Grist: loading..."
                : isAvailable
                  ? "Grist: ready"
                  : "Grist: unavailable"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{TEXT.subtitle}</p>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex items-start gap-2">
            <div className="w-full overflow-hidden rounded-md border focus-within:border-ring">
              <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  To: ({toRecipients.length})
                </span>
                <span className="text-red-600">{toFieldError}</span>
              </div>
              <div className="p-2">
                <div className="flex flex-wrap items-center gap-2">
                  {toRecipients.map((email) => {
                    const isInvalid = !EMAIL_RE.test(email)
                    return (
                      <span
                        key={email}
                        title={isInvalid ? "Invalid email format" : undefined}
                        className={
                          isInvalid
                            ? "inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700"
                            : "inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-1 text-xs"
                        }
                      >
                        <span>{email}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${email}`}
                          className={
                            isInvalid
                              ? "rounded p-0.5 text-red-500 hover:bg-red-100 hover:text-red-700"
                              : "rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                          }
                          disabled={isSent}
                          onClick={() => void removeToEmail(email)}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    )
                  })}
                  <input
                    type="text"
                    className="min-w-52 flex-1 border-0 bg-transparent px-1 py-1 outline-none"
                    placeholder={TEXT.replyToPlaceholder}
                    value={toInput}
                    disabled={isSent}
                    onChange={(event) => setToInput(event.target.value)}
                    onBlur={() => void commitToTokens(toInput)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" ||
                        event.key === "," ||
                        event.key === ";"
                      ) {
                        event.preventDefault()
                        void commitToTokens(toInput)
                      } else if (event.key === "Backspace" && !toInput.trim()) {
                        event.preventDefault()
                        void removeLastToEmail()
                      }
                    }}
                    onPaste={(event) => {
                      const pasted = event.clipboardData.getData("text")
                      if (!pasted.includes(",") && !pasted.includes(";")) return
                      event.preventDefault()
                      void commitToTokens(pasted)
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="flex min-w-40 flex-col items-stretch gap-2 self-stretch">
              {!isSent ? (
                <Button
                  className="h-auto flex-1"
                  onClick={composeEmail}
                  disabled={!hasSelectedRow || !mappingReady}
                >
                  {!hasSelectedRow
                    ? "Select an email"
                    : !mappingReady
                      ? "Map required columns"
                      : TEXT.composeBtn}
                </Button>
              ) : null}
              {status.trim() ? (
                isSent ? (
                  <div className="text-sm font-semibold text-foreground">
                    <p>Sent the</p>
                    <p>{formattedStatusDate || "-"}</p>
                    {statusDateRelative ? <p>({statusDateRelative})</p> : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {lastDraftLabel || `Status: ${status}`}
                    {normalizedStatus === "created" && statusDateRelative
                      ? ` (${statusDateRelative})`
                      : ""}
                    {normalizedStatus !== "created" && formattedStatusDate
                      ? ` (${formattedStatusDate})`
                      : ""}
                    {canMarkSent ? (
                      <>
                        {" "}
                        <button
                          type="button"
                          className="font-semibold text-foreground underline-offset-2 hover:underline"
                          onClick={() => void markAsSent()}
                        >
                          Mark as sent
                        </button>
                      </>
                    ) : null}
                  </p>
                )
              ) : null}
            </div>
          </div>

          <div className="space-y-1">
            <div className="relative">
              <div className="overflow-hidden rounded-md border focus-within:border-ring">
                <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    Bcc: ({recipients.length})
                  </span>
                  <span className="text-red-600">{recipientsFieldError}</span>
                </div>
                <div className="max-h-56 overflow-auto p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {recipients.map((email) => {
                      const isInvalid = !EMAIL_RE.test(email)
                      return (
                        <span
                          key={email}
                          title={
                            isInvalid ? "Invalid email format" : undefined
                          }
                          className={
                            isInvalid
                              ? "inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700"
                              : "inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-1 text-xs"
                          }
                        >
                          <span>{email}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${email}`}
                            className={
                              isInvalid
                                ? "rounded p-0.5 text-red-500 hover:bg-red-100 hover:text-red-700"
                                : "rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                            }
                            disabled={isSent}
                            onClick={() => void removeEmail(email)}
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      )
                    })}
                    <input
                      ref={bccInputRef}
                      type="text"
                      className="min-w-52 flex-1 border-0 bg-transparent px-1 py-1 outline-none"
                      placeholder={
                        diffusionConfig
                          ? TEXT.diffusionPickerHint
                          : TEXT.emailPlaceholder
                      }
                      value={recipientInput}
                      disabled={isSent}
                      onChange={(event) => {
                        const val = event.target.value
                        setRecipientInput(val)
                        if (val.includes("/") && diffusionConfig) {
                          setShowDiffusionPicker(true)
                          setDiffusionPickerIndex(0)
                        } else {
                          setShowDiffusionPicker(false)
                        }
                      }}
                      onBlur={() => {
                        window.setTimeout(() => {
                          setShowDiffusionPicker(false)
                        }, 150)
                        if (
                          !recipientInput.includes("/") &&
                          recipientInput.trim()
                        ) {
                          void commitRecipientTokens(recipientInput)
                        }
                      }}
                      onKeyDown={(event) => {
                        if (
                          showDiffusionPicker &&
                          filteredDiffusionEntries.length > 0
                        ) {
                          if (event.key === "ArrowDown") {
                            event.preventDefault()
                            setDiffusionPickerIndex((i) =>
                              Math.min(
                                i + 1,
                                filteredDiffusionEntries.length - 1
                              )
                            )
                            return
                          }
                          if (event.key === "ArrowUp") {
                            event.preventDefault()
                            setDiffusionPickerIndex((i) =>
                              Math.max(i - 1, 0)
                            )
                            return
                          }
                          if (event.key === "Enter") {
                            event.preventDefault()
                            void selectDiffusionEntry(
                              filteredDiffusionEntries[diffusionPickerIndex]
                            )
                            return
                          }
                        }
                        if (
                          showDiffusionPicker &&
                          event.key === "Escape"
                        ) {
                          event.preventDefault()
                          setShowDiffusionPicker(false)
                          setRecipientInput("")
                          return
                        }
                        if (
                          event.key === "Enter" ||
                          event.key === "," ||
                          event.key === ";"
                        ) {
                          event.preventDefault()
                          void commitRecipientTokens(recipientInput)
                        } else if (
                          event.key === "Backspace" &&
                          !recipientInput.trim()
                        ) {
                          event.preventDefault()
                          void removeLastEmail()
                        }
                      }}
                      onPaste={(event) => {
                        const pasted = event.clipboardData.getData("text")
                        if (
                          !pasted.includes(",") &&
                          !pasted.includes(";")
                        )
                          return
                        event.preventDefault()
                        void commitRecipientTokens(pasted)
                      }}
                    />
                  </div>
                </div>
              </div>

              {showDiffusionPicker && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-md border bg-background shadow-lg">
                  {diffusionLoading ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Loading diffusion lists…
                    </div>
                  ) : filteredDiffusionEntries.length > 0 ? (
                    filteredDiffusionEntries.map((entry, index) => (
                      <button
                        key={entry.id}
                        type="button"
                        className={cn(
                          "flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-muted",
                          index === diffusionPickerIndex && "bg-muted"
                        )}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          void selectDiffusionEntry(entry)
                        }}
                      >
                        <span className="font-medium">{entry.name}</span>
                        <span className="text-muted-foreground">
                          {entry.emails.length} email
                          {entry.emails.length > 1 ? "s" : ""}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      {TEXT.noDiffusionLists}
                    </div>
                  )}
                </div>
              )}
            </div>

            {removedRecipients.length ? (
              <div className="pt-2">
                <div className="flex flex-wrap gap-2">
                  {removedRecipients.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-1 text-xs text-muted-foreground"
                    >
                      <span className="line-through">{email}</span>
                      <button
                        type="button"
                        aria-label={`Restore ${email}`}
                        className="rounded p-0.5 hover:bg-background hover:text-foreground"
                        disabled={isSent}
                        onClick={() => void restoreEmail(email)}
                      >
                        <Plus className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-1 flex-col pt-1">
            <div className="flex w-full items-center rounded-t-md border bg-background focus-within:border-ring">
              <span className="border-r px-3 py-2 text-muted-foreground">
                {TEXT.subjectLabel}
              </span>
              <input
                type="text"
                className="w-full border-0 bg-transparent px-3 py-2 outline-none"
                placeholder={TEXT.subjectPlaceholder}
                value={subject}
                disabled={isSent}
                onChange={(event) => setSubject(event.target.value)}
                onBlur={() => void saveField("subject", subject)}
              />
            </div>
            <textarea
              className="h-full min-h-36 w-full flex-1 rounded-b-md border border-t-0 px-3 py-2 focus:border-ring focus:outline-none"
              placeholder={TEXT.contentPlaceholder}
              value={content}
              disabled={isSent}
              onChange={(event) => setContent(event.target.value)}
              onBlur={() => void saveField("content", content)}
            />
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
