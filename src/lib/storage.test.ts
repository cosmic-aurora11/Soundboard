import { describe, expect, it, vi } from 'vitest'
import { createDefaultBoard } from './defaults'
import {
  isBoardState,
  LEGACY_STORAGE_KEY,
  loadBoard,
  parseImportedBoard,
  saveBoard,
  STORAGE_KEY,
} from './storage'

describe('board storage', () => {
  it('accepts the default board', () => {
    expect(isBoardState(createDefaultBoard())).toBe(true)
  })

  it('round-trips valid saved data', () => {
    const board = createDefaultBoard()
    const data = new Map<string, string>()
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    }

    expect(saveBoard(board, storage)).toBeNull()
    expect(data.has(STORAGE_KEY)).toBe(true)
    expect(loadBoard(storage)).toEqual({ board, warning: null })
  })

  it('rejects dangling and mismatched pads', () => {
    const board = createDefaultBoard()
    const invalid = {
      ...board,
      pads: {
        orphan: {
          id: 'orphan',
          label: 'Orphan',
          originalUrl: 'https://youtu.be/M7lc1UVf-VE',
          videoId: 'M7lc1UVf-VE',
          scenarioId: board.scenarios[0].id,
        },
      },
    }
    expect(isBoardState(invalid)).toBe(false)
  })

  it('does not mutate stored invalid data when loading a fallback', () => {
    const setItem = vi.fn()
    const result = loadBoard({ getItem: () => '{"broken":true}' })
    expect(result.warning).toMatch(/invalid/i)
    expect(result.board).toEqual(createDefaultBoard())
    expect(setItem).not.toHaveBeenCalled()
  })

  it('throws a useful error for invalid imports', () => {
    expect(() => parseImportedBoard('not-json')).toThrow(/not valid JSON/i)
    expect(() => parseImportedBoard('{}')).toThrow(/not a valid Resonance Board/i)
  })

  it('migrates version-1 browser data and backups without losing pads', () => {
    const current = createDefaultBoard()
    const legacy = {
      ...current,
      schemaVersion: 1,
      scenarios: current.scenarios.map((scenario, index) =>
        index === 0 ? { ...scenario, padIds: ['legacy-pad'] } : scenario,
      ),
      pads: {
        'legacy-pad': {
          id: 'legacy-pad',
          label: 'Legacy cue',
          originalUrl: 'https://youtu.be/M7lc1UVf-VE',
          videoId: 'M7lc1UVf-VE',
          scenarioId: current.scenarios[0].id,
        },
      },
    }
    const storage = {
      getItem: (key: string) => key === LEGACY_STORAGE_KEY ? JSON.stringify(legacy) : null,
    }

    const loaded = loadBoard(storage)
    expect(loaded.warning).toBeNull()
    expect(loaded.board.schemaVersion).toBe(2)
    expect(loaded.board.pads['legacy-pad']).toMatchObject({ label: 'Legacy cue', starred: false })
    expect(parseImportedBoard(JSON.stringify(legacy))).toEqual(loaded.board)
  })

  it('reports storage write failures', () => {
    const warning = saveBoard(createDefaultBoard(), {
      setItem: () => { throw new Error('quota') },
    })
    expect(warning).toMatch(/could not be saved/i)
  })
})
