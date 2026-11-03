import type { ExerciseRecipe, ExerciseSessionState, ScaffoldTier } from './types'
import type { PracticeMode } from '../analytics/types'

export interface ProeftoetsGroupResult {
  skillId: string
  correct: number
  total: number
  passed: boolean
  maatwerkNl?: string
}

export interface SessionResult {
  skillTitleNl: string
  correct: boolean
  skipped: boolean
  firstTimeSuccess: boolean
}

/** JSON only: validators are regenerated, then checked against the original
 * exercise signature before any saved answers or evidence can be resumed. */
export interface SavedPractice {
  mode: PracticeMode
  selectedTables: number[]
  lessonId: string | null
  proeftoetsId: string | null
  proeftoetsResults: ProeftoetsGroupResult[]
  itemPurposes: string[]
  itemsDone: number
  results: SessionResult[]
  recentSkills: string[]
  pendingSibling: { skillId: string; tier: ScaffoldTier; usageId: string } | null
  selectionExplanation: string
  exercise: {
    recipe: ExerciseRecipe
    signature: string
    session: Omit<ExerciseSessionState, 'exercise'>
  } | null
}
