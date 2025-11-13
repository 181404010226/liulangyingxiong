import { _decorator, Component, CCInteger, CCString } from 'cc';
import { HeroRegistry } from './HeroRegistry';
import { PlayerStorage } from './PlayerStorage';
const { ccclass, property } = _decorator;

@ccclass('HeroFragmentEntry')
export class HeroFragmentEntry {
  @property({ type: CCString, tooltip: '英雄名字' })
  name: string = '';

  @property({ type: CCInteger, tooltip: '碎片数量' })
  count: number = 0;
}

@ccclass('MaterialInventory')
export class MaterialInventory extends Component {
  @property({ type: CCInteger, tooltip: '挑战券数量' })
  challengeTickets: number = 0;

  @property({ type: CCInteger, tooltip: '抽奖券数量' })
  lotteryTickets: number = 0;

  @property({ type: CCInteger, tooltip: '进阶石数量' })
  ascendStones: number = 0;

  @property({ type: HeroRegistry, tooltip: '英雄注册表，用于同步碎片条目' })
  registry: HeroRegistry | null = null;

  @property({ type: [HeroFragmentEntry], tooltip: '英雄碎片列表' })
  fragments: HeroFragmentEntry[] = [];

  onLoad() {
    this.challengeTickets = PlayerStorage.loadChallengeTickets(this.challengeTickets);
    this.lotteryTickets = PlayerStorage.loadLotteryTickets(this.lotteryTickets);
    this.ascendStones = PlayerStorage.loadAscendStones(this.ascendStones);
    const mapObj = PlayerStorage.loadFragmentsMap({});
    const map = new Map<string, number>();
    for (const k of Object.keys(mapObj)) map.set((k || '').trim(), Math.max(0, Math.floor(Number(mapObj[k] || 0))));
    const seen = new Set<string>();
    for (const e of this.fragments) {
      const name = (e?.name || '').trim();
      if (!name) continue;
      const cnt = map.has(name) ? map.get(name)! : Math.max(0, Math.floor(Number(e.count || 0)));
      e.count = cnt;
      seen.add(name);
    }
    if (this.registry) {
      const names = this.registry.listAllHeroes();
      for (const n of names) {
        const name = (n || '').trim();
        if (!name || seen.has(name)) continue;
        const entry = new HeroFragmentEntry();
        entry.name = name;
        entry.count = map.has(name) ? map.get(name)! : 0;
        this.fragments.push(entry);
        seen.add(name);
      }
    }
    this.saveFragments();
  }

  addChallengeTickets(n: number) {
    const add = Math.max(0, Math.floor(n || 0));
    if (add <= 0) return;
    this.challengeTickets += add;
    PlayerStorage.saveChallengeTickets(this.challengeTickets);
  }

  consumeChallengeTickets(n: number): boolean {
    const use = Math.max(0, Math.floor(n || 0));
    if (use <= 0) return true;
    if (this.challengeTickets < use) return false;
    this.challengeTickets -= use;
    PlayerStorage.saveChallengeTickets(this.challengeTickets);
    return true;
  }

  addLotteryTickets(n: number) {
    const add = Math.max(0, Math.floor(n || 0));
    if (add <= 0) return;
    this.lotteryTickets += add;
    PlayerStorage.saveLotteryTickets(this.lotteryTickets);
  }

  consumeLotteryTickets(n: number): boolean {
    const use = Math.max(0, Math.floor(n || 0));
    if (use <= 0) return true;
    if (this.lotteryTickets < use) return false;
    this.lotteryTickets -= use;
    PlayerStorage.saveLotteryTickets(this.lotteryTickets);
    return true;
  }

  addAscendStones(n: number) {
    const add = Math.max(0, Math.floor(n || 0));
    if (add <= 0) return;
    this.ascendStones += add;
    PlayerStorage.saveAscendStones(this.ascendStones);
  }

  consumeAscendStones(n: number): boolean {
    const use = Math.max(0, Math.floor(n || 0));
    if (use <= 0) return true;
    if (this.ascendStones < use) return false;
    this.ascendStones -= use;
    PlayerStorage.saveAscendStones(this.ascendStones);
    return true;
  }

  addHeroFragments(name: string, n: number) {
    const key = (name || '').trim();
    if (!key) return;
    const add = Math.max(0, Math.floor(n || 0));
    if (add <= 0) return;
    const entry = this.ensureFragmentEntry(key);
    entry.count += add;
    this.saveFragments();
  }

  consumeHeroFragments(name: string, n: number): boolean {
    const key = (name || '').trim();
    if (!key) return false;
    const use = Math.max(0, Math.floor(n || 0));
    if (use <= 0) return true;
    const entry = this.ensureFragmentEntry(key);
    if (entry.count < use) return false;
    entry.count -= use;
    this.saveFragments();
    return true;
  }

  getHeroFragmentCount(name: string): number {
    const key = (name || '').trim();
    if (!key) return 0;
    const entry = this.fragments.find(e => (e?.name || '').trim() === key);
    return entry ? Math.max(0, Math.floor(entry.count || 0)) : 0;
  }

  private ensureFragmentEntry(name: string): HeroFragmentEntry {
    const key = (name || '').trim();
    let entry = this.fragments.find(e => (e?.name || '').trim() === key);
    if (!entry) {
      entry = new HeroFragmentEntry();
      entry.name = key;
      entry.count = 0;
      this.fragments.push(entry);
    }
    return entry;
  }

  private saveFragments() {
    const map: Record<string, number> = {};
    for (const e of this.fragments) {
      const key = (e?.name || '').trim();
      if (!key) continue;
      map[key] = Math.max(0, Math.floor(Number(e.count || 0)));
    }
    PlayerStorage.saveFragmentsMap(map);
  }
}

export default MaterialInventory;
