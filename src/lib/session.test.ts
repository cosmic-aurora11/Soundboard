import { describe, expect, it, vi } from 'vitest'
import type { ActiveSession, MusicPad, Scenario } from '../types'
import {
  ACTIVE_SESSION_STORAGE_KEY,
  appendSessionEntry,
  createActiveSession,
  createSessionDocument,
  groupSessionEntries,
  loadActiveSession,
  saveActiveSession,
} from './session'

const eerie: Scenario = { id: 'eerie', name: 'Eerie', color: '#9c75d8', padIds: [] }
const combat: Scenario = { id: 'combat', name: 'Combat', color: '#ef624a', padIds: [] }

function pad(id: string, label: string, scenarioId: string): MusicPad {
  return {
    id,
    label,
    originalUrl: 'https://youtu.be/M7lc1UVf-VE',
    videoId: 'M7lc1UVf-VE',
    scenarioId,
    starred: false,
  }
}

describe('active session logging', () => {
  it('records snapshots, suppresses consecutive duplicates, and groups category changes', () => {
    let session = createActiveSession(new Date('2026-07-21T19:02:00.000Z'))
    session = appendSessionEntry(session, pad('one', 'Fractured Echoes', eerie.id), eerie)
    const duplicate = appendSessionEntry(session, pad('one', 'Renamed later', eerie.id), eerie)
    expect(duplicate).toBe(session)

    session = appendSessionEntry(session, pad('two', 'Never Forget Our Promise', eerie.id), eerie)
    session = appendSessionEntry(session, pad('three', 'Knife to the Throat', combat.id), combat)
    session = appendSessionEntry(session, pad('four', 'City of Intrigues', eerie.id), eerie)

    expect(groupSessionEntries(session.entries).map((group) => ({
      category: group.scenarioName,
      songs: group.entries.map((entry) => entry.padLabel),
    }))).toEqual([
      { category: 'Eerie', songs: ['Fractured Echoes', 'Never Forget Our Promise'] },
      { category: 'Combat', songs: ['Knife to the Throat'] },
      { category: 'Eerie', songs: ['City of Intrigues'] },
    ])
  })

  it('formats the requested Markdown without song timestamps or links', () => {
    const session: ActiveSession = {
      schemaVersion: 1,
      id: 'session-one',
      startedAt: '2026-07-21T19:02:00.000Z',
      entries: [
        { id: '1', padId: 'one', scenarioName: 'Eerie', padLabel: 'Fractured Echoes', selectedAt: '2026-07-21T19:04:00.000Z' },
        { id: '2', padId: 'two', scenarioName: 'Eerie', padLabel: 'Never Forget Our Promise', selectedAt: '2026-07-21T19:08:00.000Z' },
        { id: '3', padId: 'three', scenarioName: 'Combat', padLabel: 'Knife to the Throat', selectedAt: '2026-07-21T20:00:00.000Z' },
        { id: '4', padId: 'four', scenarioName: 'Eerie', padLabel: 'City of Intrigues', selectedAt: '2026-07-21T20:30:00.000Z' },
      ],
    }

    const result = createSessionDocument(session, new Date('2026-07-21T22:41:00.000Z'), 'en-US', 'UTC')
    expect(result.markdown).toBe(`# Resonance Session — July 21, 2026

Started: 7:02 PM
Ended: 10:41 PM

## Eerie
- Fractured Echoes
- Never Forget Our Promise

## Combat
- Knife to the Throat

## Eerie
- City of Intrigues
`)
  })

  it('creates a local timestamp filename and a useful empty log', () => {
    const session = createActiveSession(new Date(2026, 6, 21, 19, 2))
    const result = createSessionDocument(session, new Date(2026, 6, 21, 22, 41))
    expect(result.filename).toBe('resonance-session-2026-07-21-2241.md')
    expect(result.markdown).toContain('_No tracks were selected._')
  })

  it('persists, restores, and clears only the active session', () => {
    const data = new Map<string, string>()
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    }
    const session = createActiveSession()
    expect(saveActiveSession(session, storage)).toBeNull()
    expect(loadActiveSession(storage)).toEqual({ session, warning: null })
    expect(saveActiveSession(null, storage)).toBeNull()
    expect(data.has(ACTIVE_SESSION_STORAGE_KEY)).toBe(false)
  })

  it('keeps invalid stored logs untouched and reports storage failures', () => {
    const removeItem = vi.fn()
    expect(loadActiveSession({ getItem: () => '{"broken":true}' })).toEqual({
      session: null,
      warning: expect.stringMatching(/could not be read/i),
    })
    expect(removeItem).not.toHaveBeenCalled()
    expect(saveActiveSession(createActiveSession(), {
      setItem: () => { throw new Error('quota') },
      removeItem,
    })).toMatch(/could not be saved/i)
  })
})
