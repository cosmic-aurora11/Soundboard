import { useCallback, useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import { PadDialog, ScenarioDialog } from './components/Dialogs'
import { Icon } from './components/Icon'
import { SessionDrawer } from './components/SessionDrawer'
import { YouTubePlayer, type YouTubePlayerHandle } from './components/YouTubePlayer'
import { SCENARIO_COLOR_OPTIONS } from './lib/defaults'
import {
  appendSessionEntry,
  createActiveSession,
  createSessionDocument,
  loadActiveSession,
  saveActiveSession,
} from './lib/session'
import { loadBoard, parseImportedBoard, saveBoard } from './lib/storage'
import type { ActiveSession, BoardState, MusicPad, PlaybackState, PlayerSnapshot, Scenario } from './types'

type PadDialogState = { padId?: string; scenarioId: string } | null
type ScenarioDialogState = { scenarioId?: string } | null

const initialLoad = loadBoard()
const initialSessionLoad = loadActiveSession()

function App() {
  const [board, setBoard] = useState<BoardState>(initialLoad.board)
  const [editMode, setEditMode] = useState(false)
  const [padDialog, setPadDialog] = useState<PadDialogState>(null)
  const [scenarioDialog, setScenarioDialog] = useState<ScenarioDialogState>(null)
  const [notice, setNotice] = useState<string | null>(initialLoad.warning ?? initialSessionLoad.warning)
  const [storageWarning, setStorageWarning] = useState<string | null>(null)
  const [sessionStorageWarning, setSessionStorageWarning] = useState<string | null>(null)
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(initialSessionLoad.session)
  const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false)
  const [draggedPadId, setDraggedPadId] = useState<string | null>(null)
  const [draggedScenarioId, setDraggedScenarioId] = useState<string | null>(null)
  const [playback, setPlayback] = useState<PlaybackState>({
    activePadId: null,
    pendingPadId: null,
    status: 'loading',
    savedVolume: initialLoad.board.settings.volume,
    currentError: null,
  })
  const playerRef = useRef<YouTubePlayerHandle>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const scenarioRailRef = useRef<HTMLDivElement>(null)
  const skipFirstSave = useRef(Boolean(initialLoad.warning))
  const skipFirstSessionSave = useRef(Boolean(initialSessionLoad.warning))

  useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false
      return
    }
    setStorageWarning(saveBoard(board))
  }, [board])

  useEffect(() => {
    if (skipFirstSessionSave.current) {
      skipFirstSessionSave.current = false
      return
    }
    setSessionStorageWarning(saveActiveSession(activeSession))
  }, [activeSession])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const activePad = playback.activePadId ? board.pads[playback.activePadId] : undefined
  const pendingPad = playback.pendingPadId ? board.pads[playback.pendingPadId] : undefined
  const displayedPad = pendingPad ?? activePad

  const handleSnapshot = useCallback((snapshot: PlayerSnapshot) => {
    setPlayback((current) => ({ ...current, ...snapshot }))
  }, [])

  function updateVolume(volume: number) {
    playerRef.current?.setMasterVolume(volume)
    setPlayback((current) => ({ ...current, savedVolume: volume }))
    setBoard((current) => ({ ...current, settings: { ...current.settings, volume } }))
  }

  function selectPad(pad: MusicPad) {
    if (editMode) {
      setPadDialog({ padId: pad.id, scenarioId: pad.scenarioId })
      return
    }
    if (activeSession && playback.activePadId !== pad.id && playback.pendingPadId !== pad.id) {
      const scenario = board.scenarios.find((item) => item.id === pad.scenarioId)
      if (scenario) {
        setActiveSession((current) => current ? appendSessionEntry(current, pad, scenario) : current)
      }
    }
    playerRef.current?.selectPad(pad)
  }

  function savePad(values: { label: string; url: string; videoId: string; startSeconds: number; scenarioId: string }) {
    setBoard((current) => {
      if (padDialog?.padId) {
        const existing = current.pads[padDialog.padId]
        if (!existing) return current
        const changedScenario = existing.scenarioId !== values.scenarioId
        const scenarios = changedScenario
          ? current.scenarios.map((scenario) => {
              if (scenario.id === existing.scenarioId) {
                return { ...scenario, padIds: scenario.padIds.filter((id) => id !== existing.id) }
              }
              if (scenario.id === values.scenarioId) {
                return { ...scenario, padIds: [...scenario.padIds, existing.id] }
              }
              return scenario
            })
          : current.scenarios
        return {
          ...current,
          scenarios,
          pads: {
            ...current.pads,
            [existing.id]: {
              ...existing,
              label: values.label,
              originalUrl: values.url,
              videoId: values.videoId,
              startSeconds: values.startSeconds,
              scenarioId: values.scenarioId,
            },
          },
        }
      }

      const id = makeId('pad')
      const pad: MusicPad = {
        id,
        label: values.label,
        originalUrl: values.url,
        videoId: values.videoId,
        startSeconds: values.startSeconds,
        scenarioId: values.scenarioId,
        starred: false,
      }
      return {
        ...current,
        scenarios: current.scenarios.map((scenario) =>
          scenario.id === values.scenarioId
            ? { ...scenario, padIds: [...scenario.padIds, id] }
            : scenario,
        ),
        pads: { ...current.pads, [id]: pad },
      }
    })
    setPadDialog(null)
    setNotice(padDialog?.padId ? 'Pad updated.' : 'Music pad assigned.')
  }

  function deletePad(pad: MusicPad) {
    if (!window.confirm(`Delete “${pad.label}”? This cannot be undone.`)) return
    if (playback.activePadId === pad.id || playback.pendingPadId === pad.id) {
      playerRef.current?.fadeStop()
    }
    setBoard((current) => {
      const pads = { ...current.pads }
      delete pads[pad.id]
      return {
        ...current,
        pads,
        scenarios: current.scenarios.map((scenario) =>
          scenario.id === pad.scenarioId
            ? { ...scenario, padIds: scenario.padIds.filter((id) => id !== pad.id) }
            : scenario,
        ),
      }
    })
    setNotice('Pad deleted.')
  }

  function duplicatePad(pad: MusicPad) {
    setBoard((current) => {
      const id = makeId('pad')
      const duplicate: MusicPad = { ...pad, id, label: `${pad.label} copy`, starred: false }
      return {
        ...current,
        pads: { ...current.pads, [id]: duplicate },
        scenarios: current.scenarios.map((scenario) => {
          if (scenario.id !== pad.scenarioId) return scenario
          const index = scenario.padIds.indexOf(pad.id)
          const padIds = [...scenario.padIds]
          padIds.splice(index + 1, 0, id)
          return { ...scenario, padIds }
        }),
      }
    })
    setNotice('Pad duplicated.')
  }

  function toggleStar(pad: MusicPad) {
    const willStar = !pad.starred
    setBoard((current) => ({
      ...current,
      pads: {
        ...current.pads,
        [pad.id]: { ...current.pads[pad.id], starred: willStar },
      },
      scenarios: current.scenarios.map((scenario) => {
        if (scenario.id !== pad.scenarioId || !willStar) return scenario
        return { ...scenario, padIds: [pad.id, ...scenario.padIds.filter((id) => id !== pad.id)] }
      }),
    }))
    setNotice(willStar ? 'Track starred and moved to the top.' : 'Star removed. Track position was kept.')
  }

  function movePadWithinScenario(pad: MusicPad, direction: -1 | 1) {
    setBoard((current) => ({
      ...current,
      scenarios: current.scenarios.map((scenario) => {
        if (scenario.id !== pad.scenarioId) return scenario
        const index = scenario.padIds.indexOf(pad.id)
        const nextIndex = index + direction
        if (index < 0 || nextIndex < 0 || nextIndex >= scenario.padIds.length) return scenario
        const padIds = [...scenario.padIds]
        ;[padIds[index], padIds[nextIndex]] = [padIds[nextIndex], padIds[index]]
        return { ...scenario, padIds }
      }),
    }))
  }

  function movePadTo(padId: string, scenarioId: string, targetIndex: number) {
    setBoard((current) => {
      const pad = current.pads[padId]
      if (!pad) return current
      const scenarios = current.scenarios.map((scenario) => ({
        ...scenario,
        padIds: scenario.padIds.filter((id) => id !== padId),
      }))
      const destination = scenarios.find((scenario) => scenario.id === scenarioId)
      if (!destination) return current
      const boundedIndex = Math.max(0, Math.min(targetIndex, destination.padIds.length))
      destination.padIds.splice(boundedIndex, 0, padId)
      return {
        ...current,
        scenarios,
        pads: { ...current.pads, [padId]: { ...pad, scenarioId } },
      }
    })
  }

  function saveScenario(values: { name: string; color: string }) {
    setBoard((current) => {
      if (scenarioDialog?.scenarioId) {
        return {
          ...current,
          scenarios: current.scenarios.map((scenario) =>
            scenario.id === scenarioDialog.scenarioId ? { ...scenario, ...values } : scenario,
          ),
        }
      }
      const scenario: Scenario = { id: makeId('scenario'), ...values, padIds: [] }
      return { ...current, scenarios: [...current.scenarios, scenario] }
    })
    setScenarioDialog(null)
    setNotice(scenarioDialog?.scenarioId ? 'Scenario updated.' : 'Scenario added.')
  }

  function deleteScenario(scenario: Scenario) {
    const detail = scenario.padIds.length
      ? ` It also contains ${scenario.padIds.length} music ${scenario.padIds.length === 1 ? 'pad' : 'pads'}.`
      : ''
    if (!window.confirm(`Delete “${scenario.name}”?${detail} This cannot be undone.`)) return
    if (scenario.padIds.some((id) => id === playback.activePadId || id === playback.pendingPadId)) {
      playerRef.current?.fadeStop()
    }
    setBoard((current) => {
      const pads = { ...current.pads }
      scenario.padIds.forEach((id) => delete pads[id])
      return {
        ...current,
        scenarios: current.scenarios.filter((item) => item.id !== scenario.id),
        pads,
      }
    })
    setNotice('Scenario deleted.')
  }

  function moveScenario(scenarioId: string, direction: -1 | 1) {
    const index = board.scenarios.findIndex((scenario) => scenario.id === scenarioId)
    const destinationIndex = index + direction
    if (index < 0 || destinationIndex < 0 || destinationIndex >= board.scenarios.length) return
    setBoard((current) => {
      const currentIndex = current.scenarios.findIndex((scenario) => scenario.id === scenarioId)
      const nextIndex = currentIndex + direction
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.scenarios.length) return current
      const scenarios = [...current.scenarios]
      ;[scenarios[currentIndex], scenarios[nextIndex]] = [scenarios[nextIndex], scenarios[currentIndex]]
      return { ...current, scenarios }
    })
    revealMovedScenario(scenarioId, destinationIndex)
  }

  function moveScenarioTo(scenarioId: string, targetIndex: number) {
    const fromIndex = board.scenarios.findIndex((scenario) => scenario.id === scenarioId)
    const destinationIndex = Math.max(0, Math.min(targetIndex, board.scenarios.length - 1))
    if (fromIndex < 0 || fromIndex === destinationIndex) return
    setBoard((current) => {
      const currentIndex = current.scenarios.findIndex((scenario) => scenario.id === scenarioId)
      if (currentIndex < 0 || currentIndex === destinationIndex) return current
      const scenarios = [...current.scenarios]
      const [moved] = scenarios.splice(currentIndex, 1)
      scenarios.splice(destinationIndex, 0, moved)
      return { ...current, scenarios }
    })
    revealMovedScenario(scenarioId, destinationIndex)
  }

  function revealMovedScenario(scenarioId: string, destinationIndex: number) {
    window.requestAnimationFrame(() => {
      const rail = scenarioRailRef.current
      if (!rail) return
      if (destinationIndex === 0) {
        rail.scrollTo({ left: 0, behavior: 'smooth' })
        return
      }

      const movedScenario = Array.from(rail.querySelectorAll<HTMLElement>('[data-scenario-id]'))
        .find((element) => element.dataset.scenarioId === scenarioId)
      if (!movedScenario) return
      const railRect = rail.getBoundingClientRect()
      const scenarioRect = movedScenario.getBoundingClientRect()
      rail.scrollTo({
        left: Math.max(0, rail.scrollLeft + scenarioRect.left - railRect.left),
        behavior: 'smooth',
      })
    })
  }

  function exportBoard() {
    const blob = new Blob([JSON.stringify(board, null, 2)], { type: 'application/json' })
    const href = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = `resonance-board-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(href)
    setNotice('Backup exported.')
  }

  async function importBoard(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const imported = parseImportedBoard(await file.text())
      if (!window.confirm('Replace the current board with this backup? Your current board will be overwritten.')) return
      playerRef.current?.fadeStop()
      setBoard(imported)
      setPlayback((current) => ({
        ...current,
        activePadId: null,
        pendingPadId: null,
        savedVolume: imported.settings.volume,
        currentError: null,
      }))
      playerRef.current?.setMasterVolume(imported.settings.volume)
      setNotice('Backup restored.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The backup could not be imported.')
    }
  }

  function openCurrentOnYouTube() {
    if (!displayedPad) return
    window.open(displayedPad.originalUrl, '_blank', 'noopener,noreferrer')
  }

  function startSession() {
    if (!window.confirm('Start a new session recording? New track selections will be logged until you end it.')) return
    setActiveSession(createActiveSession())
    setSessionDrawerOpen(false)
    setNotice('Session recording started.')
  }

  function endSession() {
    if (!activeSession) return
    if (!window.confirm('End this session? Its Markdown log will download, then the in-app history will be cleared.')) return
    try {
      const document = createSessionDocument(activeSession)
      downloadTextFile(document.filename, document.markdown)
      setActiveSession(null)
      setSessionDrawerOpen(false)
      setNotice('Session downloaded and cleared.')
    } catch {
      setNotice('The session download could not be created. Your active log was kept.')
    }
  }

  const suggestedColor = SCENARIO_COLOR_OPTIONS[board.scenarios.length % SCENARIO_COLOR_OPTIONS.length]
  const statusLabel = playbackStatusLabel(playback.status, Boolean(displayedPad))

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Resonance Board home">
          <span className="brand-mark"><Icon name="music" size={21} /></span>
          <span>
            <strong>Resonance</strong>
            <small>Game Master Soundboard</small>
          </span>
        </a>

        <div className="topbar-actions">
          {activeSession ? (
            <button
              className="button session-button active"
              type="button"
              onClick={() => setSessionDrawerOpen(true)}
              aria-expanded={sessionDrawerOpen}
              aria-controls="session-history"
              aria-label={`Session log, ${activeSession.entries.length} ${activeSession.entries.length === 1 ? 'selection' : 'selections'}`}
            >
              <span className="recording-dot" />
              <span>Session log</span>
              <strong>{activeSession.entries.length}</strong>
            </button>
          ) : (
            <button className="button session-button" type="button" onClick={startSession}>
              <Icon name="record" size={12} /> <span>Start session</span>
            </button>
          )}
          <button className="button utility" type="button" onClick={exportBoard}>
            <Icon name="download" /> <span>Export</span>
          </button>
          <button className="button utility" type="button" onClick={() => importRef.current?.click()}>
            <Icon name="upload" /> <span>Import</span>
          </button>
          <input ref={importRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importBoard} />
          <button
            className={`button mode-toggle ${editMode ? 'active' : ''}`}
            type="button"
            onClick={() => setEditMode((value) => !value)}
            aria-pressed={editMode}
          >
            <Icon name={editMode ? 'check' : 'edit'} />
            {editMode ? 'Finish editing' : 'Edit board'}
          </button>
        </div>
      </header>

      <main id="top">
        <section className="control-deck" aria-labelledby="now-playing-title">
          <div className="player-bay">
            <div className="hardware-label"><span>YT–01</span><span>Visible source player</span></div>
            <YouTubePlayer ref={playerRef} volume={board.settings.volume} fadeSeconds={board.settings.fadeSeconds ?? 0.8} onSnapshot={handleSnapshot} />
          </div>

          <div className="now-playing-panel">
            <div className="signal-row">
              <span className={`status-lamp status-${playback.status}`} />
              <span>{statusLabel}</span>
              <span className="signal-line" />
              <span>CH 01</span>
            </div>

            <div className="track-readout">
              <span className="eyebrow" id="now-playing-title">Now playing</span>
              <h1>{displayedPad?.label ?? 'Choose a scene cue'}</h1>
              <p>
                {displayedPad
                  ? board.scenarios.find((scenario) => scenario.id === displayedPad.scenarioId)?.name
                  : 'Your assigned music pads will appear below.'}
              </p>
            </div>

            {playback.currentError && (
              <div className="player-error" role="alert">
                <strong>Playback interrupted</strong>
                <span>{playback.currentError}</span>
              </div>
            )}

            <div className="transport-row" aria-label="Playback controls">
              <button
                className="transport-button"
                type="button"
                onClick={() => playerRef.current?.togglePlayback()}
                disabled={!activePad}
                aria-label={playback.status === 'playing' ? 'Pause' : 'Play'}
              >
                <Icon name={playback.status === 'playing' ? 'pause' : 'play'} size={22} />
              </button>
              <button
                className="transport-button"
                type="button"
                onClick={() => playerRef.current?.fadeStop()}
                disabled={!activePad && !pendingPad}
                aria-label="Fade out and stop"
              >
                <Icon name="stop" size={20} />
              </button>
              <button
                className="transport-button"
                type="button"
                onClick={openCurrentOnYouTube}
                disabled={!displayedPad}
                aria-label="Open current video on YouTube"
              >
                <Icon name="external" size={20} />
              </button>

              <label className="volume-control">
                <Icon name="volume" size={20} />
                <span className="visually-hidden">Master volume</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={board.settings.volume}
                  onChange={(event) => updateVolume(Number(event.target.value))}
                />
                <output>{board.settings.volume}</output>
              </label>
            </div>

            <div className="deck-footer">
              <label className="fade-control" title="Duration of each fade out and fade in. Set to 0 for an instant transition.">
                <span>Fade time (seconds)</span>
                <input type="number" min="0" step="0.1" aria-label="Fade time (seconds)"
                  value={board.settings.fadeSeconds ?? 0.8}
                  onChange={(event) => {
                    const fadeSeconds = Number(event.target.value)
                    if (Number.isFinite(fadeSeconds) && fadeSeconds >= 0) {
                      setBoard((current) => ({ ...current, settings: { ...current.settings, fadeSeconds } }))
                    }
                  }} />
                <span>per fade · 0 = off</span>
              </label>
              <span>Local memory armed</span>
            </div>
          </div>
        </section>

        <section className="board-section" aria-labelledby="scene-banks-heading">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Scene banks</span>
              <h2 id="scene-banks-heading">Set the atmosphere</h2>
            </div>
            <p>{editMode ? 'Select a pad to edit it. Drag pads or use the arrow controls to reorder.' : 'One press fades the current track and brings in your next cue.'}</p>
          </div>

          {board.scenarios.length === 0 ? (
            <div className="empty-board">
              <Icon name="music" size={32} />
              <h3>No scenarios yet</h3>
              <p>Enter Edit Mode and add your first scene bank.</p>
              {!editMode && <button className="button primary" type="button" onClick={() => setEditMode(true)}>Edit board</button>}
            </div>
          ) : (
            <div ref={scenarioRailRef} className="scenario-rail" aria-label="Music scenarios">
              {board.scenarios.map((scenario, scenarioIndex) => (
                <article
                  className="scenario-column"
                  key={scenario.id}
                  data-scenario-id={scenario.id}
                  style={{ '--scenario': scenario.color, '--scenario-rgb': hexToRgb(scenario.color) } as CSSProperties}
                  draggable={editMode}
                  onDragStart={(event) => {
                    if (!editMode || (event.target as HTMLElement).closest('.music-pad')) return
                    event.dataTransfer.setData('text/scenario-id', scenario.id)
                    event.dataTransfer.effectAllowed = 'move'
                    setDraggedScenarioId(scenario.id)
                  }}
                  onDragOver={(event) => {
                    if (draggedScenarioId) event.preventDefault()
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (!draggedScenarioId || draggedScenarioId === scenario.id) return
                    moveScenarioTo(draggedScenarioId, scenarioIndex)
                    setDraggedScenarioId(null)
                  }}
                  onDragEnd={() => setDraggedScenarioId(null)}
                >
                  <header className="scenario-header">
                    <div className="scenario-index">{String(scenarioIndex + 1).padStart(2, '0')}</div>
                    <div className="scenario-title">
                      <span className="scenario-color-dot" />
                      <h3>{scenario.name}</h3>
                      <small>{scenario.padIds.length} {scenario.padIds.length === 1 ? 'cue' : 'cues'}</small>
                    </div>
                    {editMode && (
                      <div className="scenario-tools">
                        <button className="mini-button" type="button" onClick={() => moveScenario(scenario.id, -1)} disabled={scenarioIndex === 0} aria-label={`Move ${scenario.name} left`}><Icon name="chevron-left" size={15} /></button>
                        <button className="mini-button" type="button" onClick={() => moveScenario(scenario.id, 1)} disabled={scenarioIndex === board.scenarios.length - 1} aria-label={`Move ${scenario.name} right`}><Icon name="chevron-right" size={15} /></button>
                        <button className="mini-button" type="button" onClick={() => setScenarioDialog({ scenarioId: scenario.id })} aria-label={`Edit ${scenario.name}`}><Icon name="settings" size={15} /></button>
                        <button className="mini-button danger" type="button" onClick={() => deleteScenario(scenario)} aria-label={`Delete ${scenario.name}`}><Icon name="trash" size={15} /></button>
                      </div>
                    )}
                  </header>

                  <div
                    className="pad-stack"
                    onDragOver={(event) => {
                      if (draggedPadId) event.preventDefault()
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      if (draggedPadId) movePadTo(draggedPadId, scenario.id, scenario.padIds.length)
                      setDraggedPadId(null)
                    }}
                  >
                    {scenario.padIds.map((padId, padIndex) => {
                      const pad = board.pads[padId]
                      if (!pad) return null
                      const isActive = playback.activePadId === pad.id
                      const isPending = playback.pendingPadId === pad.id
                      return (
                        <div
                          key={pad.id}
                          className={`pad-wrap ${isActive ? 'active' : ''} ${isPending ? 'pending' : ''}`}
                          draggable={editMode}
                          onDragStart={(event) => {
                            event.stopPropagation()
                            event.dataTransfer.setData('text/pad-id', pad.id)
                            event.dataTransfer.effectAllowed = 'move'
                            setDraggedPadId(pad.id)
                          }}
                          onDragOver={(event) => {
                            if (draggedPadId) {
                              event.preventDefault()
                              event.stopPropagation()
                            }
                          }}
                          onDrop={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            if (draggedPadId && draggedPadId !== pad.id) movePadTo(draggedPadId, scenario.id, padIndex)
                            setDraggedPadId(null)
                          }}
                          onDragEnd={() => setDraggedPadId(null)}
                        >
                          <button
                            className="music-pad"
                            type="button"
                            onClick={() => selectPad(pad)}
                            aria-pressed={isActive}
                            aria-label={`${editMode ? 'Edit' : 'Play'} ${pad.label}`}
                          >
                            <span className="pad-led" />
                            <span className="pad-number">{String(padIndex + 1).padStart(2, '0')}</span>
                            <strong>{pad.label}</strong>
                            <span className="pad-source">YT / {pad.videoId.slice(0, 5).toUpperCase()}</span>
                            <span className="pad-cue-flags" aria-hidden="true">
                              {pad.starred && <Icon className="pad-star-marker" name="star" size={13} fill="currentColor" />}
                              <span className="pad-grooves"><i /><i /><i /><i /><i /></span>
                            </span>
                            {isPending && <span className="pad-state">Loading</span>}
                            {isActive && !isPending && <span className="pad-state">{playback.status === 'paused' ? 'Paused' : 'Live'}</span>}
                          </button>
                          {editMode && (
                            <div className="pad-tools">
                              <span className="drag-handle" title="Drag to move"><Icon name="grip" size={15} /></span>
                              <button type="button" onClick={() => movePadWithinScenario(pad, -1)} disabled={padIndex === 0} aria-label={`Move ${pad.label} up`}><Icon name="chevron-up" size={14} /></button>
                              <button type="button" onClick={() => movePadWithinScenario(pad, 1)} disabled={padIndex === scenario.padIds.length - 1} aria-label={`Move ${pad.label} down`}><Icon name="chevron-down" size={14} /></button>
                              <button className={`star-toggle ${pad.starred ? 'active' : ''}`} type="button" onClick={() => toggleStar(pad)} aria-label={`${pad.starred ? 'Unstar' : 'Star'} ${pad.label}`} aria-pressed={pad.starred}><Icon name="star" size={14} fill={pad.starred ? 'currentColor' : 'none'} /></button>
                              <button type="button" onClick={() => duplicatePad(pad)} aria-label={`Duplicate ${pad.label}`}><Icon name="copy" size={14} /></button>
                              <button className="danger" type="button" onClick={() => deletePad(pad)} aria-label={`Delete ${pad.label}`}><Icon name="trash" size={14} /></button>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {editMode ? (
                      <button className="add-pad-button" type="button" onClick={() => setPadDialog({ scenarioId: scenario.id })}>
                        <Icon name="plus" size={19} />
                        <span>Assign music</span>
                      </button>
                    ) : scenario.padIds.length === 0 ? (
                      <div className="empty-scenario"><span>Unassigned bank</span><small>Enter Edit Mode to add a cue</small></div>
                    ) : null}
                  </div>
                </article>
              ))}

              {editMode && (
                <button className="add-scenario-card" type="button" onClick={() => setScenarioDialog({})}>
                  <Icon name="plus" size={25} />
                  <strong>Add scenario</strong>
                  <span>Create another scene bank</span>
                </button>
              )}
            </div>
          )}
        </section>
      </main>

      <footer className="app-footer">
        <span>Resonance Board / Local-first session audio</span>
        <span>Assignments stay in this browser</span>
      </footer>

      {(storageWarning || sessionStorageWarning || notice) && (
        <div className={`toast ${storageWarning || sessionStorageWarning ? 'toast-error' : ''}`} role="status">
          {storageWarning ?? sessionStorageWarning ?? notice}
        </div>
      )}

      {activeSession && sessionDrawerOpen && (
        <SessionDrawer session={activeSession} onClose={() => setSessionDrawerOpen(false)} onEnd={endSession} />
      )}

      {padDialog && board.scenarios.length > 0 && (
        <PadDialog
          scenarios={board.scenarios}
          pad={padDialog.padId ? board.pads[padDialog.padId] : undefined}
          initialScenarioId={padDialog.scenarioId}
          onClose={() => setPadDialog(null)}
          onSave={savePad}
        />
      )}

      {scenarioDialog && (
        <ScenarioDialog
          scenario={scenarioDialog.scenarioId ? board.scenarios.find((scenario) => scenario.id === scenarioDialog.scenarioId) : undefined}
          suggestedColor={suggestedColor}
          onClose={() => setScenarioDialog(null)}
          onSave={saveScenario}
        />
      )}
    </div>
  )
}

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function playbackStatusLabel(status: PlaybackState['status'], hasSelection: boolean): string {
  if (!hasSelection && status === 'ready') return 'Player ready'
  switch (status) {
    case 'loading': return 'Loading player'
    case 'buffering': return 'Buffering cue'
    case 'playing': return 'Signal live'
    case 'paused': return 'Signal paused'
    case 'stopped': return 'Signal stopped'
    case 'error': return 'Signal error'
    default: return 'Player ready'
  }
}

function hexToRgb(hex: string): string {
  const value = hex.replace('#', '')
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  return `${red}, ${green}, ${blue}`
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = filename
    anchor.click()
  } finally {
    URL.revokeObjectURL(href)
  }
}

export default App
