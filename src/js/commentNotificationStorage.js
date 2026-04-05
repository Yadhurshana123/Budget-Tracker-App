const KEY = 'homies_last_comment_seen_at'
const BUDGET_KEY = 'homies_last_budget_seen_at'

export function getLastCommentSeenIso() {
  return localStorage.getItem(KEY)
}

/** Call on first app use so we don’t flood with old comments. */
export function initLastCommentSeenIfMissing() {
  if (!localStorage.getItem(KEY)) {
    localStorage.setItem(KEY, new Date().toISOString())
  }
}

export function markAllCommentsSeen() {
  localStorage.setItem(KEY, new Date().toISOString())
}

// ── Budget notification helpers ──────────────────────────────────────────────

export function getLastBudgetSeenIso() {
  return localStorage.getItem(BUDGET_KEY)
}

export function initLastBudgetSeenIfMissing() {
  if (!localStorage.getItem(BUDGET_KEY)) {
    localStorage.setItem(BUDGET_KEY, new Date().toISOString())
  }
}

export function markAllBudgetsSeen() {
  localStorage.setItem(BUDGET_KEY, new Date().toISOString())
}
