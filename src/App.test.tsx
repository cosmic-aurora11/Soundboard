import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('board editing workflow', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('opens with the seven starter scenario banks', () => {
    render(<App />)
    for (const name of ['Combat', 'Village', 'Traveling', 'Eerie', 'Ethereal', 'Forest', 'Major Boss']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
  })

  it('assigns, edits, duplicates, reorders, and deletes a pad', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /edit board/i }))

    fireEvent.click(screen.getAllByRole('button', { name: /assign music/i })[0])
    fireEvent.change(screen.getByLabelText(/pad label/i), { target: { value: 'Knife to the Throat' } })
    fireEvent.change(screen.getByLabelText(/youtube video/i), {
      target: { value: 'https://youtu.be/M7lc1UVf-VE' },
    })
    fireEvent.click(screen.getByRole('button', { name: /assign pad/i }))

    const padButton = screen.getByRole('button', { name: /edit knife to the throat/i })
    expect(padButton).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /duplicate knife to the throat/i }))
    expect(screen.getByRole('button', { name: /edit knife to the throat copy/i })).toBeInTheDocument()

    fireEvent.click(padButton)
    fireEvent.change(screen.getByLabelText(/pad label/i), { target: { value: 'Boss Arrival' } })
    fireEvent.change(screen.getByRole('combobox', { name: /scenario/i }), { target: { value: 'scenario-major-boss' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    const bossColumn = screen.getByRole('heading', { name: 'Major Boss' }).closest('article')
    expect(bossColumn).not.toBeNull()
    expect(within(bossColumn!).getByRole('button', { name: /edit boss arrival/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /delete boss arrival/i }))
    expect(screen.queryByRole('button', { name: /edit boss arrival/i })).not.toBeInTheDocument()
  })

  it('adds, edits, reorders, and deletes a scenario', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /edit board/i }))
    fireEvent.click(screen.getByRole('button', { name: /add scenario/i }))
    fireEvent.change(screen.getByLabelText(/scenario name/i), { target: { value: 'Tavern' } })
    fireEvent.click(screen.getByRole('button', { name: /^add scenario$/i }))

    expect(screen.getByRole('heading', { name: 'Tavern' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /move tavern left/i }))
    fireEvent.click(screen.getByRole('button', { name: /edit tavern/i }))
    fireEvent.change(screen.getByLabelText(/scenario name/i), { target: { value: 'Royal Tavern' } })
    fireEvent.click(screen.getByRole('button', { name: /save scenario/i }))
    expect(screen.getByRole('heading', { name: 'Royal Tavern' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /delete royal tavern/i }))
    expect(screen.queryByRole('heading', { name: 'Royal Tavern' })).not.toBeInTheDocument()
  })

  it('returns the scenario rail to the left edge when a dragged column becomes first', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /edit board/i }))

    const rail = screen.getByLabelText('Music scenarios')
    const scrollTo = vi.fn()
    Object.defineProperty(rail, 'scrollTo', { configurable: true, value: scrollTo })
    const combatColumn = screen.getByRole('heading', { name: 'Combat' }).closest('article')!
    const travelingColumn = screen.getByRole('heading', { name: 'Traveling' }).closest('article')!
    const dataTransfer = { setData: vi.fn(), effectAllowed: 'none' }

    fireEvent.dragStart(travelingColumn, { dataTransfer })
    fireEvent.drop(combatColumn, { dataTransfer })

    expect(Array.from(rail.querySelectorAll('.scenario-column h3')).map((heading) => heading.textContent)[0]).toBe('Traveling')
    expect(scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'smooth' })
  })

  it('stars tracks, promotes the newest star, and keeps unstarred position', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /edit board/i }))
    assignPad('First cue')
    assignPad('Second cue')

    const combatColumn = screen.getByRole('heading', { name: 'Combat' }).closest('article')!
    fireEvent.click(screen.getByRole('button', { name: 'Star Second cue' }))
    expect(padLabels(combatColumn)).toEqual(['Second cue', 'First cue'])
    fireEvent.click(screen.getByRole('button', { name: 'Star First cue' }))
    expect(padLabels(combatColumn)).toEqual(['First cue', 'Second cue'])
    expect(screen.getByRole('button', { name: 'Unstar Second cue' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Unstar First cue' }))
    expect(padLabels(combatColumn)).toEqual(['First cue', 'Second cue'])

    fireEvent.click(screen.getByRole('button', { name: /duplicate second cue/i }))
    expect(screen.getByRole('button', { name: 'Star Second cue copy' })).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'Edit Second cue' }))
    fireEvent.change(screen.getByRole('combobox', { name: /scenario/i }), { target: { value: 'scenario-major-boss' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    const bossColumn = screen.getByRole('heading', { name: 'Major Boss' }).closest('article')!
    expect(within(bossColumn).getByRole('button', { name: 'Unstar Second cue' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: /finish editing/i }))
    expect(combatColumn.querySelectorAll('.pad-star-marker')).toHaveLength(0)
    expect(bossColumn.querySelectorAll('.pad-star-marker')).toHaveLength(1)
  })

  it('records the current session, exposes its drawer, then downloads and clears it', () => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:session-log'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /edit board/i }))
    assignPad('Knife to the Throat')
    fireEvent.click(screen.getByRole('button', { name: /finish editing/i }))

    fireEvent.click(screen.getByRole('button', { name: /start session/i }))
    fireEvent.click(screen.getByRole('button', { name: /play knife to the throat/i }))
    fireEvent.click(screen.getByRole('button', { name: /session log/i }))

    const drawer = screen.getByRole('dialog', { name: /current session/i })
    expect(within(drawer).getByText('Combat')).toBeInTheDocument()
    expect(within(drawer).getByText('Knife to the Throat')).toBeInTheDocument()
    expect(within(drawer).getByText(/1 selection/i)).toBeInTheDocument()

    fireEvent.click(within(drawer).getByRole('button', { name: /end session/i }))
    expect(anchorClick).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:session-log')
    expect(screen.getByRole('button', { name: /start session/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /current session/i })).not.toBeInTheDocument()
  })

  it('does not clear the active session when download creation fails', () => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => { throw new Error('download unavailable') }),
    })

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /start session/i }))
    fireEvent.click(screen.getByRole('button', { name: /session log/i }))
    fireEvent.click(screen.getByRole('button', { name: /end session/i }))

    expect(screen.getByRole('button', { name: /session log, 0 selections/i })).toBeInTheDocument()
    expect(screen.getByText(/active log was kept/i)).toBeInTheDocument()
  })
})

function assignPad(label: string) {
  fireEvent.click(screen.getAllByRole('button', { name: /assign music/i })[0])
  fireEvent.change(screen.getByLabelText(/pad label/i), { target: { value: label } })
  fireEvent.change(screen.getByLabelText(/youtube video/i), {
    target: { value: 'https://youtu.be/M7lc1UVf-VE' },
  })
  fireEvent.click(screen.getByRole('button', { name: /assign pad/i }))
}

function padLabels(column: HTMLElement): string[] {
  return Array.from(column.querySelectorAll('.music-pad strong')).map((element) => element.textContent ?? '')
}
