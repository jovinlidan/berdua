import { motion } from 'framer-motion'
import { CalendarDays, Home, ListTodo, MapPin, Repeat, Star } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useT } from '../lib/i18n'

const TABS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, end: false },
  { to: '/todos', label: 'Wishlist', icon: ListTodo, end: false },
  { to: '/routines', label: 'Routines', icon: Repeat, end: false },
  { to: '/bucket', label: 'Bucket', icon: Star, end: false },
  { to: '/map', label: 'Map', icon: MapPin, end: false },
]

export function BottomNav() {
  const t = useT()
  const { pathname } = useLocation()
  const isActive = (to: string, end: boolean) =>
    end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/5 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-1 pb-[calc(0.4rem+env(safe-area-inset-bottom))] pt-1.5">
        {TABS.map(({ to, label, icon: Icon, end }) => {
          const active = isActive(to, end)
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className="relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5"
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-1 -z-0 rounded-2xl bg-coral/12"
                  transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                />
              )}
              <Icon
                size={22}
                strokeWidth={2.1}
                className={`relative z-10 transition ${active ? 'text-coral' : 'text-ink-soft'}`}
              />
              <span
                className={`relative z-10 whitespace-nowrap text-[10px] font-bold ${active ? 'text-coral' : 'text-ink-soft'}`}
              >
                {t(label)}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
