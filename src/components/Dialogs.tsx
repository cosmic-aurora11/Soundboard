import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { SCENARIO_COLOR_OPTIONS } from '../lib/defaults'
import { parseYouTubeUrl } from '../lib/youtube'
import type { MusicPad, Scenario } from '../types'
import { Icon } from './Icon'

interface PadDialogProps {
  scenarios: Scenario[]
  pad?: MusicPad
  initialScenarioId: string
  onClose: () => void
  onSave: (values: { label: string; url: string; videoId: string; scenarioId: string }) => void
}

export function PadDialog({ scenarios, pad, initialScenarioId, onClose, onSave }: PadDialogProps) {
  const [label, setLabel] = useState(pad?.label ?? '')
  const [url, setUrl] = useState(pad?.originalUrl ?? '')
  const [scenarioId, setScenarioId] = useState(pad?.scenarioId ?? initialScenarioId)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.querySelector<HTMLInputElement>('#pad-label')?.focus()
  }, [])

  const parsed = useMemo(() => parseYouTubeUrl(url), [url])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!label.trim()) {
      setError('Give this pad a short, recognizable name.')
      return
    }
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    onSave({ label: label.trim(), url: url.trim(), videoId: parsed.videoId, scenarioId })
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="pad-dialog-title">
        <header className="dialog-header">
          <div>
            <span className="eyebrow">Pad assignment</span>
            <h2 id="pad-dialog-title">{pad ? 'Edit music pad' : 'Assign a new pad'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog">
            <Icon name="x" />
          </button>
        </header>

        <form onSubmit={submit} className="dialog-form">
          <label>
            <span>Pad label</span>
            <input
              id="pad-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={64}
              placeholder="e.g. Knife to the Throat"
            />
          </label>

          <label>
            <span>YouTube video</span>
            <input
              value={url}
              onChange={(event) => {
                setUrl(event.target.value)
                setError(null)
              }}
              inputMode="url"
              placeholder="https://www.youtube.com/watch?v=…"
              aria-describedby="url-help"
            />
            <small id="url-help">
              Standard, shortened, embed, Live, and Shorts links are supported.
            </small>
          </label>

          <label>
            <span>Scenario</span>
            <select value={scenarioId} onChange={(event) => setScenarioId(event.target.value)}>
              {scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>{scenario.name}</option>
              ))}
            </select>
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}
          {!error && url && parsed.ok && (
            <p className="form-success"><Icon name="check" size={15} /> Video recognized</p>
          )}

          <footer className="dialog-actions">
            <button className="button secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button primary" type="submit">
              <Icon name="check" /> {pad ? 'Save changes' : 'Assign pad'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

interface ScenarioDialogProps {
  scenario?: Scenario
  suggestedColor: string
  onClose: () => void
  onSave: (values: { name: string; color: string }) => void
}

export function ScenarioDialog({ scenario, suggestedColor, onClose, onSave }: ScenarioDialogProps) {
  const [name, setName] = useState(scenario?.name ?? '')
  const [color, setColor] = useState(scenario?.color ?? suggestedColor)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.querySelector<HTMLInputElement>('#scenario-name')?.focus()
  }, [])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Give this scenario a name.')
      return
    }
    onSave({ name: name.trim(), color })
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-card dialog-card-small" role="dialog" aria-modal="true" aria-labelledby="scenario-dialog-title">
        <header className="dialog-header">
          <div>
            <span className="eyebrow">Scene bank</span>
            <h2 id="scenario-dialog-title">{scenario ? 'Edit scenario' : 'Add scenario'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog">
            <Icon name="x" />
          </button>
        </header>

        <form onSubmit={submit} className="dialog-form">
          <label>
            <span>Scenario name</span>
            <input
              id="scenario-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError(null)
              }}
              maxLength={32}
              placeholder="e.g. Tavern"
            />
          </label>

          <fieldset className="color-fieldset">
            <legend>Bank color</legend>
            <div className="color-options">
              {SCENARIO_COLOR_OPTIONS.map((option) => (
                <button
                  key={option}
                  className={`color-swatch ${color === option ? 'selected' : ''}`}
                  style={{ '--swatch': option } as React.CSSProperties}
                  type="button"
                  onClick={() => setColor(option)}
                  aria-label={`Choose color ${option}`}
                  aria-pressed={color === option}
                >
                  {color === option && <Icon name="check" size={16} />}
                </button>
              ))}
            </div>
          </fieldset>

          {error && <p className="form-error" role="alert">{error}</p>}

          <footer className="dialog-actions">
            <button className="button secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button primary" type="submit">
              <Icon name="check" /> {scenario ? 'Save scenario' : 'Add scenario'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
