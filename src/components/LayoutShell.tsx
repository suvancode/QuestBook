import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  Inbox,
  ListChecks,
  Compass,
  FolderKanban,
  Hash,
  Star,
  BookOpen,
  Search,
  Laptop,
  RefreshCw,
  HardDriveDownload,
  Settings,
  Trash2,
  Sun,
  Moon,
  Menu,
  X,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { OfflineIndicator } from './OfflineIndicator';

interface LayoutShellProps {
  appName: string;
  theme: 'light' | 'dark' | 'system';
  onToggleTheme: () => void;
  inboxCount: number;
  pendingSyncCount: number;
  conflictCount: number;
  trashCount: number;
  children: React.ReactNode;
}

const NAV_GROUPS = [
  {
    label: 'Curiosity',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/capture', label: 'Quick Capture', icon: PlusCircle },
      { to: '/inbox', label: 'Inbox', icon: Inbox, badgeKey: 'inbox' as const },
      { to: '/questions', label: 'All Questions', icon: ListChecks },
      { to: '/explore', label: 'Explore', icon: Compass },
    ],
  },
  {
    label: 'Organization',
    items: [
      { to: '/categories', label: 'Categories', icon: FolderKanban },
      { to: '/tags', label: 'Tags', icon: Hash },
      { to: '/favorites', label: 'Favorites', icon: Star },
      { to: '/workspace', label: 'Research Workspace', icon: BookOpen },
      { to: '/search', label: 'Search', icon: Search },
    ],
  },
  {
    label: 'Devices & Vault',
    items: [
      { to: '/devices', label: 'Device Manager', icon: Laptop },
      { to: '/sync', label: 'Synchronization', icon: RefreshCw, badgeKey: 'sync' as const },
      { to: '/backup', label: 'Backup & Recovery', icon: HardDriveDownload },
      { to: '/settings', label: 'Settings', icon: Settings },
      { to: '/trash', label: 'Trash', icon: Trash2, badgeKey: 'trash' as const },
    ],
  },
];

const ROUTE_TITLES: Array<[string, string]> = [
  ['/capture', 'Quick Capture'],
  ['/inbox', 'Inbox'],
  ['/questions', 'All Questions'],
  ['/explore', 'Explore'],
  ['/categories', 'Categories'],
  ['/tags', 'Tags'],
  ['/favorites', 'Favorites'],
  ['/workspace', 'Research Workspace'],
  ['/search', 'Search'],
  ['/devices', 'Device Manager'],
  ['/sync', 'Synchronization'],
  ['/backup', 'Backup & Recovery'],
  ['/settings', 'Settings'],
  ['/trash', 'Trash'],
  ['/', 'Dashboard'],
];

export const LayoutShell: React.FC<LayoutShellProps> = ({
  appName,
  theme,
  onToggleTheme,
  inboxCount,
  pendingSyncCount,
  conflictCount,
  trashCount,
  children,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Global keyboard shortcuts: Cmd/Ctrl+K for Search, Alt+N for Quick Capture
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        navigate('/search');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  const currentTitle =
    ROUTE_TITLES.find(([prefix]) =>
      prefix === '/' ? location.pathname === '/' : location.pathname.startsWith(prefix),
    )?.[1] ?? 'Dashboard';

  const getBadge = (key?: 'inbox' | 'sync' | 'trash') => {
    if (key === 'inbox' && inboxCount > 0) return inboxCount;
    if (key === 'sync' && (conflictCount > 0 || pendingSyncCount > 0)) {
      return conflictCount > 0 ? `${conflictCount}!` : pendingSyncCount;
    }
    if (key === 'trash' && trashCount > 0) return trashCount;
    return null;
  };

  const renderSidebarLinks = () => (
    <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="px-3 mb-1.5 text-[11px] font-semibold tracking-wide text-slate-400 dark:text-slate-500">
            {group.label}
          </div>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const badge = getBadge(item.badgeKey);
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                      }`
                    }
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {badge !== null && (
                      <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                        {badge}
                      </span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-[#FAFAFB] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-[252px] lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="h-14 flex items-center px-5 border-b border-slate-200 dark:border-slate-800">
          <Link to="/" className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
            {appName}
          </Link>
        </div>
        {renderSidebarLinks()}
      </aside>

      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-72 max-w-[82vw] flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-full">
            <div className="h-14 flex items-center justify-between px-5 border-b border-slate-200 dark:border-slate-800">
              <span className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">{appName}</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderSidebarLinks()}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-[252px] flex flex-col min-w-0 pb-16 lg:pb-0">
        {/* Top Header — Clean 3-Zone Contract */}
        <header className="sticky top-0 z-30 h-14 flex items-center justify-between gap-4 sm:gap-8 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
          {/* Zone 1: Brand (mobile) / Breadcrumb Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate whitespace-nowrap">
              {currentTitle}
            </span>
          </div>

          {/* Zone 2: Quick Search Link */}
          <div className="hidden md:flex flex-1 max-w-md">
            <button
              type="button"
              onClick={() => navigate('/search')}
              className="w-full flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5" />
                <span>Search questions, tags, devices...</span>
              </span>
              <kbd className="font-mono text-[11px] text-slate-400">Ctrl K</kbd>
            </button>
          </div>

          {/* Zone 3: Theme + PWA Install + Primary Quick Capture CTA */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <PWAInstallButton />
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link
              to="/capture"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Quick Capture</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 py-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation (compact <= 60px, well under 15% mobile height) */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-14 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-5"
      >
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
            }`
          }
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Home</span>
        </NavLink>
        <NavLink
          to="/inbox"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
            }`
          }
        >
          <Inbox className="w-4 h-4" />
          <span>Inbox</span>
        </NavLink>
        <NavLink
          to="/capture"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
              isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-indigo-600 dark:text-indigo-400'
            }`
          }
        >
          <PlusCircle className="w-5 h-5" />
          <span>Capture</span>
        </NavLink>
        <NavLink
          to="/questions"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
            }`
          }
        >
          <ListChecks className="w-4 h-4" />
          <span>Questions</span>
        </NavLink>
        <NavLink
          to="/search"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
            }`
          }
        >
          <Search className="w-4 h-4" />
          <span>Search</span>
        </NavLink>
      </nav>

      <OfflineIndicator />
    </div>
  );
};
