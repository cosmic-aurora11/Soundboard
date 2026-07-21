import {
  SESSION_SCHEMA_VERSION,
  type ActiveSession,
  type MusicPad,
  type Scenario,
  type SessionLogEntry,
} from '../types'

export const ACTIVE_SESSION_STORAGE_KEY = 'resonance-session:active:v1'

export interface SessionLoadResult {
  session: ActiveSession | null
  warning: string | null
}

export interface SessionEntryGroup {
  scenarioName: string
  entries: SessionLogEntry[]
}

export function createActiveSession(now = new Date()): ActiveSession {
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: makeId('session'),
    startedAt: now.toISOString(),
    entries: [],
  }
}

export function appendSessionEntry(
  session: ActiveSession,
  pad: MusicPad,
  scenario: Scenario,
  now = new Date(),
): ActiveSession {
  const previous = session.entries.at(-1)
  if (previous?.padId === pad.id) return session

  return {
    ...session,
    entries: [
      ...session.entries,
      {
        id: makeId('entry'),
        padId: pad.id,
        scenarioName: scenario.name,
        padLabel: pad.label,
        selectedAt: now.toISOString(),
      },
    ],
  }
}

export function groupSessionEntries(entries: SessionLogEntry[]): SessionEntryGroup[] {
  return entries.reduce<SessionEntryGroup[]>((groups, entry) => {
    const current = groups.at(-1)
    if (current?.scenarioName === entry.scenarioName) {
      current.entries.push(entry)
    } else {
      groups.push({ scenarioName: entry.scenarioName, entries: [entry] })
    }
    return groups
  }, [])
}

export function loadActiveSession(
  storage: Pick<Storage, 'getItem'> = localStorage,
): SessionLoadResult {
  try {
    const serialized = storage.getItem(ACTIVE_SESSION_STORAGE_KEY)
    if (!serialized) return { session: null, warning: null }
    const parsed: unknown = JSON.parse(serialized)
    if (!isActiveSession(parsed)) {
      return {
        session: null,
        warning: 'The active session log could not be read. Its stored data was not overwritten.',
      }
    }
    return { session: parsed, warning: null }
  } catch {
    return {
      session: null,
      warning: 'The active session log could not be read. Its stored data was not overwritten.',
    }
  }
}

export function saveActiveSession(
  session: ActiveSession | null,
  storage: Pick<Storage, 'setItem' | 'removeItem'> = localStorage,
): string | null {
  try {
    if (session) storage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(session))
    else storage.removeItem(ACTIVE_SESSION_STORAGE_KEY)
    return null
  } catch {
    return 'The active session log could not be saved. Keep this page open until the session is downloaded.'
  }
}

export function createSessionDocument(
  session: ActiveSession,
  endedAt = new Date(),
  locale = 'en-US',
  timeZone?: string,
): { filename: string; markdown: string } {
  const startedAt = new Date(session.startedAt)
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  })
  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  })

  const lines = [
    `# Resonance Session — ${dateFormatter.format(startedAt)}`,
    '',
    `Started: ${timeFormatter.format(startedAt)}`,
    `Ended: ${timeFormatter.format(endedAt)}`,
    '',
  ]

  const groups = groupSessionEntries(session.entries)
  if (groups.length === 0) {
    lines.push('_No tracks were selected._', '')
  } else {
    groups.forEach((group) => {
      lines.push(`## ${group.scenarioName}`)
      group.entries.forEach((entry) => lines.push(`- ${entry.padLabel}`))
      lines.push('')
    })
  }

  return {
    filename: `resonance-session-${formatFilenameTimestamp(endedAt)}.md`,
    markdown: `${lines.join('\n').trimEnd()}\n`,
  }
}

export function isActiveSession(value: unknown): value is ActiveSession {
  return (
    isRecord(value) &&
    value.schemaVersion === SESSION_SCHEMA_VERSION &&
    isNonEmptyString(value.id) &&
    isIsoDate(value.startedAt) &&
    Array.isArray(value.entries) &&
    value.entries.every(isSessionEntry)
  )
}

function isSessionEntry(value: unknown): value is SessionLogEntry {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.padId) &&
    isNonEmptyString(value.scenarioName) &&
    isNonEmptyString(value.padLabel) &&
    isIsoDate(value.selectedAt)
  )
}

function formatFilenameTimestamp(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}-${hours}${minutes}`
}

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}
