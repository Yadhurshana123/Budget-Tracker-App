import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../js/supabaseClient'
import styles from './LoginPage.module.css'

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const user = JSON.parse(localStorage.getItem('homies_user') || '{}')

  async function handleChange(e) {
    e.preventDefault()
    setError('')
    if (newPass.length < 4) { setError('Password must be at least 4 characters.'); return }
    if (newPass !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    const { error: dbErr } = await supabase
      .from('users')
      .update({ password: newPass, is_first_login: false })
      .eq('id', user.id)
    if (dbErr) { setError('Update failed. Try again.'); setLoading(false); return }
    navigate('/')
    setLoading(false)
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>🔐</div>
        <h1 className={styles.title}>Set New Password</h1>
        <p className={styles.subtitle}>First login — please set your own password</p>
        <form onSubmit={handleChange} className={styles.form}>
          <div className={styles.field}>
            <label>New Password</label>
            <input type="password" placeholder="New password" value={newPass} onChange={e => setNewPass(e.target.value)} autoFocus />
          </div>
          <div className={styles.field}>
            <label>Confirm Password</label>
            <input type="password" placeholder="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)} />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px', marginTop: '8px' }} disabled={loading}>
            {loading ? 'Saving...' : 'Save & Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
