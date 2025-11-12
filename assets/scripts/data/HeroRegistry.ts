import { _decorator, Component, Prefab, SpriteFrame, JsonAsset } from 'cc';
const { ccclass, property } = _decorator;

// ===== 类型与常量（合并自原 HeroTypes.ts） =====
export type HeroClass = '刺客' | '肉盾' | '远程输出' | '战士' | '治疗';
export type HeroRarity = 'r' | 'sr' | 'ssr';

export interface HeroAscend {
  属性: string;
  类型: '百分比' | '固定';
  数值: number;
}

export interface HeroGrowth {
  每级: Record<string, number>;
  每10级: Record<string, number>;
}

export interface HeroConfig {
  类型: '英雄' | '装备';
  名字: string;
  基础属性: Record<string, number>;
  战斗属性: Record<string, number>;
  成长配置: HeroGrowth;
  升阶配置: HeroAscend[];
  站位优先级?: number;
  职业?: HeroClass;
  初始品阶?: HeroRarity;
}

export const BASIC_ATTRS = [
  '攻击力', '法强', '生命值', '护甲', '魔抗', '攻击距离', '移速'
] as const;

export const COMBAT_ATTRS = [
  '攻速', '暴击率', '暴击倍率', '增伤', '减伤', '法力回复'
] as const;

export const HERO_CLASSES: HeroClass[] = ['刺客', '肉盾', '远程输出', '战士', '治疗'];
export const HERO_RARITIES: HeroRarity[] = ['r', 'sr', 'ssr'];

// ===== 可在编辑器中配置的绑定条目（类似 HomePageEntry） =====
@ccclass('HeroBindingEntry')
export class HeroBindingEntry {
  @property({ type: JsonAsset, tooltip: '英雄策划配置 JSON（JsonAsset）' })
  config: JsonAsset | null = null;

  @property({ type: Prefab, tooltip: '英雄对应的预制体' })
  prefab: Prefab | null = null;

  @property({ type: SpriteFrame, tooltip: '英雄头像（SpriteFrame）' })
  avatar: SpriteFrame | null = null;
}

// ===== 可挂载到场景上的注册表组件 =====
@ccclass('HeroRegistry')
export class HeroRegistry extends Component {
  @property({ type: [HeroBindingEntry], tooltip: '英雄绑定列表（JSON / 预制体 / 头像）' })
  bindings: HeroBindingEntry[] = [];

  private _configsByName: Map<string, HeroConfig> = new Map();
  private _bindingByName: Map<string, HeroBindingEntry> = new Map();

  onLoad() {
    this.reloadConfigs();
  }

  // 重新解析绑定中的 JSON，建立名字 => 配置 的映射
  reloadConfigs() {
    this._configsByName.clear();
    this._bindingByName.clear();
    for (const b of this.bindings) {
      if (b?.config) {
        try {
          const raw = (b.config as JsonAsset).json as unknown;
          const data = (typeof raw === 'string') ? JSON.parse(raw) as HeroConfig : (raw as HeroConfig);
          const cfgName = (data?.['名字'] || '').trim();
          if (cfgName) {
            this._configsByName.set(cfgName, data);
            this._bindingByName.set(cfgName, b);
          } else {
            console.warn('[HeroRegistry] 配置缺少“名字”字段:', b.config);
          }
        } catch (e) {
          console.warn('[HeroRegistry] JSON 解析失败:', b.config, e);
        }
      }
    }
  }

  // 查询配置
  getConfig(name: string): HeroConfig | undefined {
    return this._configsByName.get(name);
  }

  // 列出所有英雄名字（来自绑定和解析后的配置）
  listAllHeroes(): string[] {
    return Array.from(this._configsByName.keys());
  }

  // 根据名字解析资源
  resolveAssetsByName(name: string) {
    const b = this._bindingByName.get(name);
    if (!b) return undefined;
    return { prefab: b.prefab, avatar: b.avatar };
  }

  // 根据配置解析资源
  resolveAssetsByConfig(config: HeroConfig) {
    return this.resolveAssetsByName(config.名字);
  }
}