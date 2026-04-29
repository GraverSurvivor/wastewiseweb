import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export function StudentLayout() {
  return (
    <div className="app-shell">
      <div className="content-shell">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
