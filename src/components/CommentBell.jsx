import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import {
  getLastCommentSeenIso,
  initLastCommentSeenIfMissing,
  markAllCommentsSeen,
} from '../commentNotificationStorage'
import styles from './CommentBell.module.css'

function showDesktopNotification(title, body, tag) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, tag })
  } catch {
    /* ignore */
  }
}

export default function CommentBell() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('homies_user') || '{}')
  const myId = user?.id
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const channelRef = useRef(null)
  const itemsRef = useRef([])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const mergeById = useCallback((incoming) => {
    setItems((prev) => {
      const map = new Map()
      ;[...incoming, ...prev].forEach((r) => {
        if (r?.id) map.set(r.id, r)
      })
      return Array.from(map.values()).sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      )
    })
  }, [])

  useEffect(() => {
    if (!myId) return
    initLastCommentSeenIfMissing()

    let cancelled = false

    async function fetchMissed() {
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
      mergeById(filtered.map((r) => ({ ...r, users: { username: names[r.user_id] || 'Homie' } })))
    }

    fetchMissed()

    channelRef.current = supabase
      .channel(`comment-bell-${myId}`)
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

          let uname =
            itemsRef.current.find((i) => i.user_id === row.user_id)?.users?.username
          if (!uname) {
            const { data: u } = await supabase
              .from('users')
              .select('username')
              .eq('id', row.user_id)
              .single()
            uname = u?.username || 'Homie'
          }

          const enriched = { ...row, users: { username: uname || 'Homie' } }
          mergeById([enriched])

          const preview = (row.message || '').slice(0, 120)
          showDesktopNotification(
            `${uname || 'Homie'} commented`,
            preview || 'New comment on a budget',
            `comment-${row.id}`,
          )
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [myId, mergeById])

  if (!myId) return null

  function goToComment(it) {
    setOpen(false)
    navigate('/others', { state: { openExpenseId: it.expense_id } })
  }

  function handleMarkAllRead() {
    markAllCommentsSeen()
    setItems([])
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

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.bellBtn}
        title="Comments from homies"
        aria-label="Comment notifications"
        onClick={() => setOpen((v) => !v)}
      >
        🔔
        {items.length > 0 && <span className={styles.badge}>{items.length > 99 ? '99+' : items.length}</span>}
      </button>

      {open && (
        <>
          <button type="button" className={styles.backdrop} aria-label="Close" onClick={() => setOpen(false)} />
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>New comments</span>
              <div className={styles.panelActions}>
                {typeof Notification !== 'undefined' && Notification.permission === 'default' && (
                  <button type="button" className={styles.btnTiny} onClick={requestDesktopAlerts}>
                    Enable alerts
                  </button>
                )}
                {items.length > 0 && (
                  <button type="button" className={styles.btnTiny} onClick={handleMarkAllRead}>
                    Mark all read
                  </button>
                )}
              </div>
            </div>
            {items.length === 0 ? (
              <p className={styles.empty}>No new comments since you last marked as read.</p>
            ) : (
              <ul className={styles.list}>
                {items.map((it) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      className={styles.row}
                      style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left' }}
                      onClick={() => goToComment(it)}
                    >
                      <div className={styles.rowMeta}>
                        <span className={styles.rowAuthor}>{it.users?.username || 'Homie'}</span>
                        {' · '}
                        {new Date(it.created_at).toLocaleString('en-LK', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      <div className={styles.rowMsg}>{it.message}</div>
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
