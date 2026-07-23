import { createBrowserRouter, RouterProvider, Outlet, NavLink } from 'react-router-dom'
import { useEffect } from 'react'
import { Sun, Moon, BookOpen, ScrollText, BarChart3, TimerReset, LayoutDashboard, NotebookPen, Flame, Shield, LogOut } from 'lucide-react'
import { useTheme } from './hooks/useTheme'
import { cn } from './lib/utils'
import { useEvents } from './lib/eventLog'
import { checkAchievements } from './lib/achievements'
import { supabase } from './lib/supabase'
import { useSession, canManageContent } from './lib/session'
import Dashboard from './pages/Dashboard'
import QuestionBank from './pages/QuestionBank'
import History from './pages/History'
import Insights from './pages/Insights'
import MockExam from './pages/MockExam'
import MockHistory from './pages/MockHistory'
import MockSittingDetail from './pages/MockSittingDetail'
import Notes from './pages/Notes'
import HabitTracker from './pages/HabitTracker'
import Admin from './pages/Admin'

function Nav() {
  const [theme, toggleTheme] = useTheme()
  const { role } = useSession()
  const link = ({ isActive }) => cn(
    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-600 transition-colors',
    isActive ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-secondary'
  )
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="font-display font-700 text-text-primary mr-3">ESATprep</span>
          <NavLink to="/" className={link} end><LayoutDashboard size={14} /> Dashboard</NavLink>
          <NavLink to="/practice" className={link}><BookOpen size={14} /> Practice</NavLink>
          <NavLink to="/mock" className={link}><TimerReset size={14} /> Mock</NavLink>
          <NavLink to="/insights" className={link}><BarChart3 size={14} /> Insights</NavLink>
          <NavLink to="/notes" className={link}><NotebookPen size={14} /> Notes</NavLink>
          <NavLink to="/habits" className={link}><Flame size={14} /> Habits</NavLink>
          <NavLink to="/history" className={link}><ScrollText size={14} /> Ledger</NavLink>
          {canManageContent(role) && <NavLink to="/admin" className={link}><Shield size={14} /> Admin</NavLink>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-hover transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-hover transition-colors"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  )
}

function AchievementWatcher() {
  const events = useEvents()
  useEffect(() => {
    checkAchievements()
  }, [events])
  return null
}

function RootLayout() {
  return (
    <>
      <AchievementWatcher />
      <Nav />
      <main className="min-h-[calc(100vh-3.5rem)]">
        <Outlet />
      </main>
    </>
  )
}

// Data router required so MockExam can useBlocker mid-sitting (abandon on leave).
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/practice', element: <QuestionBank /> },
      { path: '/mock', element: <MockExam /> },
      { path: '/mocks', element: <MockHistory /> },
      { path: '/mocks/:sittingId', element: <MockSittingDetail /> },
      { path: '/insights', element: <Insights /> },
      { path: '/notes', element: <Notes /> },
      { path: '/habits', element: <HabitTracker /> },
      { path: '/history', element: <History /> },
      { path: '/admin', element: <Admin /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
