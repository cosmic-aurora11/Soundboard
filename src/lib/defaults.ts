import { SCHEMA_VERSION, type BoardState, type Scenario } from '../types'

const DEFAULT_SCENARIOS: Array<Pick<Scenario, 'id' | 'name' | 'color'>> = [
  { id: 'scenario-combat', name: 'Combat', color: '#ef624a' },
  { id: 'scenario-village', name: 'Village', color: '#e8b65f' },
  { id: 'scenario-traveling', name: 'Traveling', color: '#80b75a' },
  { id: 'scenario-eerie', name: 'Eerie', color: '#9c75d8' },
  { id: 'scenario-ethereal', name: 'Ethereal', color: '#71b9d6' },
  { id: 'scenario-forest', name: 'Forest', color: '#4ba37a' },
  { id: 'scenario-major-boss', name: 'Major Boss', color: '#d84d6c' },
]

export function createDefaultBoard(): BoardState {
  return {
    schemaVersion: SCHEMA_VERSION,
    scenarios: DEFAULT_SCENARIOS.map((scenario) => ({ ...scenario, padIds: [] })),
    pads: {},
    settings: { volume: 72 },
  }
}

export const SCENARIO_COLOR_OPTIONS = [
  '#ef624a',
  '#e8b65f',
  '#80b75a',
  '#9c75d8',
  '#71b9d6',
  '#4ba37a',
  '#d84d6c',
  '#d08a57',
]
