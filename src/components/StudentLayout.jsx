import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export function StudentLayout() {
  return (
    <div className="min-h-[100dvh] pb-24">
      <div className="page-enter mx-auto max-w-[390px] px-3 pt-3 sm:max-w-2xl">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
