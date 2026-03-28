import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Navbar from '../components/Navbar'
import styles from './PastHistoryPage.module.css'
import {
  emptyItem,
  emptyPerHeadBlock,
  qtyToDb,
  parsePerHeadBlocks,
  parseMainItems,
} from '../budgetFormUtils'
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
  const [editingId, setEditingId] = useState(null)
  const [editItems, setEditItems] = useState([])
  const [editPerHeadBlocks, setEditPerHeadBlocks] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
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
    setEditingId(null)
    setEditPerHeadBlocks([])
    setEditItems([])
  }

  function startEdit(expense, e) {
    if (e) e.stopPropagation()
    setEditingId(expense.id)
    setExpanded(expense.id)
    setError('')
    const rawMain = expense.expense_items || []
    setEditItems(
      rawMain.length > 0
        ? rawMain.map((i) => ({
          ...i,
          quantity: i.quantity == null || i.quantity === '' ? '' : String(i.quantity),
          amount: i.amount,
        }))
        : [emptyItem()],
    )
    const phRows = expense.expense_per_head_items || []
    if (phRows.length === 0) {
      setEditPerHeadBlocks([])
    } else {
      const groups = groupPerHeadItems(phRows, userMap)
      setEditPerHeadBlocks(
        groups.map((g) => ({
          for_user_id: g.for_user_id,
          items: g.items.map((i) => ({
            product_name: i.product_name,
            quantity: i.quantity == null || i.quantity === '' ? '' : String(i.quantity),
            amount: i.amount,
          })),
        })),
      )
    }
  }

  function updateEditItem(idx, field, val) {
    setEditItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item)))
  }

  function addEditItem() {
    setEditItems((prev) => [...prev, emptyItem()])
  }

  function removeEditItem(idx) {
    if (editItems.length === 1) return
    setEditItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function addEditPerHeadBlock() {
    setEditPerHeadBlocks((prev) => [...prev, emptyPerHeadBlock()])
  }

  function removeEditPerHeadBlock(bi) {
    setEditPerHeadBlocks((prev) => prev.filter((_, i) => i !== bi))
  }

  function setEditPerHeadUser(bi, for_user_id) {
    setEditPerHeadBlocks((prev) => prev.map((b, i) => (i === bi ? { ...b, for_user_id } : b)))
  }

  function addEditPerHeadItem(bi) {
    setEditPerHeadBlocks((prev) => prev.map((b, i) => (i === bi ? { ...b, items: [...b.items, emptyItem()] } : b)))
  }

  function removeEditPerHeadItem(bi, ii) {
    setEditPerHeadBlocks((prev) => prev.map((b, i) => {
      if (i !== bi) return b
      if (b.items.length === 1) return b
      return { ...b, items: b.items.filter((_, j) => j !== ii) }
    }))
  }

  function updateEditPerHeadItem(bi, ii, field, val) {
    setEditPerHeadBlocks((prev) => prev.map((b, i) => {
      if (i !== bi) return b
      return { ...b, items: b.items.map((item, j) => (j === ii ? { ...item, [field]: val } : item)) }
    }))
  }

  async function saveEdit(expenseId) {
    setError('')
    const ph = parsePerHeadBlocks(editPerHeadBlocks)
    if (!ph.ok) { setError(ph.error); return }
    const main = parseMainItems(editItems)
    if (!main.ok) { setError(main.error); return }
    if (main.meaningful.length === 0 && ph.blocks.length === 0) {
      setError('Add at least one line under Items or under Per head budget.')
      return
    }

    const mainTotal = main.meaningful.reduce((sum, i) => sum + parseFloat(i.amount), 0)
    const headTotal = ph.blocks.reduce(
      (sum, b) => sum + b.items.reduce((s, i) => s + parseFloat(i.amount), 0),
      0,
    )
    const totalAmount = mainTotal > 0 ? mainTotal : headTotal

    setSaving(true)
    try {
      await supabase.from('expense_items').delete().eq('expense_id', expenseId)
      if (main.meaningful.length > 0) {
        const { error: insErr } = await supabase.from('expense_items').insert(
          main.meaningful.map((i) => ({
            expense_id: expenseId,
            product_name: i.product_name.trim(),
            quantity: qtyToDb(i.quantity),
            amount: parseFloat(i.amount),
          })),
        )
        if (insErr) throw insErr
      }

      await supabase.from('expense_per_head_items').delete().eq('expense_id', expenseId)
      if (ph.blocks.length > 0) {
        const perHeadRows = []
        for (const block of ph.blocks) {
          for (const i of block.items) {
            perHeadRows.push({
              expense_id: expenseId,
              for_user_id: block.for_user_id,
              product_name: i.product_name.trim(),
              quantity: qtyToDb(i.quantity),
              amount: parseFloat(i.amount),
            })
          }
        }
        const { error: phErr } = await supabase.from('expense_per_head_items').insert(perHeadRows)
        if (phErr) throw phErr
      }

      const { error: updErr } = await supabase.from('expenses').update({ total_amount: totalAmount, is_confirmed: true }).eq('id', expenseId)
      if (updErr) throw updErr

      setEditingId(null)
      setEditPerHeadBlocks([])
      fetchExpenses()
    } catch (err) {
      setError('Save failed: ' + (err.message || String(err)))
    } finally {
      setSaving(false)
    }
  }

  function cancelEdit(e) {
    if (e) e.stopPropagation()
    setEditingId(null)
    setEditPerHeadBlocks([])
    setError('')
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
                  {editingId === exp.id ? (
                    <>
                      <p style={{ fontWeight: 700, marginBottom: 10, color: 'var(--primary)', fontSize: 14 }}>Items</p>
                      {editItems.map((item, idx) => (
                        <div key={idx} className={styles.editRow}>
                          <span style={{ fontWeight: 700, color: 'var(--primary-light)', minWidth: 20 }}>{idx + 1}</span>
                          <input placeholder="Product" value={item.product_name ?? ''} onChange={(e) => updateEditItem(idx, 'product_name', e.target.value)} style={{ flex: 2 }} />
                          <input placeholder="Qty (optional)" type="number" min="1" value={item.quantity ?? ''} onChange={(e) => updateEditItem(idx, 'quantity', e.target.value)} style={{ flex: 1 }} />
                          <input placeholder="Amount (Rs.)" type="number" value={item.amount ?? ''} onChange={(e) => updateEditItem(idx, 'amount', e.target.value)} style={{ flex: 1 }} />
                          {editItems.length > 1 && <button type="button" className="btn-danger" style={{ padding: '7px 10px' }} onClick={() => removeEditItem(idx)}>✕</button>}
                        </div>
                      ))}
                      <button type="button" className="btn-secondary" style={{ fontSize: 13, marginTop: 6 }} onClick={addEditItem}>+ Add Item</button>

                      <div className={styles.perHeadEditSection}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 14 }}>Per head budget</span>
                          <button type="button" className="btn-secondary" style={{ padding: '7px 14px', fontSize: 13 }} onClick={addEditPerHeadBlock}>+ Add person</button>
                        </div>
                        {editPerHeadBlocks.map((block, bi) => (
                          <div key={bi} className={styles.perHeadEditBlock}>
                            <div className={styles.perHeadEditTop}>
                              <label className={styles.perHeadEditLabel}>
                                <span>Name</span>
                                <select
                                  className={styles.perHeadEditSelect}
                                  value={block.for_user_id}
                                  onChange={(e) => setEditPerHeadUser(bi, e.target.value)}
                                >
                                  <option value="">Select name…</option>
                                  {usersList.map((u) => (
                                    <option key={u.id} value={u.id}>{u.username}</option>
                                  ))}
                                </select>
                              </label>
                              <button type="button" className="btn-danger" style={{ padding: '8px 12px' }} onClick={() => removeEditPerHeadBlock(bi)}>Remove person</button>
                            </div>
                            {block.items.map((item, ii) => (
                              <div key={ii} className={styles.editRow}>
                                <span style={{ fontWeight: 700, color: 'var(--primary-light)', minWidth: 20 }}>{ii + 1}</span>
                                <input placeholder="Product" value={item.product_name ?? ''} onChange={(e) => updateEditPerHeadItem(bi, ii, 'product_name', e.target.value)} style={{ flex: 2 }} />
                                <input placeholder="Qty (optional)" type="number" min="1" value={item.quantity ?? ''} onChange={(e) => updateEditPerHeadItem(bi, ii, 'quantity', e.target.value)} style={{ flex: 1 }} />
                                <input placeholder="Amount (Rs.)" type="number" value={item.amount ?? ''} onChange={(e) => updateEditPerHeadItem(bi, ii, 'amount', e.target.value)} style={{ flex: 1 }} />
                                {block.items.length > 1 && <button type="button" className="btn-danger" style={{ padding: '7px 10px' }} onClick={() => removeEditPerHeadItem(bi, ii)}>✕</button>}
                              </div>
                            ))}
                            <button type="button" className="btn-secondary" style={{ padding: '7px 14px', fontSize: 13, marginTop: 4 }} onClick={() => addEditPerHeadItem(bi)}>+ Add product</button>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                        <button type="button" className="btn-primary" onClick={() => saveEdit(exp.id)} disabled={saving}>{saving ? 'Saving...' : '✅ Save Changes'}</button>
                        <button type="button" className="btn-secondary" onClick={(e) => cancelEdit(e)}>Cancel</button>
                      </div>
                      {error && <p className="error-msg">{error}</p>}
                    </>
                  ) : (
                    <>
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
                      <button type="button" className="btn-secondary" style={{ marginTop: 10 }} onClick={(e) => startEdit(exp, e)}>✏️ Edit entry</button>
                    </>
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
