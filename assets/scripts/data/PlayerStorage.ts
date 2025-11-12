import { sys } from 'cc';

/**
 * 简单的本地存储管理器：负责读取/保存玩家货币等数据。
 */
export class PlayerStorage {
  private static readonly VERSION_KEY = 'player:storageVersion';
  private static readonly VERSION = '1';

  private static readonly DIAMONDS_KEY = 'player:diamonds';
  private static readonly COINS_KEY = 'player:coins';

  private static ensureVersion(): void {
    const ver = sys.localStorage.getItem(this.VERSION_KEY);
    if (ver !== this.VERSION) {
      sys.localStorage.setItem(this.VERSION_KEY, this.VERSION);
    }
  }

  static loadDiamonds(defaultValue: number = 0): number {
    try {
      this.ensureVersion();
      const raw = sys.localStorage.getItem(this.DIAMONDS_KEY);
      if (!raw) return defaultValue;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  static saveDiamonds(value: number): void {
    try {
      this.ensureVersion();
      const v = Math.max(0, Math.floor(value || 0));
      sys.localStorage.setItem(this.DIAMONDS_KEY, String(v));
    } catch {}
  }

  static loadCoins(defaultValue: number = 0): number {
    try {
      this.ensureVersion();
      const raw = sys.localStorage.getItem(this.COINS_KEY);
      if (!raw) return defaultValue;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  static saveCoins(value: number): void {
    try {
      this.ensureVersion();
      const v = Math.max(0, Math.floor(value || 0));
      sys.localStorage.setItem(this.COINS_KEY, String(v));
    } catch {}
  }
}