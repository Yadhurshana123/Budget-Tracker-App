import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import styles from './DashboardPage.module.css'

const menuItems = [
  { icon: '➕', label: 'Add Budget', desc: 'Add your expenses', path: '/add-budget', color: '#1E3A5F' },
  { icon: '📋', label: 'View Past History', desc: 'See your past entries', path: '/history', color: '#2E6DA4' },
  { icon: '👀', label: "View Homies' Budgets", desc: 'See what your crew spent', path: '/others', color: '#4A90D9' },
  { icon: '🎁', label: 'Allocated To Me', desc: 'See what homies bought for you', path: '/allocated-to-me', color: '#16a085' },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('homies_user') || '{}')
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div>
      <Navbar />
      <div className="page-container">
        <div className={styles.welcome}>
          <div>
            <h2 className={styles.welcomeTitle}>Welcome, {user.username}! 👋</h2>
            <p className={styles.date}>{today}</p>
          </div>
        </div>

        <div className={styles.grid}>
          {menuItems.map(item => (
            <div key={item.path} className={styles.menuCard} onClick={() => navigate(item.path)} style={{ borderTop: `4px solid ${item.color}` }}>
              <div className={styles.menuIcon}>{item.icon}</div>
              <div className={styles.menuLabel}>{item.label}</div>
              <div className={styles.menuDesc}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
