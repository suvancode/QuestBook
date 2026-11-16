import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { db, LocalDeviceSecret } from '../db/database';
import { DEFAULT_PREFERENCES, decryptQuestionIfNeeded, ensureDatabaseInitialized } from '../db/repository';
import {
  Attachment,
  BackupRecord,
  Category,
  ConflictRecord,
  DeviceHistoryEvent,
  DeviceRecord,
  GeneralPreferences,
  Question,
  QuestionDeviceHistoryEvent,
  QuestionTag,
  RelatedQuestion,
  Reminder,
  ResearchActivity,
  ResearchNote,
  ResearchResource,
  ResearchSession,
  SearchProvider,
  SyncCheckpoint,
  SyncOperation,
  Tag,
} from '../types/questbook';

export interface QuestBookSnapshot {
  ready: boolean;
  localSecret: LocalDeviceSecret | null;
  preferences: GeneralPreferences;
  questions: Question[];
  categories: Category[];
  tags: Tag[];
  questionTags: QuestionTag[];
  attachments: Attachment[];
  researchSessions: ResearchSession[];
  researchNotes: ResearchNote[];
  researchResources: ResearchResource[];
  relatedQuestions: RelatedQuestion[];
  reminders: Reminder[];
  searchProviders: SearchProvider[];
  researchActivities: ResearchActivity[];
  devices: DeviceRecord[];
  deviceHistory: DeviceHistoryEvent[];
  questionDeviceHistory: QuestionDeviceHistoryEvent[];
  syncOperations: SyncOperation[];
  syncCheckpoints: SyncCheckpoint[];
  conflicts: ConflictRecord[];
  backups: BackupRecord[];
}

const EMPTY_SNAPSHOT: QuestBookSnapshot = {
  ready: false,
  localSecret: null,
  preferences: DEFAULT_PREFERENCES,
  questions: [],
  categories: [],
  tags: [],
  questionTags: [],
  attachments: [],
  researchSessions: [],
  researchNotes: [],
  researchResources: [],
  relatedQuestions: [],
  reminders: [],
  searchProviders: [],
  researchActivities: [],
  devices: [],
  deviceHistory: [],
  questionDeviceHistory: [],
  syncOperations: [],
  syncCheckpoints: [],
  conflicts: [],
  backups: [],
};

export function useQuestBookData(): QuestBookSnapshot {
  const [snapshot, setSnapshot] = useState<QuestBookSnapshot>(EMPTY_SNAPSHOT);

  useEffect(() => {
    let active = true;
    let subscription: { unsubscribe: () => void } | null = null;

    ensureDatabaseInitialized().then(() => {
      if (!active) return;
      const observable = liveQuery(async () => {
        const [
          localSecret,
          prefRow,
          rawQuestions,
          categories,
          tags,
          questionTags,
          attachments,
          researchSessions,
          researchNotes,
          researchResources,
          relatedQuestions,
          reminders,
          searchProviders,
          researchActivities,
          devices,
          deviceHistory,
          questionDeviceHistory,
          syncOperations,
          syncCheckpoints,
          conflicts,
          backups,
        ] = await Promise.all([
          db.localSecrets.get('self'),
          db.preferences.get('general'),
          db.questions.toArray(),
          db.categories.filter((c) => c.deletedAt === null).toArray(),
          db.tags.filter((t) => t.deletedAt === null).toArray(),
          db.questionTags.filter((qt) => qt.deletedAt === null).toArray(),
          db.attachments.filter((a) => a.deletedAt === null).toArray(),
          db.researchSessions.filter((s) => s.deletedAt === null).toArray(),
          db.researchNotes.filter((n) => n.deletedAt === null).toArray(),
          db.researchResources.filter((r) => r.deletedAt === null).toArray(),
          db.relatedQuestions.filter((rq) => rq.deletedAt === null).toArray(),
          db.reminders.filter((rm) => rm.deletedAt === null).toArray(),
          db.searchProviders.orderBy('displayOrder').toArray(),
          db.researchActivities.reverse().sortBy('launchedAt'),
          db.devices.toArray(),
          db.deviceHistory.reverse().sortBy('timestamp'),
          db.questionDeviceHistory.toArray(),
          db.syncOperations.toArray(),
          db.syncCheckpoints.toArray(),
          db.conflicts.toArray(),
          db.backups.reverse().sortBy('createdAt'),
        ]);

        let preferences = DEFAULT_PREFERENCES;
        if (prefRow) {
          try {
            preferences = { ...DEFAULT_PREFERENCES, ...JSON.parse(prefRow.value) };
          } catch {
            preferences = DEFAULT_PREFERENCES;
          }
        }

        const secret = localSecret ?? null;
        const questions = rawQuestions.map((q) => decryptQuestionIfNeeded(q, secret));

        return {
          ready: true,
          localSecret: secret,
          preferences,
          questions,
          categories,
          tags,
          questionTags,
          attachments,
          researchSessions,
          researchNotes,
          researchResources,
          relatedQuestions,
          reminders,
          searchProviders,
          researchActivities: [...researchActivities].reverse(),
          devices,
          deviceHistory: [...deviceHistory].reverse(),
          questionDeviceHistory,
          syncOperations,
          syncCheckpoints,
          conflicts,
          backups: [...backups].reverse(),
        };
      });

      subscription = observable.subscribe({
        next: (data) => {
          if (active) setSnapshot(data);
        },
        error: (err) => {
          console.error('Dexie liveQuery error:', err);
        },
      });
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  return snapshot;
}
