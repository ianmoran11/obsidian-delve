import type { Vault } from 'obsidian';
import { LOCK_FILE } from '../constants';
import type { CourseId, LockData, StageId } from '../interfaces';

export class LockService {
  constructor(private vault: Vault) {}

  async acquire(courseId: CourseId, stage: StageId): Promise<void> {
    const lock: LockData = {
      courseId,
      stage,
      timestamp: new Date().toISOString(),
    };
    await this.vault.adapter.write(LOCK_FILE, JSON.stringify(lock));
  }

  async release(): Promise<void> {
    try {
      await this.vault.adapter.remove(LOCK_FILE);
    } catch {
      // Already gone — that's fine
    }
  }

  async read(): Promise<LockData | null> {
    try {
      const exists = await this.vault.adapter.exists(LOCK_FILE);
      if (!exists) return null;
      const raw = await this.vault.adapter.read(LOCK_FILE);
      return JSON.parse(raw) as LockData;
    } catch {
      return null;
    }
  }

  async isLocked(): Promise<boolean> {
    return (await this.read()) !== null;
  }
}
