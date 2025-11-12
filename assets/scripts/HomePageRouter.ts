import { _decorator, Component, Node, Prefab, CCString, instantiate, Button, EventHandler } from 'cc';
import { PlayerData } from './data/PlayerData';
import { BattlePageManager } from './BattlePageManager';
const { ccclass, property } = _decorator;

@ccclass('HomePageEntry')
export class HomePageEntry {
  @property({ type: CCString, tooltip: '页面标识' })
  id: string = '';

  @property({ type: Prefab, tooltip: '页面预制体' })
  prefab: Prefab | null = null;

  @property({ type: Node, tooltip: '首页按钮节点' })
  button: Node | null = null;
}

@ccclass('HomePageRouter')
export class HomePageRouter extends Component {
  @property({ type: Node, tooltip: '页面实例的父节点；为空则挂到本节点' })
  pageRoot: Node | null = null;

  @property({ type: [HomePageEntry], tooltip: '页面配置列表（id/预制体/按钮）' })
  pages: HomePageEntry[] = [];

  @property({ tooltip: '打开页面时只保持一个页面激活' })
  onlyOneActive: boolean = true;

  @property({ type: PlayerData, tooltip: '玩家数据（包含解锁英雄与 Registry）' })
  playerData: PlayerData | null = null;

  private _instances: Record<string, Node> = {};

  start() {
    this.setupButtons();
  }

  openPage(_: Event, pageId: string) {
    if (!pageId) return;
    const node = this.getOrCreate(pageId);
    if (!node) return;
    if (this.onlyOneActive) this.hideAllExcept(pageId);
    node.active = true;
  }

  hidePage(pageId: string) {
    const n = this._instances[pageId];
    if (n) n.active = false;
  }

  hideAllExcept(exceptId: string) {
    for (const id in this._instances) {
      if (id !== exceptId) this._instances[id].active = false;
    }
  }

  /**
   * 为首页传入的按钮节点确保拥有 Button 组件，并绑定点击事件到 openPage。
   */
  private setupButtons() {
    for (const entry of this.pages) {
      const node = entry.button;
      const pageId = entry.id;
      if (!node || !pageId) continue;

      let btn = node.getComponent(Button);
      if (!btn) btn = node.addComponent(Button);

      // 通过点击事件列表绑定到本组件的 openPage 方法，避免重复监听
      btn.clickEvents = [];
      const eh = new EventHandler();
      eh.target = this.node;
      eh.component = 'HomePageRouter';
      eh.handler = 'openPage';
      eh.customEventData = pageId;
      btn.clickEvents.push(eh);
    }
  }

  private getOrCreate(pageId: string): Node | null {
    const cached = this._instances[pageId];
    if (cached) return cached;
    const entry = this.pages.find(p => p.id === pageId);
    if (!entry || !entry.prefab) return null;

    const n = instantiate(entry.prefab);
    const parent = this.pageRoot ?? this.node;
    parent.addChild(n);
    n.active = true;
    this._instances[pageId] = n;
    // 若是战斗页面，传递玩家候选与返回回调
    this.setupBattlePageIfAny(n, pageId);
    return n;
  }

  /**
   * 若页面包含 BattlePageManager，则用玩家数据初始化可选角色，并传入返回回调。
   */
  private setupBattlePageIfAny(pageNode: Node, pageId: string) {
    const mgr = pageNode.getComponent(BattlePageManager) || pageNode.getComponentInChildren(BattlePageManager);
    const pd = this.playerData;
    if (!mgr || !pd) return;
    // 接入资源注册表
    mgr.registry = pd.registry;
    // 取已解锁英雄名字作为候选
    const candidates = pd.heroLevels
      .filter(e => e && e.level > 0 && e.name && e.name.trim().length > 0)
      .map(e => e.name.trim());
    mgr.setHeroCandidates(candidates);
    // 传入关卡名与敌人数据，配置右侧阵容与顶部关卡标签
    const stageId = pd.currentStageId;
    const enemies = pd.getCurrentStageEnemyConfigs();
    if (stageId) {
      mgr.setStageAndEnemies(stageId, enemies);
    }
    // 返回回调：隐藏战斗页面即可
    mgr.onBack = () => {
      this.hidePage(pageId);
    };
  }
}

export default HomePageRouter;