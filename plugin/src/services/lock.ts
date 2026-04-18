import type { Vault } from 'obsidian';
import { LOCK_FILE } from '../constants';
import type { CourseId, StageId } from '../interfaces';

export interface LockData {
  courseId: CourseId;
  stage: StageId;
  acquiredAt: string;
}

export class LockService {
  constructor(private vault: Vault) {}

  async acquire(courseId: CourseId, stage: StageId): Promise<void> {
    const lock: LockData = {
      courseId,
      stage,
      acquiredAt: new Date().toISOString(),
    };
    await this.vault.adapter.write(LOCK_FILE, JSON.stringify(lock));
  }

  async release(): Promise<void> {
    try {
      await this.vault.adapter.remove(LOCK_FILE);
    } catch {
      // Lock already gone — nothing to do
    }
  }

  async read(): Promise<LockData | null> {
    try {
      const text = await this.vault.adapter.read(LOCK_FILE);
      return JSON.parse(text) as LockData;
    } catch {
      return null;
    }
  }

  async isLocked(): Promise<boolean> {
    return (await this.read()) !== null;
  }
}
