import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../js/supabaseClient'
import Navbar from '../components/Navbar'
import styles from './ProfilePage.module.css'
import { formatLkr } from '../js/formatMoney'

function calendarDaysInclusive(isoDate1, isoDate2) {
  if (!isoDate1 || !isoDate2) return 0
  const a = new Date(`${isoDate1}T12:00:00`)
  const b = new Date(`${isoDate2}T12:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0
  const d1 = a <= b ? a : b
  const d2 = a <= b ? b : a
  const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate())
  const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate())
  return Math.floor((utc2 - utc1) / 86400000) + 1
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('homies_user') || '{}')
  const [expenses, setExpenses] = useState([])
  const [usersList, setUsersList] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterUserId, setFilterUserId] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const [expRes, usersRes] = await Promise.all([
        supabase
          .from('expenses')
          .select('id, date, total_amount, expense_per_head_items(for_user_id, amount)')
          .eq('user_id', user.id)
          .order('date', { ascending: true }),
        supabase.from('users').select('id, username').order('username'),
      ])
      if (!cancelled) {
        setExpenses(expRes.data || [])
        setUsersList(usersRes.data || [])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user.id])

  const overview = useMemo(() => {
    const list = expenses
    const totalAllTime = list.reduce((s, e) => s + parseFloat(e.total_amount || 0), 0)
    const entryCount = list.length
    const firstDate = entryCount ? list[0].date : null
    const lastDate = entryCount ? list[entryCount - 1].date : null
    const daySpan = entryCount ? calendarDaysInclusive(firstDate, lastDate) : 0
    return { totalAllTime, entryCount, firstDate, lastDate, daySpan }
  }, [expenses])

  const forMember = useMemo(() => {
    if (!filterUserId) return null
    let sum = 0
    let lineCount = 0
    const entryIds = new Set()
    let firstHit = null
    let lastHit = null
    for (const exp of expenses) {
      const rows = exp.expense_per_head_items || []
      let thisExpHit = false
      for (const r of rows) {
        if (r.for_user_id === filterUserId) {
          sum += parseFloat(r.amount || 0)
          lineCount += 1
          thisExpHit = true
        }
      }
      if (thisExpHit) {
        entryIds.add(exp.id)
        if (!firstHit || exp.date < firstHit) firstHit = exp.date
        if (!lastHit || exp.date > lastHit) lastHit = exp.date
      }
    }
    const name = usersList.find((u) => u.id === filterUserId)?.username || 'Member'
    const memberDaySpan = firstHit && lastHit ? calendarDaysInclusive(firstHit, lastHit) : 0
    return {
      sum,
      lineCount,
      entryCount: entryIds.size,
      name,
      firstHit,
      lastHit,
      memberDaySpan,
    }
  }, [expenses, filterUserId, usersList])

  return (
    <div>
      <Navbar />
      <div className="page-container">
        <div className={styles.headerRow}>
          <button type="button" className="btn-secondary" onClick={() => navigate('/')} style={{ padding: '8px 16px' }}>← Home</button>
          <h2 className="page-title" style={{ margin: 0 }}>👤 My profile</h2>
        </div>

        {loading && <p className={styles.loading}>Loading your stats…</p>}

        {!loading && (
          <>
            <div className={styles.hero}>
              <div className={styles.heroLabel}>Total you have logged (all days)</div>
              <div className={styles.heroAmount}>{formatLkr(overview.totalAllTime)}</div>
              <div className={styles.heroMeta}>
                {overview.entryCount === 0 && 'No budget entries yet. Add one from the home screen.'}
                {overview.entryCount > 0 && (
                  <>
                    {overview.entryCount} budget
                    {' '}
                    {overview.entryCount === 1 ? 'entry' : 'entries'}
                    {' · '}
                    {overview.daySpan}
                    {' '}
                    calendar day
                    {overview.daySpan === 1 ? '' : 's'}
                    {' '}
                    between
                    {' '}
                    {formatDate(overview.firstDate)}
                    {' and '}
                    {formatDate(overview.lastDate)}
                  </>
                )}
              </div>
            </div>

            <div className={styles.grid}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{overview.entryCount}</div>
                <div className={styles.statLabel}>Entries</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>
                  {overview.entryCount === 0 ? '—' : formatLkr(overview.totalAllTime / overview.entryCount)}
                </div>
                <div className={styles.statLabel}>Average per entry</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{overview.entryCount === 0 ? '—' : overview.daySpan}</div>
                <div className={styles.statLabel}>Day span (first → last)</div>
              </div>
            </div>

            <div className="card">
              <h3 className={styles.sectionTitle}>Spending for a homie (per-head)</h3>
              <p className={styles.hint} style={{ marginTop: 0 }}>
                Filter by name to see how much you have allocated to them under
                {' '}
                <strong>Per head budget</strong>
                {' '}
                on your entries. This is not your full total unless every spend was split in per-head.
              </p>
              <div className={styles.filterRow}>
                <div className={styles.filterField}>
                  <label htmlFor="member-filter">Homie</label>
                  <select
                    id="member-filter"
                    className={styles.filterSelect}
                    value={filterUserId}
                    onChange={(e) => setFilterUserId(e.target.value)}
                  >
                    <option value="">— Select a name —</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>{u.username}</option>
                    ))}
                  </select>
                </div>
              </div>

              {filterUserId && forMember && (
                <div className={styles.memberResult}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)', marginBottom: 6 }}>
                    Allocated for
                    {' '}
                    {forMember.name}
                  </div>
                  <div className={styles.memberAmount}>{formatLkr(forMember.sum)}</div>
                  <div className={styles.memberMeta}>
                    {forMember.lineCount}
                    {' '}
                    per-head line
                    {forMember.lineCount === 1 ? '' : 's'}
                    {' '}
                    across
                    {' '}
                    {forMember.entryCount}
                    {' '}
                    budget
                    {forMember.entryCount === 1 ? ' entry' : ' entries'}
                    {forMember.entryCount > 0 && (
                      <>
                        {' · '}
                        {forMember.memberDaySpan}
                        {' '}
                        day
                        {forMember.memberDaySpan === 1 ? '' : 's'}
                        {' '}
                        (
                        {formatDate(forMember.firstHit)}
                        {' → '}
                        {formatDate(forMember.lastHit)}
                        )
                      </>
                    )}
                  </div>
                  {forMember.lineCount === 0 && (
                    <p className={styles.hint} style={{ marginBottom: 0 }}>
                      No per-head rows for this person yet. Edit an entry or add a new budget with “Per head budget”.
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

