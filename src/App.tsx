import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/ToastProvider';
import { LayoutShell } from './components/LayoutShell';
import { AppLockScreen } from './components/AppLockScreen';
import { useQuestBookData } from './hooks/useQuestBookData';
import { QuestBookRepo } from './db/repository';
import { DashboardPage } from './pages/DashboardPage';
import { QuickCapturePage } from './pages/QuickCapturePage';
import { QuestionsListPage } from './pages/QuestionsListPage';
import { ExplorePage } from './pages/ExplorePage';
import { CategoriesPage, TagsPage } from './pages/CategoriesTagsPages';
import { SearchPage } from './pages/SearchPage';
import { ResearchWorkspacePage } from './pages/ResearchWorkspacePage';
import { DeviceManagerPage } from './pages/DeviceManagerPage';
import { SynchronizationPage } from './pages/SynchronizationPage';
import { BackupRecoveryPage } from './pages/BackupRecoveryPage';
import { SettingsPage } from './pages/SettingsPage';

function QuestBookAppShell() {
  const data = useQuestBookData();
  const [unlocked, setUnlocked] = useState(false);

  // Sync Tailwind .dark class on <html>
  const effectiveDark = useMemo(() => {
    if (data.preferences.theme === 'dark') return true;
    if (data.preferences.theme === 'light') return false;
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }, [data.preferences.theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (effectiveDark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [effectiveDark]);

  if (!data.ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFB] dark:bg-[#0B1120]">
        <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Opening local QuestBook vault...
        </div>
      </div>
    );
  }

  if (data.preferences.appLockEnabled && !unlocked) {
    return <AppLockScreen onUnlock={() => setUnlocked(true)} />;
  }

  const inboxCount = data.questions.filter(
    (q) => q.deletedAt === null && q.archivedAt === null && (q.status === 'new' || q.status === 'unexplored'),
  ).length;
  const trashCount = data.questions.filter((q) => q.deletedAt !== null).length;
  const conflictCount = data.conflicts.filter((c) => !c.resolved).length;
  const pendingSyncCount = data.syncOperations.length;

  const handleToggleTheme = () => {
    const next = effectiveDark ? 'light' : 'dark';
    QuestBookRepo.updatePreferences({ theme: next });
  };

  return (
    <LayoutShell
      appName={data.preferences.appName}
      theme={effectiveDark ? 'dark' : 'light'}
      onToggleTheme={handleToggleTheme}
      inboxCount={inboxCount}
      pendingSyncCount={pendingSyncCount}
      conflictCount={conflictCount}
      trashCount={trashCount}
    >
      <Routes>
        <Route path="/" element={<DashboardPage data={data} />} />
        <Route path="/capture" element={<QuickCapturePage data={data} />} />
        <Route path="/inbox" element={<QuestionsListPage data={data} mode="inbox" />} />
        <Route path="/questions" element={<QuestionsListPage data={data} mode="all" />} />
        <Route path="/explore" element={<ExplorePage data={data} />} />
        <Route path="/categories" element={<CategoriesPage data={data} />} />
        <Route path="/tags" element={<TagsPage data={data} />} />
        <Route path="/favorites" element={<QuestionsListPage data={data} mode="favorites" />} />
        <Route path="/workspace" element={<ResearchWorkspacePage data={data} />} />
        <Route path="/workspace/:questionId" element={<ResearchWorkspacePage data={data} />} />
        <Route path="/search" element={<SearchPage data={data} />} />
        <Route path="/devices" element={<DeviceManagerPage data={data} />} />
        <Route path="/sync" element={<SynchronizationPage data={data} />} />
        <Route path="/backup" element={<BackupRecoveryPage data={data} />} />
        <Route path="/settings" element={<SettingsPage data={data} />} />
        <Route path="/trash" element={<QuestionsListPage data={data} mode="trash" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </LayoutShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <QuestBookAppShell />
      </ToastProvider>
    </BrowserRouter>
  );
}
