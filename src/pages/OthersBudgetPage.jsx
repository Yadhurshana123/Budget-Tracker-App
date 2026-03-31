import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Navbar from '../components/Navbar'
import styles from './OthersBudgetPage.module.css'
import { formatLkr } from '../formatMoney'

function groupPerHeadItems(rows, userMap) {
  const order = []
  const map = new Map()
  for (const row of rows || []) {
    if (!map.has(row.for_user_id)) {
      map.set(row.for_user_id, [])
      order.push(row.for_user_id)
    }
    map.get(row.for_user_id).push(row)
  }
  return order.map((id) => ({
    for_user_id: id,
    name: userMap[id] || 'Member',
    items: map.get(id),
  }))
}

export default function OthersBudgetPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = JSON.parse(localStorage.getItem('homies_user') || '{}')
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [comments, setComments] = useState({})
  const [commentInput, setCommentInput] = useState({})
  const [sending, setSending] = useState({})
  const [userMap, setUserMap] = useState({})
  const channelRef = useRef(null)
  const scrollTargetRef = useRef(null)

  useEffect(() => {
    let c = false
    ;(async () => {
      const { data } = await supabase.from('users').select('id, username')
      if (!c && data) setUserMap(Object.fromEntries(data.map((u) => [u.id, u.username])))
    })()
    return () => { c = true }
  }, [])

  useEffect(() => {
    const openId = location.state?.openExpenseId
    if (!openId) return
    scrollTargetRef.current = openId
    setExpanded(openId)
    fetchComments(openId)
    navigate(location.pathname, { replace: true, state: {} })
  }, [location.state?.openExpenseId, location.pathname, navigate])

  useEffect(() => {
    if (loading || !scrollTargetRef.current || expanded !== scrollTargetRef.current) return
    requestAnimationFrame(() => {
      document.getElementById(`expense-card-${expanded}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      scrollTargetRef.current = null
    })
  }, [expanded, loading, expenses.length])

  useEffect(() => {
    fetchAll()

    channelRef.current = supabase
      .channel('others-budget-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, (payload) => {
        const expId = payload.new?.expense_id || payload.old?.expense_id
        if (expId) fetchComments(expId)
      })
      .subscribe()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  async function fetchAll() {
    setLoading(true)
    const { data } = await supabase
      .from('expenses')
      .select('*, expense_items(*), expense_per_head_items(*), users(username)')
      .eq('is_confirmed', true)
      .neq('user_id', user.id)
      .order('date', { ascending: false })
    setExpenses(data || [])
    setLoading(false)
  }

  async function fetchComments(expenseId) {
    const { data } = await supabase
      .from('comments')
      .select('*, users(username)')
      .eq('expense_id', expenseId)
      .order('created_at', { ascending: true })
    setComments(prev => ({ ...prev, [expenseId]: data || [] }))
  }

  async function toggleExpand(id) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!comments[id]) await fetchComments(id)
  }

  async function sendComment(expenseId) {
    const msg = (commentInput[expenseId] || '').trim()
    if (!msg) return
    setSending(prev => ({ ...prev, [expenseId]: true }))
    await supabase.from('comments').insert({ expense_id: expenseId, user_id: user.id, message: msg })
    setCommentInput(prev => ({ ...prev, [expenseId]: '' }))
    await fetchComments(expenseId)
    setSending(prev => ({ ...prev, [expenseId]: false }))
  }

  const grouped = expenses.reduce((acc, exp) => {
    const uname = exp.users?.username || 'Unknown'
    if (!acc[uname]) acc[uname] = []
    acc[uname].push(exp)
    return acc
  }, {})

  const userColors = { 0: '#1E3A5F', 1: '#2E6DA4', 2: '#4A90D9' }
  const userKeys = Object.keys(grouped)

  return (
    <div>
      <Navbar />
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button className="btn-secondary" onClick={() => navigate('/')} style={{ padding: '8px 16px' }}>← Back</button>
          <h2 className="page-title" style={{ margin: 0 }}>👀 All Homies' Budgets</h2>
          <span style={{ marginLeft: 'auto', fontSize: 12, background: '#e8f5e9', padding: '4px 10px', borderRadius: 20, color: '#27ae60' }}>🟢 Live</span>
        </div>

        {loading && <p style={{ color: 'var(--text-light)' }}>Loading...</p>}
        {!loading && expenses.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-light)' }}>
            No confirmed entries yet.
          </div>
        )}

        {userKeys.map((uname, ui) => (
          <div key={uname} className={styles.userSection}>
            <div className={styles.userHeader} style={{ borderLeft: `5px solid ${userColors[ui % 3]}` }}>
              <span className={styles.userAvatar} style={{ background: userColors[ui % 3] }}>
                {uname[0]?.toUpperCase()}
              </span>
              <span className={styles.userName}>{uname}</span>
              <span className={styles.userTotal}>
                Total:
                {' '}
                {formatLkr(grouped[uname].reduce((s, e) => s + parseFloat(e.total_amount), 0))}
              </span>
            </div>

            {grouped[uname].map((exp) => {
              const perHeadGroups = groupPerHeadItems(exp.expense_per_head_items, userMap)
              return (
              <div id={`expense-card-${exp.id}`} key={exp.id} className={`card ${styles.expCard}`}>
                <div className={styles.expHeader} onClick={() => toggleExpand(exp.id)}>
                  <div>
                    <span className={styles.expDate}>
                      {new Date(exp.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className={styles.itemCount}>{exp.expense_items?.length} items</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className={styles.expTotal}>{formatLkr(exp.total_amount)}</span>
                    <span style={{ color: 'var(--text-light)' }}>{expanded === exp.id ? '▲' : '▼'}</span>
                  </div>
                </div>

                {expanded === exp.id && (
                  <div className={styles.expBody}>
                    <table className={styles.table}>
                      <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Amount (Rs.)</th></tr></thead>
                      <tbody>
                        {exp.expense_items?.map((item, idx) => (
                          <tr key={item.id}>
                            <td>{idx + 1}</td>
                            <td>{item.product_name}</td>
                            <td>{item.quantity == null || item.quantity === '' ? '—' : item.quantity}</td>
                            <td>{formatLkr(item.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {perHeadGroups.length > 0 && (
                      <div style={{ marginTop: 20 }}>
                        <h4 style={{ margin: '0 0 10px', fontSize: 15, color: 'var(--primary)' }}>Per head budget</h4>
                        {perHeadGroups.map((g) => (
                          <div key={g.for_user_id} style={{ marginBottom: 16 }}>
                            <p style={{ fontWeight: 700, margin: '0 0 8px', color: 'var(--primary-light)', fontSize: 14 }}>{g.name}</p>
                            <table className={styles.table}>
                              <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Amount (Rs.)</th></tr></thead>
                              <tbody>
                                {g.items.map((item, idx) => (
                                  <tr key={item.id}>
                                    <td>{idx + 1}</td>
                                    <td>{item.product_name}</td>
                                    <td>{item.quantity == null || item.quantity === '' ? '—' : item.quantity}</td>
                                    <td>{formatLkr(item.amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Comments */}
                    <div className={styles.commentsSection}>
                      <h4 className={styles.commentsTitle}>💬 Comments</h4>
                      <div className={styles.commentsList}>
                        {(comments[exp.id] || []).length === 0 && (
                          <p style={{ color: 'var(--text-light)', fontSize: 13 }}>No comments yet. Be the first!</p>
                        )}
                        {(comments[exp.id] || []).map(c => (
                          <div key={c.id} className={`${styles.commentBubble} ${c.user_id === user.id ? styles.mine : ''}`}>
                            <span className={styles.commentUser}>{c.users?.username}</span>
                            <span className={styles.commentMsg}>{c.message}</span>
                            <span className={styles.commentTime}>
                              {new Date(c.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className={styles.commentInput}>
                        <input
                          placeholder="Write a comment..."
                          value={commentInput[exp.id] || ''}
                          onChange={e => setCommentInput(prev => ({ ...prev, [exp.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && sendComment(exp.id)}
                        />
                        <button
                          className="btn-primary"
                          style={{ padding: '10px 18px', whiteSpace: 'nowrap' }}
                          onClick={() => sendComment(exp.id)}
                          disabled={sending[exp.id]}
                        >
                          {sending[exp.id] ? '...' : 'Send'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
