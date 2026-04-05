import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../js/supabaseClient'
import Navbar from '../components/Navbar'
import styles from './OthersBudgetPage.module.css'
import { formatLkr } from '../js/formatMoney'

export default function AllocatedToMePage() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('homies_user') || '{}')
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    fetchAllocatedToMe()
  }, [])

  async function fetchAllocatedToMe() {
    setLoading(true)
    const { data, error } = await supabase
      .from('expenses')
      .select('*, expense_per_head_items(*), users(username)')
      .eq('is_confirmed', true)
      .neq('user_id', user.id)
      .order('date', { ascending: false })
    
    if (error) {
       console.error(error)
       setLoading(false)
       return
    }

    const filteredExpenses = (data || [])
      .map(exp => ({
        ...exp,
        expense_per_head_items: exp.expense_per_head_items.filter(item => item.for_user_id === user.id)
      }))
      .filter(exp => exp.expense_per_head_items.length > 0)
    
    setExpenses(filteredExpenses)
    setLoading(false)
  }

  function toggleExpand(id) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
  }

  // Group by the user who paid (the creator of the expense)
  const grouped = expenses.reduce((acc, exp) => {
    const uname = exp.users?.username || 'Unknown'
    if (!acc[uname]) acc[uname] = []
    acc[uname].push(exp)
    return acc
  }, {})

  const userColors = { 0: '#1E3A5F', 1: '#2E6DA4', 2: '#4A90D9', 3: '#16a085', 4: '#f39c12' }
  const userKeys = Object.keys(grouped)

  return (
    <div>
      <Navbar />
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button className="btn-secondary" onClick={() => navigate('/')} style={{ padding: '8px 16px' }}>← Back</button>
          <h2 className="page-title" style={{ margin: 0 }}>🎁 Allocated To Me</h2>
        </div>

        {loading && <p style={{ color: 'var(--text-light)' }}>Loading...</p>}
        {!loading && userKeys.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-light)' }}>
            No one has allocated any budget to you yet.
          </div>
        )}

        {userKeys.map((uname, ui) => (
          <div key={uname} className={styles.userSection}>
            <div className={styles.userHeader} style={{ borderLeft: `5px solid ${userColors[ui % 5]}` }}>
              <span className={styles.userAvatar} style={{ background: userColors[ui % 5] }}>
                {uname[0]?.toUpperCase()}
              </span>
              <span className={styles.userName}>{uname} allocated to you:</span>
              <span className={styles.userTotal}>
                Total:{' '}
                {formatLkr(grouped[uname].reduce((s, e) => s + e.expense_per_head_items.reduce((s2, i) => s2 + parseFloat(i.amount), 0), 0))}
              </span>
            </div>

            {grouped[uname].map((exp) => {
              const itemsTotal = exp.expense_per_head_items.reduce((s, i) => s + parseFloat(i.amount), 0)
              return (
              <div id={`expense-card-${exp.id}`} key={exp.id} className={`card ${styles.expCard}`}>
                <div className={styles.expHeader} onClick={() => toggleExpand(exp.id)}>
                  <div>
                    <span className={styles.expDate}>
                      {new Date(exp.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className={styles.itemCount}>{exp.expense_per_head_items.length} items for you</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className={styles.expTotal}>{formatLkr(itemsTotal)}</span>
                    <span style={{ color: 'var(--text-light)' }}>{expanded === exp.id ? '▲' : '▼'}</span>
                  </div>
                </div>

                {expanded === exp.id && (
                  <div className={styles.expBody}>
                    <div className={styles.tableWrapper}>
                      <table className={styles.table}>
                        <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Amount (Rs.)</th></tr></thead>
                        <tbody>
                          {exp.expense_per_head_items.map((item, idx) => (
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
