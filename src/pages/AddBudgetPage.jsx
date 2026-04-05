import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../js/supabaseClient'
import Navbar from '../components/Navbar'
import styles from './AddBudgetPage.module.css'
import {
  emptyItem,
  emptyPerHeadBlock,
  qtyToDb,
  lineHasAnyData,
  parsePerHeadBlocks,
  parseMainItems,
} from '../js/budgetFormUtils'
import { formatLkr } from '../js/formatMoney'

export default function AddBudgetPage() {
  const navigate = useNavigate()
  const { id: editId } = useParams()
  const user = JSON.parse(localStorage.getItem('homies_user') || '{}')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [usersList, setUsersList] = useState([])
  const [items, setItems] = useState([emptyItem()])
  const [perHeadBlocks, setPerHeadBlocks] = useState([])
  const [showSummary, setShowSummary] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [parsedPerHead, setParsedPerHead] = useState([])
  const [parsedMainItems, setParsedMainItems] = useState([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('users').select('id, username').order('username')
      if (!cancelled) setUsersList(data || [])
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!editId) return
    let cancelled = false
    ;(async () => {
      const { data: exp } = await supabase.from('expenses').select('*, expense_items(*), expense_per_head_items(*)').eq('id', editId).single()
      if (cancelled || !exp) return
      setDate(exp.date || new Date().toISOString().split('T')[0])
      if (exp.expense_items && exp.expense_items.length > 0) {
        setItems(exp.expense_items.map(i => ({ product_name: i.product_name, quantity: i.quantity || '', amount: i.amount })))
      }
      
      if (exp.expense_per_head_items && exp.expense_per_head_items.length > 0) {
        const phMap = {}
        for (const i of exp.expense_per_head_items) {
          if (!phMap[i.for_user_id]) phMap[i.for_user_id] = []
          phMap[i.for_user_id].push({ product_name: i.product_name, quantity: i.quantity || '', amount: i.amount })
        }
        setPerHeadBlocks(Object.keys(phMap).map(userId => ({ for_user_id: userId, items: phMap[userId] })))
      }
    })()
    return () => { cancelled = true }
  }, [editId])

  const userNameById = Object.fromEntries(usersList.map((u) => [u.id, u.username]))

  const mainFormTotal = items
    .filter(lineHasAnyData)
    .reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0)
  const mainSavedTotal = parsedMainItems.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0)
  const perHeadSubtotal = parsedPerHead.reduce(
    (sum, b) => sum + b.items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0),
    0,
  )
  /** Expense total: main items if any; otherwise per-head only. */
  const expenseTotal = mainSavedTotal > 0 ? mainSavedTotal : perHeadSubtotal

  function updateItem(idx, field, val) {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item)))
  }

  function addItem() { setItems((prev) => [...prev, emptyItem()]) }

  function removeItem(idx) {
    if (items.length === 1) return
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function addPerHeadBlock() {
    setPerHeadBlocks((prev) => [...prev, emptyPerHeadBlock()])
  }

  function removePerHeadBlock(bi) {
    setPerHeadBlocks((prev) => prev.filter((_, i) => i !== bi))
  }

  function setPerHeadUser(bi, for_user_id) {
    setPerHeadBlocks((prev) => prev.map((b, i) => (i === bi ? { ...b, for_user_id } : b)))
  }

  function addPerHeadItem(bi) {
    setPerHeadBlocks((prev) => prev.map((b, i) => (i === bi ? { ...b, items: [...b.items, emptyItem()] } : b)))
  }

  function removePerHeadItem(bi, ii) {
    setPerHeadBlocks((prev) => prev.map((b, i) => {
      if (i !== bi) return b
      if (b.items.length === 1) return b
      return { ...b, items: b.items.filter((_, j) => j !== ii) }
    }))
  }

  function updatePerHeadItem(bi, ii, field, val) {
    setPerHeadBlocks((prev) => prev.map((b, i) => {
      if (i !== bi) return b
      return { ...b, items: b.items.map((item, j) => (j === ii ? { ...item, [field]: val } : item)) }
    }))
  }

  function handlePreview(e) {
    e.preventDefault()
    setError('')

    // Date validation: Prevent past dates for NEW budgets
    const today = new Date().toISOString().split('T')[0]
    if (!editId && date < today) {
      setError('You cannot set a budget for a past date.')
      return
    }

    const ph = parsePerHeadBlocks(perHeadBlocks)
    if (!ph.ok) { setError(ph.error); return }
    const main = parseMainItems(items)
    if (!main.ok) { setError(main.error); return }
    if (main.meaningful.length === 0 && ph.blocks.length === 0) {
      setError('Add at least one line under Items or under Per head budget.')
      return
    }
    setParsedMainItems(main.meaningful)
    setParsedPerHead(ph.blocks)
    setShowSummary(true)
  }

  async function handleConfirm() {
    setSaving(true)
    setError('')
    try {
      let expenseId = editId
      if (editId) {
        const { error: expUpdateErr } = await supabase.from('expenses').update({ date, total_amount: expenseTotal }).eq('id', editId)
        if (expUpdateErr) throw expUpdateErr
        await supabase.from('expense_items').delete().eq('expense_id', editId)
        await supabase.from('expense_per_head_items').delete().eq('expense_id', editId)
      } else {
        const { data: expense, error: expErr } = await supabase
          .from('expenses')
          .insert({ user_id: user.id, date, total_amount: expenseTotal, is_confirmed: true })
          .select()
          .single()
        if (expErr) throw expErr
        expenseId = expense.id
      }

      if (parsedMainItems.length > 0) {
        const expenseItems = parsedMainItems.map((i) => ({
          expense_id: expenseId,
          product_name: i.product_name.trim(),
          quantity: qtyToDb(i.quantity),
          amount: parseFloat(i.amount),
        }))
        const { error: itemErr } = await supabase.from('expense_items').insert(expenseItems)
        if (itemErr) throw itemErr
      }

      if (parsedPerHead.length > 0) {
        const perHeadRows = []
        for (const block of parsedPerHead) {
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

      setSuccess(true)
      setTimeout(() => navigate('/history'), 1800)
    } catch (err) {
      setError('Save failed: ' + err.message)
      setSaving(false)
    }
  }

  if (success) {
    return (
      <div>
        <Navbar />
        <div className="page-container" style={{ textAlign: 'center', marginTop: 60 }}>
          <div className="card" style={{ display: 'inline-block', padding: '48px 60px' }}>
            <div style={{ fontSize: 56 }}>✅</div>
            <h2 style={{ color: 'var(--success)', marginTop: 16 }}>Budget Saved!</h2>
            <p style={{ color: 'var(--text-light)', marginTop: 8 }}>Visible to your homies. Redirecting...</p>
          </div>
        </div>
      </div>
    )
  }

  if (showSummary) {
    return (
      <div>
        <Navbar />
        <div className="page-container">
          <h2 className="page-title">📋 Summary — Confirm?</h2>
          <div className="card">
            <h3 style={{ margin: '0 0 12px', fontSize: 16, color: 'var(--primary)' }}>Main items</h3>
            {parsedMainItems.length === 0 ? (
              <p style={{ color: 'var(--text-light)', marginBottom: 16 }}>No lines in Items — total below uses Per head only.</p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Amount (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedMainItems.map((item, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>{item.product_name}</td>
                        <td>{item.quantity === '' || item.quantity == null ? '—' : item.quantity}</td>
                        <td>{formatLkr(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} style={{ fontWeight: 700, textAlign: 'right', color: 'var(--primary)' }}>Subtotal</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatLkr(mainSavedTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)', marginTop: 8 }}>
              Day total (saved):
              {' '}
              {formatLkr(expenseTotal)}
            </p>

            {parsedPerHead.length > 0 && (
              <>
                <h3 style={{ margin: '24px 0 12px', fontSize: 16, color: 'var(--primary)' }}>Per head budget</h3>
                {parsedPerHead.map((block, bi) => (
                  <div key={bi} style={{ marginBottom: 20 }}>
                    <p style={{ fontWeight: 700, marginBottom: 8, color: 'var(--primary-light)' }}>
                      {userNameById[block.for_user_id] || 'Member'}
                      <span style={{ fontWeight: 500, color: 'var(--text-light)', marginLeft: 8 }}>
                        (
                        {formatLkr(block.items.reduce((s, i) => s + parseFloat(i.amount), 0))}
                        )
                      </span>
                    </p>
                    <div className={styles.tableWrapper}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Product</th>
                            <th>Qty</th>
                            <th>Amount (Rs.)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {block.items.map((item, idx) => (
                            <tr key={idx}>
                              <td>{idx + 1}</td>
                              <td>{item.product_name}</td>
                              <td>{item.quantity === '' || item.quantity == null ? '—' : item.quantity}</td>
                              <td>{formatLkr(item.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
                <p style={{ fontSize: 14, color: 'var(--text-light)', marginTop: 8 }}>
                  Per head subtotal:
                  {' '}
                  {formatLkr(perHeadSubtotal)}
                </p>
              </>
            )}

            {error && <p className="error-msg" style={{ marginTop: 12 }}>{error}</p>}
            <div className={styles.summaryActions}>
              <button type="button" className="btn-secondary" onClick={() => setShowSummary(false)}>✏️ Edit</button>
              <button type="button" className="btn-primary" onClick={handleConfirm} disabled={saving}>
                {saving ? 'Saving...' : '✅ Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Navbar />
      <div className="page-container">
        <h2 className="page-title">{editId ? '✏️ Edit Budget' : '➕ Add Budget'}</h2>
        <div className="card">
          <form onSubmit={handlePreview}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: 'var(--primary)' }}>Date</label>
              <input 
                type="date" 
                value={date} 
                min={!editId ? new Date().toISOString().split('T')[0] : undefined} 
                onChange={(e) => setDate(e.target.value)} 
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }} 
              />
            </div>
            <div className={styles.itemsHeader}>
              <span>Items (optional if you use Per head only)</span>
              <button type="button" className="btn-secondary" style={{ padding: '7px 14px', fontSize: 13 }} onClick={addItem}>
                + Add More
              </button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className={styles.itemRow}>
                <div className={styles.itemNum}>{idx + 1}</div>
                <input
                  placeholder="Product Name"
                  value={item.product_name}
                  onChange={(e) => updateItem(idx, 'product_name', e.target.value)}
                  style={{ flex: 2 }}
                />
                <input
                  placeholder="Qty (optional)"
                  type="text"
                  value={item.quantity}
                  onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                  style={{ flex: 1 }}
                />
                <input
                  placeholder="Amount (Rs.)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.amount}
                  onChange={(e) => updateItem(idx, 'amount', e.target.value)}
                  style={{ flex: 1 }}
                />
                {items.length > 1 && (
                  <button type="button" className="btn-danger" style={{ padding: '8px 12px' }} onClick={() => removeItem(idx)}>✕</button>
                )}
              </div>
            ))}
            <div className={styles.totalRow}>
              <span>Items subtotal</span>
              <span>{formatLkr(mainFormTotal)}</span>
            </div>

            <div className={styles.perHeadSection}>
              <div className={styles.itemsHeader}>
                <span>Per head budget</span>
                <button type="button" className="btn-secondary" style={{ padding: '7px 14px', fontSize: 13 }} onClick={addPerHeadBlock}>
                  + Add person
                </button>
              </div>
              <p className={styles.perHeadHint}>Optional. Pick a homie from the list, then add one or more products for them.</p>

              {perHeadBlocks.map((block, bi) => (
                <div key={bi} className={styles.perHeadBlock}>
                  <div className={styles.perHeadBlockTop}>
                    <label className={styles.perHeadLabel}>
                      <span>Name</span>
                      <select
                        className={styles.perHeadSelect}
                        value={block.for_user_id}
                        onChange={(e) => setPerHeadUser(bi, e.target.value)}
                      >
                        <option value="">Select name…</option>
                        {usersList.map((u) => (
                          <option key={u.id} value={u.id}>{u.username}</option>
                        ))}
                      </select>
                    </label>
                    <button type="button" className="btn-danger" style={{ padding: '8px 12px' }} onClick={() => removePerHeadBlock(bi)}>Remove person</button>
                  </div>
                  {block.items.map((item, ii) => (
                    <div key={ii} className={styles.itemRow}>
                      <div className={styles.itemNum}>{ii + 1}</div>
                      <input
                        placeholder="Product"
                        value={item.product_name}
                        onChange={(e) => updatePerHeadItem(bi, ii, 'product_name', e.target.value)}
                        style={{ flex: 2 }}
                      />
                      <input
                        placeholder="Qty (optional)"
                        type="text"
                        value={item.quantity}
                        onChange={(e) => updatePerHeadItem(bi, ii, 'quantity', e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <input
                        placeholder="Amount (Rs.)"
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.amount}
                        onChange={(e) => updatePerHeadItem(bi, ii, 'amount', e.target.value)}
                        style={{ flex: 1 }}
                      />
                      {block.items.length > 1 && (
                        <button type="button" className="btn-danger" style={{ padding: '8px 12px' }} onClick={() => removePerHeadItem(bi, ii)}>✕</button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn-secondary" style={{ padding: '7px 14px', fontSize: 13, marginTop: 4 }} onClick={() => addPerHeadItem(bi)}>
                    + Add product
                  </button>
                </div>
              ))}
            </div>

            {error && <p className="error-msg">{error}</p>}
            <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
              <button type="button" className="btn-secondary" onClick={() => navigate('/')}>Cancel</button>
              <button type="submit" className="btn-primary">Preview Summary →</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
