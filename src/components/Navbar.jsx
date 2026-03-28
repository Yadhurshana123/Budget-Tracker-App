import { useNavigate } from 'react-router-dom'
import CommentBell from './CommentBell'
import styles from './Navbar.module.css'

export default function Navbar() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('homies_user') || '{}')

  function handleLogout() {
    localStorage.removeItem('homies_user')
    navigate('/login')
  }

  return (
    <nav className={styles.navbar}>
      <div className={styles.brand} onClick={() => navigate('/')}>
        💰 Homies Budget App
      </div>
      <div className={styles.right}>
        <CommentBell />
        <button
          type="button"
          className={styles.profileBtn}
          onClick={() => navigate('/profile')}
          title="My profile & spending summary"
        >
          👤
          {' '}
          {user.username}
        </button>
        <button className={styles.logoutBtn} onClick={handleLogout}>Logout</button>
      </div>
    </nav>
  )
}
