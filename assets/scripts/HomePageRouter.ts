import { _decorator, Component, Node, Prefab, CCString, instantiate, Button, EventHandler } from 'cc';
import { PlayerData } from './data/PlayerData';
import { BattlePageManager } from './BattlePageManager';
import { BlackShopPanel } from './BlackShop/BlackShop';
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

  @property({ type: Node, tooltip: '防穿透点击的覆盖节点（非首页时显示、首页时隐藏）' })
  clickBlocker: Node | null = null;

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
    this.updateClickBlockerState();
  }

  hidePage(pageId: string) {
    const n = this._instances[pageId];
    if (n) n.active = false;
    this.updateClickBlockerState();
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
    // 若是黑市页面，绑定回调（含返回与购买获得钻石）
    this.setupBlackShopIfAny(n, pageId);
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
    // 传入玩家的等级/进阶，用于战斗中计算最终属性
    mgr.setAllyProgress(pd.heroLevels);
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
    this.updateClickBlockerState();
  }

  /**
   * 若页面包含 BlackShopPanel，则绑定返回回调，并在购买时增加钻石（包含首充翻倍逻辑由面板内部处理）。
   */
  private setupBlackShopIfAny(pageNode: Node, pageId: string) {
    const panel = pageNode.getComponent(BlackShopPanel) || pageNode.getComponentInChildren(BlackShopPanel);
    const pd = this.playerData;
    if (!panel || !pd) return;

    panel.setCallbacks({
      onBack: () => {
        this.hidePage(pageId);
      },
      onSection: (_index: number, amount: number) => {
        // 商店已处理首充翻倍，此处直接增加钻石并持久化
        pd.addDiamonds(amount);
      }
    });
    this.updateClickBlockerState();
  }

  /**
   * 根据是否有页面激活来切换防穿透节点显示：
   * - 有任意页面激活：显示覆盖节点以防点击穿透首页
   * - 没有页面激活（视为首页）：隐藏覆盖节点
   */
  private updateClickBlockerState() {
    const blocker = this.clickBlocker;
    if (!blocker) return;
    let anyActive = false;
    for (const id in this._instances) {
      const n = this._instances[id];
      if (n && n.active) {
        anyActive = true;
        break;
      }
    }
    blocker.active = anyActive;
  }
}

export default HomePageRouter;