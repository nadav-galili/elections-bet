import { BarChart3, Users, UsersRound, Vote } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/admin', label: 'בחירות', icon: Vote, end: true },
  { to: '/admin/groups', label: 'קבוצות', icon: UsersRound, end: false },
  { to: '/admin/users', label: 'משתמשים', icon: Users, end: false },
  { to: '/admin/overview', label: 'סקירה', icon: BarChart3, end: false },
];

/** Shared layout for the super-admin god-mode surface: tab nav + nested route. */
export default function AdminLayout() {
  return (
    <div className="space-y-8">
      <nav className="flex flex-wrap gap-2 border-b pb-3" aria-label="ניהול">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-base font-semibold transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
