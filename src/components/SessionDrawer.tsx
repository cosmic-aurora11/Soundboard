import { useEffect, useRef } from 'react'
import { groupSessionEntries } from '../lib/session'
import type { ActiveSession } from '../types'
import { Icon } from './Icon'

interface SessionDrawerProps {
  session: ActiveSession
  onClose: () => void
  onEnd: () => void
}

export function SessionDrawer({ session, onClose, onEnd }: SessionDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const groups = groupSessionEntries(session.entries)
  const lastEntryId = session.entries.at(-1)?.id
  const startedAt = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(session.startedAt))

  useEffect(() => {
    closeRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="session-drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside
        id="session-history"
        className="session-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-drawer-title"
      >
        <header className="session-drawer-header">
          <div>
            <span className="eyebrow">Recording in progress</span>
            <h2 id="session-drawer-title">Current session</h2>
          </div>
          <button ref={closeRef} className="icon-button" type="button" onClick={onClose} aria-label="Close session log">
            <Icon name="x" />
          </button>
        </header>

        <div className="session-metadata">
          <span><i className="recording-dot" /> Live since {startedAt}</span>
          <span>{session.entries.length} {session.entries.length === 1 ? 'selection' : 'selections'}</span>
        </div>

        <div className="session-history-list" aria-live="polite">
          {groups.length === 0 ? (
            <div className="session-empty-state">
              <Icon name="history" size={29} />
              <strong>No selections yet</strong>
              <span>Every new track you choose will appear here.</span>
            </div>
          ) : (
            <ol className="session-groups">
              {groups.map((group, groupIndex) => (
                <li key={`${group.scenarioName}-${groupIndex}`} className="session-group">
                  <div className="session-group-heading">
                    <span>{String(groupIndex + 1).padStart(2, '0')}</span>
                    <h3>{group.scenarioName}</h3>
                  </div>
                  <ol>
                    {group.entries.map((entry) => (
                      <li key={entry.id} className={entry.id === lastEntryId ? 'latest' : ''}>
                        <span className="history-node" />
                        <span>{entry.padLabel}</span>
                        {entry.id === lastEntryId && <small>Latest</small>}
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ol>
          )}
        </div>

        <footer className="session-drawer-footer">
          <p>Ending downloads this history as Markdown, then clears it from the soundboard.</p>
          <button className="button end-session-button" type="button" onClick={onEnd}>
            <Icon name="stop" size={16} /> End session
          </button>
        </footer>
      </aside>
    </div>
  )
}
