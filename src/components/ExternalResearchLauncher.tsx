import React, { useMemo, useState } from 'react';
import { ExternalLink, CheckSquare, Globe, Copy, AlertTriangle, Check } from 'lucide-react';
import { ResearchActivity, ResearchActivityStatus, SearchProvider } from '../types/questbook';
import { buildProviderLaunchUrl, selectProvidersForLaunch } from '../core/urlLauncher';
import { QuestBookRepo } from '../db/repository';
import { useToast } from './ToastProvider';

interface ExternalResearchLauncherProps {
  questionId: string;
  questionTitle: string;
  activeSessionId: string | null;
  providers: SearchProvider[];
  activities: ResearchActivity[];
}

export const ExternalResearchLauncher: React.FC<ExternalResearchLauncherProps> = ({
  questionId,
  questionTitle,
  activeSessionId,
  providers,
  activities,
}) => {
  const { showToast } = useToast();
  const [checklistMode, setChecklistMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    providers.filter((p) => p.enabled).slice(0, 3).map((p) => p.id),
  );
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const enabledProviders = useMemo(
    () => [...providers].filter((p) => p.enabled).sort((a, b) => a.displayOrder - b.displayOrder),
    [providers],
  );
  const defaultProvider = useMemo(
    () => enabledProviders.find((p) => p.isDefault) ?? enabledProviders[0],
    [enabledProviders],
  );

  const launchProviderList = async (targets: SearchProvider[]) => {
    setLaunchError(null);
    if (targets.length === 0) {
      setLaunchError('Select at least one enabled platform to launch.');
      return;
    }

    const blockedNames: string[] = [];
    let openedCount = 0;

    for (const provider of targets) {
      try {
        const built = buildProviderLaunchUrl(provider, questionTitle);
        const win = window.open(built.url, '_blank', 'noopener,noreferrer');
        if (!win) {
          blockedNames.push(provider.name);
        } else {
          openedCount++;
        }

        if (!built.supportsQueryTemplate && navigator.clipboard) {
          await navigator.clipboard.writeText(questionTitle).catch(() => {});
          showToast(
            `${provider.name} opened`,
            'This platform uses homepage mode — question copied to clipboard.',
            'info',
          );
        }

        await QuestBookRepo.recordResearchActivity({
          questionId,
          sessionId: activeSessionId,
          providerId: provider.id,
          providerName: provider.name,
          searchQuery: questionTitle,
          launchedUrl: built.url,
        });
      } catch (err) {
        blockedNames.push(`${provider.name} (${err instanceof Error ? err.message : 'invalid URL'})`);
      }
    }

    if (blockedNames.length > 0) {
      setLaunchError(
        `Browser popup blocker or URL error prevented opening: ${blockedNames.join(', ')}. Allow popups for QuestBook or launch providers individually.`,
      );
    } else if (openedCount > 0) {
      showToast(
        `Launched ${openedCount} provider${openedCount > 1 ? 's' : ''}`,
        'Activity recorded as "Opened". Save your findings below when ready.',
        'success',
      );
    }
  };

  const handleCopyQuestion = async (id: string) => {
    try {
      await navigator.clipboard.writeText(questionTitle);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
      showToast('Copied question', 'Ready to paste into any research platform.', 'success');
    } catch {
      showToast('Clipboard unavailable', 'Select and copy the question title manually.', 'error');
    }
  };

  const handleStatusChange = async (activityId: string, status: ResearchActivityStatus) => {
    await QuestBookRepo.updateResearchActivityStatus(activityId, status);
    showToast('Research activity updated', `Marked as ${status.replace('_', ' ')}.`, 'info');
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Research With External Platforms</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Opens providers in new tabs with your question pre-filled. Responses are not scraped automatically.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {defaultProvider && (
            <button
              type="button"
              onClick={() => launchProviderList([defaultProvider])}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Search with {defaultProvider.name}
            </button>
          )}
          <button
            type="button"
            onClick={() => launchProviderList(selectProvidersForLaunch(providers, 'all_enabled'))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            Search All ({enabledProviders.length})
          </button>
          <button
            type="button"
            onClick={() => setChecklistMode((v) => !v)}
            aria-expanded={checklistMode}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              checklistMode
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Choose Platforms
          </button>
        </div>
      </div>

      {launchError && (
        <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{launchError}</span>
        </div>
      )}

      {checklistMode ? (
        <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Mode B — Select specific platforms to open
            </span>
            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => setSelectedIds(enabledProviders.map((p) => p.id))}
                className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Clear Selection
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {enabledProviders.map((provider) => {
              const checked = selectedIds.includes(provider.id);
              return (
                <label
                  key={provider.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs cursor-pointer hover:border-indigo-400"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setSelectedIds((prev) =>
                        e.target.checked ? [...prev, provider.id] : prev.filter((id) => id !== provider.id),
                      );
                    }}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="truncate font-medium text-slate-800 dark:text-slate-200">{provider.name}</span>
                </label>
              );
            })}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => launchProviderList(selectProvidersForLaunch(providers, 'selected', selectedIds))}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Launch Selected ({selectedIds.length})
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {enabledProviders.map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between gap-1 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
            >
              <button
                type="button"
                onClick={() => launchProviderList([provider])}
                className="flex items-center gap-2 min-w-0 flex-1 text-left"
              >
                <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                  {provider.name}
                  {provider.isDefault ? ' (Default)' : ''}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleCopyQuestion(provider.id)}
                aria-label={`Copy question for ${provider.name}`}
                title="Copy question"
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0"
              >
                {copiedId === provider.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Research Activity History */}
      <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800">
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Research Launch History ({activities.length})
        </h3>
        {activities.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No external searches launched for this question yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            {activities.slice(0, 8).map((act) => (
              <div key={act.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs bg-slate-50/50 dark:bg-slate-950/30">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{act.providerName}</span>
                  <span aria-hidden="true" className="text-slate-400">·</span>
                  <span className="tabular-nums text-slate-500 dark:text-slate-400">
                    {new Date(act.launchedAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`act-status-${act.id}`}>
                    Research status for {act.providerName}
                  </label>
                  <select
                    id={`act-status-${act.id}`}
                    value={act.status}
                    onChange={(e) => handleStatusChange(act.id, e.target.value as ResearchActivityStatus)}
                    className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-200"
                  >
                    <option value="opened">Opened</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
