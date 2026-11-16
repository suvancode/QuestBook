import test from 'node:test';
import assert from 'node:assert/strict';
import { findPotentialDuplicates, searchAndFilterQuestions } from './search';
import { Question } from '../types/questbook';

function sampleQuestion(idx: number, overrides: Partial<Question> = {}): Question {
  return {
    id: `q-${idx}`,
    title: `Question ${idx}`,
    description: `Description ${idx}`,
    categoryId: 'cat-general',
    priority: 'medium',
    status: 'unexplored',
    sourceType: 'text',
    isPinned: false,
    isFavorite: false,
    conclusion: '',
    keyFindings: [],
    revision: 1,
    versionVector: { d1: 1 },
    createdAt: 1000 + idx,
    updatedAt: 1000 + idx,
    archivedAt: null,
    deletedAt: null,
    lastResearchedAt: null,
    createdDeviceId: 'd1',
    createdDeviceName: 'Laptop',
    lastModifiedDeviceId: 'd1',
    lastSyncedFromDeviceId: null,
    lastSyncedFromDeviceName: null,
    lastSyncedAt: null,
    ...overrides,
  };
}

test('searchAndFilterQuestions searches titles, tags, categories, and filters 1,000+ questions fast', () => {
  const list: Question[] = [];
  for (let i = 0; i < 1200; i++) {
    list.push(
      sampleQuestion(i, {
        title: i === 777 ? 'How does 3D Secure authentication work?' : `Topic ${i} engineering question`,
        priority: i === 777 ? 'high' : 'low',
        status: i === 777 ? 'exploring' : 'new',
      }),
    );
  }

  const start = Date.now();
  const res = searchAndFilterQuestions(list, {
    query: '3D Secure',
    priority: 'high',
    status: 'exploring',
  });
  const elapsed = Date.now() - start;

  assert.equal(res.length, 1);
  assert.equal(res[0].id, 'q-777');
  assert.ok(elapsed < 100, `Expected search < 100ms, got ${elapsed}ms`);
});

test('findPotentialDuplicates detects similar question titles', () => {
  const existing = [
    sampleQuestion(1, { title: 'How do banks verify online payments securely?' }),
    sampleQuestion(2, { title: 'Why is the sky blue during daytime?' }),
  ];

  const dupes = findPotentialDuplicates('How do banks verify online payments?', existing);
  assert.equal(dupes.length, 1);
  assert.equal(dupes[0].question.id, 'q-1');
});
