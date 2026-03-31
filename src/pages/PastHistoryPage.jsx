import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Navbar from '../components/Navbar'
import styles from './PastHistoryPage.module.css'

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

export default function PastHistoryPage() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('homies_user') || '{}')
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [userMap, setUserMap] = useState({})
  const [usersList, setUsersList] = useState([])

  useEffect(() => {
    let c = false
    ;(async () => {
      const { data } = await supabase.from('users').select('id, username').order('username')
      if (!c && data) {
        setUserMap(Object.fromEntries(data.map((u) => [u.id, u.username])))
        setUsersList(data)
      }
    })()
    return () => { c = true }
  }, [])

  useEffect(() => { fetchExpenses() }, [])

  async function fetchExpenses() {
    setLoading(true)
    const { data } = await supabase
      .from('expenses')
      .select('*, expense_items(*), expense_per_head_items(*)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
    setExpenses(data || [])
    setLoading(false)
  }

  function toggleExpand(id) {
    setExpanded((prev) => (prev === id ? null : id))
  }

  return (
    <div>
      <Navbar />
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button className="btn-secondary" onClick={() => navigate('/')} style={{ padding: '8px 16px' }}>← Back</button>
          <h2 className="page-title" style={{ margin: 0 }}>📋 My Past History</h2>
        </div>

        {loading && <p style={{ color: 'var(--text-light)' }}>Loading...</p>}
        {!loading && expenses.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-light)' }}>
            No entries yet. <span style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => navigate('/add-budget')}>Add your first budget →</span>
          </div>
        )}

        {expenses.map((exp) => {
          const perHeadGroups = groupPerHeadItems(exp.expense_per_head_items, userMap)
          const mainRows = exp.expense_items || []
          return (
            <div key={exp.id} className={`card ${styles.expCard}`}>
              <div className={styles.expHeader} onClick={() => toggleExpand(exp.id)}>
                <div>
                  <span className={styles.expDate}>{new Date(exp.date).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  <span className={`badge ${exp.is_confirmed ? 'badge-confirmed' : 'badge-draft'}`} style={{ marginLeft: 10 }}>
                    {exp.is_confirmed ? 'Confirmed' : 'Draft'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span className={styles.expTotal}>{formatLkr(exp.total_amount)}</span>
                  <span style={{ color: 'var(--text-light)' }}>{expanded === exp.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {expanded === exp.id && (
                <div className={styles.expBody}>
                      <table className={styles.table}>
                        <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Amount (Rs.)</th></tr></thead>
                        <tbody>
                          {mainRows.length === 0 ? (
                            <tr><td colSpan={4} style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>No main items (per head only)</td></tr>
                          ) : (
                            mainRows.map((item, idx) => (
                              <tr key={item.id}>
                                <td>{idx + 1}</td>
                                <td>{item.product_name}</td>
                                <td>{item.quantity == null || item.quantity === '' ? '—' : item.quantity}</td>
                                <td>{formatLkr(item.amount)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3} style={{ fontWeight: 700, color: 'var(--primary)', textAlign: 'right' }}>Total</td>
                            <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatLkr(exp.total_amount)}</td>
                          </tr>
                        </tfoot>
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
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
