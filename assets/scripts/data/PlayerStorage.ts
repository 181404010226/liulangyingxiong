import { sys } from 'cc';

/**
 * 简单的本地存储管理器：负责读取/保存玩家货币等数据。
 */
export class PlayerStorage {
  private static readonly VERSION_KEY = 'player:storageVersion';
  private static readonly VERSION = '1';

  private static readonly DIAMONDS_KEY = 'player:diamonds';
  private static readonly COINS_KEY = 'player:coins';
  private static readonly CHALLENGE_TICKETS_KEY = 'materials:challengeTickets';
  private static readonly LOTTERY_TICKETS_KEY = 'materials:lotteryTickets';
  private static readonly ASCEND_STONES_KEY = 'materials:ascendStones';
  private static readonly FRAGMENTS_KEY = 'materials:fragments';

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

  static loadChallengeTickets(defaultValue: number = 0): number {
    try {
      this.ensureVersion();
      const raw = sys.localStorage.getItem(this.CHALLENGE_TICKETS_KEY);
      if (!raw) return defaultValue;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  static saveChallengeTickets(value: number): void {
    try {
      this.ensureVersion();
      const v = Math.max(0, Math.floor(value || 0));
      sys.localStorage.setItem(this.CHALLENGE_TICKETS_KEY, String(v));
    } catch {}
  }

  static loadLotteryTickets(defaultValue: number = 0): number {
    try {
      this.ensureVersion();
      const raw = sys.localStorage.getItem(this.LOTTERY_TICKETS_KEY);
      if (!raw) return defaultValue;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  static saveLotteryTickets(value: number): void {
    try {
      this.ensureVersion();
      const v = Math.max(0, Math.floor(value || 0));
      sys.localStorage.setItem(this.LOTTERY_TICKETS_KEY, String(v));
    } catch {}
  }

  static loadAscendStones(defaultValue: number = 0): number {
    try {
      this.ensureVersion();
      const raw = sys.localStorage.getItem(this.ASCEND_STONES_KEY);
      if (!raw) return defaultValue;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  static saveAscendStones(value: number): void {
    try {
      this.ensureVersion();
      const v = Math.max(0, Math.floor(value || 0));
      sys.localStorage.setItem(this.ASCEND_STONES_KEY, String(v));
    } catch {}
  }

  static loadFragmentsMap(defaultValue: Record<string, number> = {}): Record<string, number> {
    try {
      this.ensureVersion();
      const raw = sys.localStorage.getItem(this.FRAGMENTS_KEY);
      if (!raw) return defaultValue;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return defaultValue;
      const out: Record<string, number> = {};
      for (const k of Object.keys(obj)) {
        const n = Math.max(0, Math.floor(Number((obj as any)[k] || 0)));
        const key = (k || '').trim();
        if (key) out[key] = n;
      }
      return out;
    } catch {
      return defaultValue;
    }
  }

  static saveFragmentsMap(map: Record<string, number>): void {
    try {
      this.ensureVersion();
      const out: Record<string, number> = {};
      for (const k of Object.keys(map || {})) {
        const key = (k || '').trim();
        if (!key) continue;
        out[key] = Math.max(0, Math.floor(Number(map[k] || 0)));
      }
      sys.localStorage.setItem(this.FRAGMENTS_KEY, JSON.stringify(out));
    } catch {}
  }
}
