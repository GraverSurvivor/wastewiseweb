import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { Login } from './pages/Login'
import { AdminUnauthorized } from './pages/AdminUnauthorized'
import { StudentLayout } from './components/StudentLayout'
import { AdminLayout } from './components/AdminLayout'
import { StudentHome } from './pages/student/Home'
import { MenuPage } from './pages/student/Menu'
import { SustainabilityPage } from './pages/student/Sustainability'
import { GuestPassPage } from './pages/student/GuestPass'
import { ProfilePage } from './pages/student/Profile'
import { ComplaintsPage } from './pages/student/Complaints'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { Scanner } from './pages/Scanner'
import { Skeleton } from './components/Skeleton'
import { ResetPassword } from './pages/ResetPassword'

// inside your routes:
<Route path="/reset-password" element={<ResetPassword />} />

function RequireAuth({ children }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return (
      <div className="mx-auto max-w-[390px] space-y-3 p-4">
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return children
}

function RequireAdmin({ children }) {
  const { isAdmin, loading } = useAuth()
  if (loading) {
    return (
      <div className="mx-auto max-w-[390px] space-y-3 p-4">
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>
    )
  }
  if (!isAdmin) return <AdminUnauthorized />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/scanner"
        element={
          <RequireAuth>
            <Scanner />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          </RequireAuth>
        }
      >
        <Route index element={<AdminDashboard />} />
      </Route>
      <Route
        path="/app"
        element={
          <RequireAuth>
            <StudentLayout />
          </RequireAuth>
        }
      >
        <Route index element={<StudentHome />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="sustainability" element={<SustainabilityPage />} />
        <Route path="guest" element={<GuestPassPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="complaints" element={<ComplaintsPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return <AppRoutes />
}
