import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../js/supabaseClient'
import {
  getLastCommentSeenIso,
  initLastCommentSeenIfMissing,
  markAllCommentsSeen,
  getLastBudgetSeenIso,
  initLastBudgetSeenIfMissing,
  markAllBudgetsSeen,
} from '../js/commentNotificationStorage'
import styles from './CommentBell.module.css'

function showDesktopNotification(title, body, tag) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, tag })
  } catch {
    /* ignore */
  }
}

function fmtAmount(amount) {
  if (!amount) return ''
  return ` — Rs. ${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

export default function CommentBell() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('homies_user') || '{}')
  const myId = user?.id

  const [open, setOpen] = useState(false)
  const [commentItems, setCommentItems] = useState([])
  const [budgetItems, setBudgetItems] = useState([])
  const channelRef = useRef(null)
  const commentItemsRef = useRef([])

  useEffect(() => {
    commentItemsRef.current = commentItems
  }, [commentItems])

  // ── Merge helpers (deduplicate by id, sort newest-first) ────────────────────
  const mergeCommentById = useCallback((incoming) => {
    setCommentItems((prev) => {
      const map = new Map()
      ;[...incoming, ...prev].forEach((r) => { if (r?.id) map.set(r.id, r) })
      return Array.from(map.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    })
  }, [])

  const mergeBudgetById = useCallback((incoming) => {
    setBudgetItems((prev) => {
      const map = new Map()
      ;[...incoming, ...prev].forEach((r) => { if (r?.id) map.set(r.id, r) })
      return Array.from(map.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    })
  }, [])

  // ── Fetch missed + subscribe realtime ───────────────────────────────────────
  useEffect(() => {
    if (!myId) return
    initLastCommentSeenIfMissing()
    initLastBudgetSeenIfMissing()

    let cancelled = false

    // Fetch comments posted since last-read
    async function fetchMissedComments() {
      const lastSeen = getLastCommentSeenIso()
      if (!lastSeen) return

      const { data: exps } = await supabase.from('expenses').select('id').eq('is_confirmed', true)
      const confirmedIds = new Set((exps || []).map((e) => e.id))
      if (confirmedIds.size === 0) return

      const { data: rows } = await supabase
        .from('comments')
        .select('id, message, created_at, expense_id, user_id')
        .neq('user_id', myId)
        .gt('created_at', lastSeen)
        .order('created_at', { ascending: false })
        .limit(80)

      if (cancelled || !rows?.length) return

      const filtered = rows.filter((c) => confirmedIds.has(c.expense_id))
      if (filtered.length === 0) return

      const { data: usersData } = await supabase.from('users').select('id, username')
      const names = usersData ? Object.fromEntries(usersData.map((u) => [u.id, u.username])) : {}
      mergeCommentById(
        filtered.map((r) => ({ ...r, _type: 'comment', users: { username: names[r.user_id] || 'Homie' } }))
      )
    }

    // Fetch budget actions since last-read
    async function fetchMissedBudgets() {
      const lastSeen = getLastBudgetSeenIso()
      if (!lastSeen) return

      const { data: rows } = await supabase
        .from('budget_notifications')
        .select('id, actor_user_id, expense_id, action, expense_date, total_amount, created_at')
        .neq('actor_user_id', myId)
        .gt('created_at', lastSeen)
        .order('created_at', { ascending: false })
        .limit(50)

      if (cancelled || !rows?.length) return

      const { data: usersData } = await supabase.from('users').select('id, username')
      const names = usersData ? Object.fromEntries(usersData.map((u) => [u.id, u.username])) : {}
      mergeBudgetById(
        rows.map((r) => ({ ...r, _type: 'budget', actor_username: names[r.actor_user_id] || 'Homie' }))
      )
    }

    fetchMissedComments()
    fetchMissedBudgets()

    // ── Realtime subscriptions ─────────────────────────────────────────────────
    channelRef.current = supabase
      .channel(`notif-bell-${myId}`)
      // New comment
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments' },
        async ({ new: row }) => {
          if (!row || row.user_id === myId) return
          const { data: exp } = await supabase
            .from('expenses')
            .select('is_confirmed')
            .eq('id', row.expense_id)
            .single()
          if (!exp?.is_confirmed) return

          let uname = commentItemsRef.current.find((i) => i.user_id === row.user_id)?.users?.username
          if (!uname) {
            const { data: u } = await supabase.from('users').select('username').eq('id', row.user_id).single()
            uname = u?.username || 'Homie'
          }

          const enriched = { ...row, _type: 'comment', users: { username: uname } }
          mergeCommentById([enriched])
          showDesktopNotification(
            `${uname} commented`,
            (row.message || '').slice(0, 120) || 'New comment on a budget',
            `comment-${row.id}`,
          )
        },
      )
      // New budget action (add / edit / delete)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'budget_notifications' },
        async ({ new: row }) => {
          if (!row || row.actor_user_id === myId) return
          const { data: u } = await supabase.from('users').select('username').eq('id', row.actor_user_id).single()
          const uname = u?.username || 'Homie'

          const enriched = { ...row, _type: 'budget', actor_username: uname }
          mergeBudgetById([enriched])

          const actionLabel = row.action === 'added' ? 'added' : row.action === 'edited' ? 'edited' : 'deleted'
          showDesktopNotification(
            `${uname} ${actionLabel} a budget`,
            `${row.expense_date ? fmtDate(row.expense_date) : ''}${fmtAmount(row.total_amount)}`,
            `budget-${row.id}`,
          )
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [myId, mergeCommentById, mergeBudgetById])

  if (!myId) return null

  // Merge + sort all notifications newest-first
  const allItems = [
    ...commentItems.map((i) => ({ ...i, _type: 'comment' })),
    ...budgetItems.map((i) => ({ ...i, _type: 'budget' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const totalCount = allItems.length

  function handleMarkAllRead() {
    markAllCommentsSeen()
    markAllBudgetsSeen()
    setCommentItems([])
    setBudgetItems([])
    setOpen(false)
  }

  async function requestDesktopAlerts() {
    if (typeof Notification === 'undefined') return
    try {
      await Notification.requestPermission()
    } catch {
      /* ignore */
    }
  }

  function handleItemClick(it) {
    setOpen(false)
    if (it._type === 'budget') {
      // Deleted budgets have no expense_id — just go to others page
      navigate('/others', it.expense_id ? { state: { openExpenseId: it.expense_id } } : {})
    } else {
      navigate('/others', { state: { openExpenseId: it.expense_id } })
    }
  }

  function getBudgetIcon(action) {
    if (action === 'added') return '📅'
    if (action === 'edited') return '✏️'
    return '🗑️'
  }

  function getBudgetMsg(it) {
    const actionWord = it.action === 'added' ? 'Added' : it.action === 'edited' ? 'Edited' : 'Deleted'
    const dateStr = it.expense_date ? ` on ${fmtDate(it.expense_date)}` : ''
    const amtStr = fmtAmount(it.total_amount)
    return `${getBudgetIcon(it.action)} ${actionWord} a budget${dateStr}${amtStr}`
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.bellBtn}
        title="Notifications"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        🔔
        {totalCount > 0 && <span className={styles.badge}>{totalCount > 99 ? '99+' : totalCount}</span>}
      </button>

      {open && (
        <>
          <button type="button" className={styles.backdrop} aria-label="Close" onClick={() => setOpen(false)} />
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Notifications</span>
              <div className={styles.panelActions}>
                {typeof Notification !== 'undefined' && Notification.permission === 'default' && (
                  <button type="button" className={styles.btnTiny} onClick={requestDesktopAlerts}>
                    Enable alerts
                  </button>
                )}
                {totalCount > 0 && (
                  <button type="button" className={styles.btnTiny} onClick={handleMarkAllRead}>
                    Mark all read
                  </button>
                )}
              </div>
            </div>

            {allItems.length === 0 ? (
              <p className={styles.empty}>No new notifications since you last marked as read.</p>
            ) : (
              <ul className={styles.list}>
                {allItems.map((it) => (
                  <li key={`${it._type}-${it.id}`}>
                    <button
                      type="button"
                      className={styles.row}
                      style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left' }}
                      onClick={() => handleItemClick(it)}
                    >
                      <div className={styles.rowMeta}>
                        <span className={styles.rowAuthor}>
                          {it._type === 'budget' ? it.actor_username : (it.users?.username || 'Homie')}
                        </span>
                        {' · '}
                        {new Date(it.created_at).toLocaleString('en-LK', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      <div className={styles.rowMsg}>
                        {it._type === 'budget' ? getBudgetMsg(it) : it.message}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
