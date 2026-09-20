import { createDefaultBoard } from './defaults'
import { SCHEMA_VERSION, type BoardState, type MusicPad, type Scenario } from '../types'

export const STORAGE_KEY = 'resonance-board:v2'
export const LEGACY_STORAGE_KEY = 'resonance-board:v1'

type LegacyMusicPad = Omit<MusicPad, 'starred'>

interface LegacyBoardState extends Omit<BoardState, 'schemaVersion' | 'pads'> {
  schemaVersion: 1
  pads: Record<string, LegacyMusicPad>
}

export interface LoadBoardResult {
  board: BoardState
  warning: string | null
}

export function isBoardState(value: unknown): value is BoardState {
  return isRecord(value) && value.schemaVersion === SCHEMA_VERSION && hasValidBoardStructure(value, isMusicPad)
}

export function migrateBoardState(value: unknown): BoardState | null {
  if (isBoardState(value)) return value
  if (!isLegacyBoardState(value)) return null

  return {
    schemaVersion: SCHEMA_VERSION,
    scenarios: value.scenarios,
    pads: Object.fromEntries(
      Object.entries(value.pads).map(([id, pad]) => [id, { ...pad, starred: false }]),
    ),
    settings: value.settings,
  }
}

function hasValidBoardStructure(
  value: Record<string, unknown>,
  padValidator: (value: unknown) => boolean,
): boolean {
  if (!Array.isArray(value.scenarios) || !isRecord(value.pads)) return false
  if (!isRecord(value.settings) || !isValidVolume(value.settings.volume)) return false

  if (value.settings.fadeSeconds !== undefined && !isNonNegativeNumber(value.settings.fadeSeconds)) return false

  const scenarios = value.scenarios
  const scenarioIds = new Set<string>()
  const referencedPadIds = new Set<string>()

  for (const scenario of scenarios) {
    if (!isScenario(scenario) || scenarioIds.has(scenario.id)) return false
    scenarioIds.add(scenario.id)
    for (const padId of scenario.padIds) {
      if (referencedPadIds.has(padId)) return false
      referencedPadIds.add(padId)
    }
  }

  const padEntries = Object.entries(value.pads)
  for (const [key, pad] of padEntries) {
    if (!padValidator(pad) || !isRecord(pad)) return false
    const padId = pad.id
    const scenarioId = pad.scenarioId
    if (typeof padId !== 'string' || typeof scenarioId !== 'string' || key !== padId) return false
    if (!scenarioIds.has(scenarioId) || !referencedPadIds.has(padId)) return false
    const owner = scenarios.find((scenario) => scenario.id === scenarioId)
    if (!owner?.padIds.includes(padId)) return false
  }

  return referencedPadIds.size === padEntries.length
}

export function loadBoard(storage: Pick<Storage, 'getItem'> = localStorage): LoadBoardResult {
  try {
    const serialized = storage.getItem(STORAGE_KEY)
    if (serialized) {
      const parsed: unknown = JSON.parse(serialized)
      if (isBoardState(parsed)) return { board: parsed, warning: null }
      return {
        board: createDefaultBoard(),
        warning: 'Saved board data was invalid, so a fresh board was opened. Your stored data was not overwritten.',
      }
    }

    const legacySerialized = storage.getItem(LEGACY_STORAGE_KEY)
    if (!legacySerialized) return { board: createDefaultBoard(), warning: null }
    const migrated = migrateBoardState(JSON.parse(legacySerialized) as unknown)
    if (migrated) return { board: migrated, warning: null }
    return {
      board: createDefaultBoard(),
      warning: 'Saved board data was invalid, so a fresh board was opened. Your stored data was not overwritten.',
    }
  } catch {
    return {
      board: createDefaultBoard(),
      warning: 'The saved board could not be read. A fresh board is open for this session.',
    }
  }
}

export function saveBoard(board: BoardState, storage: Pick<Storage, 'setItem'> = localStorage): string | null {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(board))
    return null
  } catch {
    return 'Changes could not be saved in this browser. Export a backup before closing the page.'
  }
}

export function parseImportedBoard(text: string): BoardState {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('The selected file is not valid JSON.')
  }

  const migrated = migrateBoardState(parsed)
  if (!migrated) {
    throw new Error('This is not a valid Resonance Board backup.')
  }
  return migrated
}

function isLegacyBoardState(value: unknown): value is LegacyBoardState {
  return isRecord(value) && value.schemaVersion === 1 && hasValidBoardStructure(value, isLegacyMusicPad)
}

function isScenario(value: unknown): value is Scenario {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isHexColor(value.color) &&
    Array.isArray(value.padIds) &&
    value.padIds.every(isNonEmptyString)
  )
}

function isMusicPad(value: unknown): value is MusicPad {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.label) &&
    isNonEmptyString(value.originalUrl) &&
    /^[A-Za-z0-9_-]{11}$/.test(String(value.videoId)) &&
    (value.startSeconds === undefined || isNonNegativeNumber(value.startSeconds)) &&
    isNonEmptyString(value.scenarioId) &&
    typeof value.starred === 'boolean'
  )
}

function isLegacyMusicPad(value: unknown): value is LegacyMusicPad {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.label) &&
    isNonEmptyString(value.originalUrl) &&
    /^[A-Za-z0-9_-]{11}$/.test(String(value.videoId)) &&
    (value.startSeconds === undefined || isNonNegativeNumber(value.startSeconds)) &&
    isNonEmptyString(value.scenarioId) &&
    value.starred === undefined
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

function isValidVolume(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}
