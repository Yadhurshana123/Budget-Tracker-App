import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import AddBudgetPage from './pages/AddBudgetPage'
import PastHistoryPage from './pages/PastHistoryPage'
import OthersBudgetPage from './pages/OthersBudgetPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import ProfilePage from './pages/ProfilePage'

function PrivateRoute({ children }) {
  const user = localStorage.getItem('homies_user')
  return user ? children : <Navigate to="/login" />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/add-budget" element={<PrivateRoute><AddBudgetPage /></PrivateRoute>} />
        <Route path="/history" element={<PrivateRoute><PastHistoryPage /></PrivateRoute>} />
        <Route path="/others" element={<PrivateRoute><OthersBudgetPage /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
