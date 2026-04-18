import { describe, it, expect, vi } from 'vitest';
import { CacheService } from '../src/services/cache';
import { LockService } from '../src/services/lock';
import { validate, TaxonomyResponseSchema } from '../src/services/validator';
import { makeDataStore, makeMockVaultAdapter, makeTaxonomy, makeStage0Cache } from './helpers';

// ─── TaxonomyResponseSchema ───────────────────────────────────────────────────

describe('TaxonomyResponseSchema', () => {
  it('validates a well-formed taxonomy', () => {
    const raw = { taxonomy: makeTaxonomy() };
    const result = validate(TaxonomyResponseSchema, raw);
    expect(result.taxonomy).toHaveLength(2);
    expect(result.taxonomy[0].id).toBe('ml');
    expect(result.taxonomy[0].children).toHaveLength(2);
  });

  it('accepts leaf nodes without children', () => {
    const raw = { taxonomy: [{ id: 'a', title: 'Alpha', description: 'Desc.' }] };
    expect(() => validate(TaxonomyResponseSchema, raw)).not.toThrow();
  });

  it('accepts nodes with empty children array', () => {
    const raw = { taxonomy: [{ id: 'a', title: 'Alpha', description: 'Desc.', children: [] }] };
    expect(() => validate(TaxonomyResponseSchema, raw)).not.toThrow();
  });

  it('rejects a node missing description', () => {
    const raw = { taxonomy: [{ id: 'a', title: 'Alpha' }] };
    expect(() => validate(TaxonomyResponseSchema, raw)).toThrow();
  });

  it('rejects a non-array taxonomy field', () => {
    expect(() => validate(TaxonomyResponseSchema, { taxonomy: 'nope' })).toThrow();
  });

  it('rejects an empty taxonomy array', () => {
    expect(() => validate(TaxonomyResponseSchema, { taxonomy: [] })).toThrow();
  });

  it('rejects missing taxonomy key', () => {
    expect(() => validate(TaxonomyResponseSchema, {})).toThrow();
  });
});

// ─── CacheService ─────────────────────────────────────────────────────────────

describe('CacheService', () => {
  it('writes and reads a Stage 0 cache entry', async () => {
    const store = makeDataStore();
    const cache = new CacheService(store.load, store.save);
    const entry = makeStage0Cache();

    await cache.writeStage(entry.courseId, 0, entry);
    const result = await cache.readStage(entry.courseId, 0);

    expect(result?.seedTopic).toBe('Machine Learning');
    expect(result?.selectedScope).toContain('ml-supervised');
    expect(result?.completedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('returns null for a course that does not exist', async () => {
    const store = makeDataStore();
    const cache = new CacheService(store.load, store.save);
    const result = await cache.readStage('ghost-course', 0);
    expect(result).toBeNull();
  });

  it('stores multiple courses independently', async () => {
    const store = makeDataStore();
    const cache = new CacheService(store.load, store.save);

    const a = makeStage0Cache({ courseId: 'course-a', seedTopic: 'Alpha' });
    const b = makeStage0Cache({ courseId: 'course-b', seedTopic: 'Beta' });
    await cache.writeStage('course-a', 0, a);
    await cache.writeStage('course-b', 0, b);

    expect((await cache.readStage('course-a', 0))?.seedTopic).toBe('Alpha');
    expect((await cache.readStage('course-b', 0))?.seedTopic).toBe('Beta');
  });

  it('tracks active course id', async () => {
    const store = makeDataStore();
    const cache = new CacheService(store.load, store.save);
    await cache.setActiveCourseId('my-course');
    expect(await cache.getActiveCourseId()).toBe('my-course');
  });

  it('deletes a course and clears active id', async () => {
    const store = makeDataStore();
    const cache = new CacheService(store.load, store.save);
    const entry = makeStage0Cache();
    await cache.writeStage(entry.courseId, 0, entry);
    await cache.setActiveCourseId(entry.courseId);

    await cache.deleteCourse(entry.courseId);

    expect(await cache.readCourse(entry.courseId)).toBeNull();
    expect(await cache.getActiveCourseId()).toBeNull();
  });
});

// ─── LockService ──────────────────────────────────────────────────────────────

describe('LockService', () => {
  it('returns null when no lock exists', async () => {
    const { adapter } = makeMockVaultAdapter();
    const lock = new LockService({ adapter } as never);
    expect(await lock.read()).toBeNull();
    expect(await lock.isLocked()).toBe(false);
  });

  it('acquires a lock with correct fields', async () => {
    const { adapter } = makeMockVaultAdapter();
    const lock = new LockService({ adapter } as never);
    await lock.acquire('test-course', 0);

    const data = await lock.read();
    expect(data?.courseId).toBe('test-course');
    expect(data?.stage).toBe(0);
    expect(data?.acquiredAt).toBeTruthy();
    expect(await lock.isLocked()).toBe(true);
  });

  it('overwrites existing lock on re-acquire', async () => {
    const { adapter } = makeMockVaultAdapter();
    const lock = new LockService({ adapter } as never);
    await lock.acquire('course-a', 0);
    await lock.acquire('course-b', 1);

    const data = await lock.read();
    expect(data?.courseId).toBe('course-b');
    expect(data?.stage).toBe(1);
  });

  it('releases the lock', async () => {
    const { adapter } = makeMockVaultAdapter();
    const lock = new LockService({ adapter } as never);
    await lock.acquire('test-course', 0);
    await lock.release();

    expect(await lock.read()).toBeNull();
    expect(await lock.isLocked()).toBe(false);
  });

  it('release is idempotent when no lock exists', async () => {
    const { adapter } = makeMockVaultAdapter();
    const lock = new LockService({ adapter } as never);
    await expect(lock.release()).resolves.toBeUndefined();
  });
});
