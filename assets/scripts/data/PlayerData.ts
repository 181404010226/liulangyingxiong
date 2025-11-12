import { _decorator, Component, CCInteger, CCString } from 'cc';
import { HeroRegistry, HeroConfig } from './HeroRegistry';

const { ccclass, property } = _decorator;

@ccclass('HeroLevelEntry')
export class HeroLevelEntry {
  @property({ type: CCString, tooltip: '英雄名字' })
  name: string = '';

  @property({ type: CCInteger, tooltip: '英雄等级（0=未解锁）' })
  level: number = 0;
}

@ccclass('PlayerData')
export class PlayerData extends Component {
  @property({ type: CCInteger, tooltip: '钻石数量' })
  diamonds: number = 0;

  @property({ type: CCInteger, tooltip: '金币数量' })
  coins: number = 0;

  @property({ type: HeroRegistry, tooltip: '英雄配置/资源注册表组件引用' })
  registry: HeroRegistry | null = null;

  @property({ type: [HeroLevelEntry], tooltip: '玩家英雄等级（0=未解锁）' })
  heroLevels: HeroLevelEntry[] = [];

  onLoad() {
    this.initUnlocksFromRegistry();
  }

  // 初始化：根据策划配置，初始解锁所有 R 品阶英雄
  initUnlocksFromRegistry() {
    if (!this.registry) return;
    const names = this.registry.listAllHeroes();
    const map = new Map<string, number>();
    this.heroLevels.forEach(e => map.set(e.name, e.level));

    names.forEach(name => {
      const cfg = this.registry?.getConfig(name) as HeroConfig | undefined;
      let level = map.get(name) ?? 0;
      if (cfg && cfg.初始品阶 === 'r') {
        level = Math.max(level, 1);
      }
      this.setHeroLevel(name, level);
    });
  }

  setHeroLevel(name: string, level: number) {
    const entry = this.heroLevels.find(e => e.name === name);
    if (entry) {
      entry.level = level;
    } else {
      const e = new HeroLevelEntry();
      e.name = name;
      e.level = level;
      this.heroLevels.push(e);
    }
  }

  getHeroLevel(name: string): number {
    const entry = this.heroLevels.find(e => e.name === name);
    return entry ? entry.level : 0;
  }

  isHeroUnlocked(name: string): boolean {
    return this.getHeroLevel(name) > 0;
  }
}