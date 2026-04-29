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
      className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.35rem)]"
      aria-label="Main"
    >
      <div className="floating-nav">
        {links.map(({ to, end, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `interactive-button flex min-w-[4.35rem] flex-1 flex-col items-center gap-1 rounded-[20px] px-2 py-2.5 text-[10px] font-semibold tracking-[0.08em] uppercase transition-all ${
                isActive
                  ? 'bg-primary text-white shadow-[0_18px_36px_-24px_rgba(26,122,82,0.9)]'
                  : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-800'
              }`
            }
          >
            <Icon className="h-[22px] w-[22px]" strokeWidth={1.85} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
