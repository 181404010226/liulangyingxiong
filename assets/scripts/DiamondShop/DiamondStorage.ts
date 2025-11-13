import { sys } from 'cc';

export class DiamondStorage {
  private static readonly PURCHASED_KEY = 'blackshop:purchasedFlags';
  private static readonly DOUBLE_KEY = 'blackshop:doubleAvailableFlags';
  private static readonly VERSION_KEY = 'blackshop:storageVersion';
  private static readonly VERSION = '1';

  static loadPurchasedFlags(count: number): boolean[] {
    try {
      this.ensureVersion();
      const raw = sys.localStorage.getItem(this.PURCHASED_KEY);
      if (!raw) return new Array(count).fill(false);
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return new Array(count).fill(false);
      return this.normalizeBooleanArray(arr, count, false);
    } catch {
      return new Array(count).fill(false);
    }
  }

  static loadDoubleAvailableFlags(count: number): boolean[] {
    try {
      this.ensureVersion();
      const raw = sys.localStorage.getItem(this.DOUBLE_KEY);
      if (!raw) return new Array(count).fill(true);
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return new Array(count).fill(true);
      return this.normalizeBooleanArray(arr, count, true);
    } catch {
      return new Array(count).fill(true);
    }
  }

  static savePurchasedFlags(flags: boolean[]): void {
    try {
      this.ensureVersion();
      sys.localStorage.setItem(this.PURCHASED_KEY, JSON.stringify(flags.map(Boolean)));
    } catch {}
  }

  static saveDoubleAvailableFlags(flags: boolean[]): void {
    try {
      this.ensureVersion();
      sys.localStorage.setItem(this.DOUBLE_KEY, JSON.stringify(flags.map(Boolean)));
    } catch {}
  }

  static clearAll(): void {
    try {
      sys.localStorage.removeItem(this.PURCHASED_KEY);
      sys.localStorage.removeItem(this.DOUBLE_KEY);
      this.ensureVersion();
    } catch {}
  }

  private static normalizeBooleanArray(arr: any[], count: number, defaultVal: boolean): boolean[] {
    const out: boolean[] = new Array(count);
    for (let i = 0; i < count; i++) {
      const v = arr[i];
      out[i] = typeof v === 'boolean' ? v : defaultVal;
    }
    return out;
  }

  private static ensureVersion(): void {
    const ver = sys.localStorage.getItem(this.VERSION_KEY);
    if (ver !== this.VERSION) {
      sys.localStorage.setItem(this.VERSION_KEY, this.VERSION);
    }
  }
}