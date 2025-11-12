import { _decorator, Component, JsonAsset } from 'cc';
const { ccclass, property } = _decorator;

export interface StageEnemy {
  名字: string;
  等级: number;
  装备等级: number[];
  进阶等级: number;
}

export interface StageEntry {
  关卡名: string;
  敌人: (StageEnemy | null)[];
}

@ccclass('StageRegistry')
export class StageRegistry extends Component {
  @property({ type: JsonAsset, tooltip: '关卡配置 JSON（拖入 assets/json/关卡/levels.json）' })
  levelJson: JsonAsset | null = null;

  private _stages: StageEntry[] = [];

  onLoad() {
    this.reload();
  }

  reload() {
    this._stages = [];
    const ja = this.levelJson;
    if (!ja) return;
    try {
      const raw = (ja as JsonAsset).json as unknown;
      const data = (typeof raw === 'string') ? JSON.parse(raw) as any : (raw as any);
      const list = (data?.['关卡列表'] ?? []) as StageEntry[];
      if (Array.isArray(list)) {
        this._stages = list.filter(Boolean);
      }
    } catch (e) {
      console.warn('[StageRegistry] 解析关卡 JSON 失败:', e);
    }
  }

  listAllStageIds(): string[] {
    return this._stages.map(s => (s?.['关卡名'] || '')).filter(id => id && id.trim().length > 0);
  }

  getStageInfo(id: string): StageEntry | undefined {
    return this._stages.find(s => s && s['关卡名'] === id);
  }

  getEnemyConfigs(id: string): StageEnemy[] {
    const s = this.getStageInfo(id);
    const arr = (s?.['敌人'] ?? []) as (StageEnemy | null)[];
    return arr.filter((e): e is StageEnemy => !!e);
  }

  getEnemyNames(id: string): string[] {
    return this.getEnemyConfigs(id)
      .map(e => (e?.['名字'] || '').trim())
      .filter(n => n.length > 0);
  }
}

export default StageRegistry;