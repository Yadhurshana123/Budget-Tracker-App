const KEY = 'homies_last_comment_seen_at'

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
