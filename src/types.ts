export const SCHEMA_VERSION = 2 as const
export const SESSION_SCHEMA_VERSION = 1 as const

export interface Scenario {
  id: string
  name: string
  color: string
  padIds: string[]
}

export interface MusicPad {
  id: string
  label: string
  originalUrl: string
  videoId: string
  scenarioId: string
  starred: boolean
}

export interface PlaybackSettings {
  volume: number
}

export interface BoardState {
  schemaVersion: typeof SCHEMA_VERSION
  scenarios: Scenario[]
  pads: Record<string, MusicPad>
  settings: PlaybackSettings
}

export type PlayerStatus =
  | 'loading'
  | 'ready'
  | 'buffering'
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'error'

export interface PlaybackState {
  activePadId: string | null
  pendingPadId: string | null
  status: PlayerStatus
  savedVolume: number
  currentError: string | null
}

export interface PlayerSnapshot {
  activePadId: string | null
  pendingPadId: string | null
  status: PlayerStatus
  currentError: string | null
}

export interface SessionLogEntry {
  id: string
  padId: string
  scenarioName: string
  padLabel: string
  selectedAt: string
}

export interface ActiveSession {
  schemaVersion: typeof SESSION_SCHEMA_VERSION
  id: string
  startedAt: string
  entries: SessionLogEntry[]
}
