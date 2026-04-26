import { NavLink } from 'react-router-dom'
import {
  Home,
  UtensilsCrossed,
  Leaf,
  User,
} from './icons/Icons'

const links = [
  { to: '/app', end: true, label: 'Home', Icon: Home },
  { to: '/app/menu', label: 'Menu', Icon: UtensilsCrossed },
  { to: '/app/sustainability', label: 'Green', Icon: Leaf },
  { to: '/app/profile', label: 'Profile', Icon: User },
]

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
        {links.map(({ to, end, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex min-w-[4rem] flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-medium transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-slate-500 hover:text-slate-700'
              }`
            }
          >
            <Icon className="h-6 w-6" strokeWidth={1.75} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
