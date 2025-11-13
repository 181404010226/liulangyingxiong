import { _decorator, Component, Node, Label, Button, Sprite, SpriteFrame, Prefab, instantiate, ProgressBar } from 'cc';
import { HeroRegistry } from './data/HeroRegistry';
import type { StageEnemy } from './data/StageRegistry';
import { HeroController } from './组件/HeroController';
import { DamageManager } from './组件/DamageManager';
import type { HeroLevelEntry } from './data/PlayerData';
const { ccclass, property } = _decorator;

@ccclass('BattlePageManager')
export class BattlePageManager extends Component {
  // 1. 背景图片节点（建议拖入含有 Sprite 的节点）
  @property({ type: Sprite })
  background!: Sprite;

  // 2. 顶部标签/进度
  @property({ type: Label })
  leftPower!: Label;

  @property({ type: Label })
  rightPower!: Label;

  @property({ type: Label })
  stageProgress!: Label;

  // 3. 底部按钮
  @property({ type: Button })
  backButton!: Button;

  @property({ type: Button })
  startButton!: Button;

  // 3.1 战斗中 UI 控件
  @property({ type: Label, tooltip: '读秒标签（暂不使用）' })
  countdownLabel: Label | null = null;

  @property({ type: Button, tooltip: '暂停按钮（点击后显示暂停面板）' })
  pauseButton: Button | null = null;

  @property({ type: Button, tooltip: '倍速按钮（1/2 切换）' })
  speedButton: Button | null = null;

  @property({ type: ProgressBar, tooltip: '我方生命值进度条' })
  leftHpBar: ProgressBar | null = null;

  @property({ type: ProgressBar, tooltip: '敌方生命值进度条' })
  rightHpBar: ProgressBar | null = null;

  // 暂停面板及其按钮
  @property({ type: Node, tooltip: '暂停面板根节点' })
  pausePanel: Node | null = null;

  @property({ type: Button, tooltip: '暂停面板-继续按钮' })
  pausePanelContinueButton: Button | null = null;

  // 取消单独的“暂停”按钮，改为点击暂停直接进入暂停
  @property({ type: Button, tooltip: '暂停面板-退出战斗按钮（返回主页面）' })
  pausePanelExitButton: Button | null = null;

  @property({ type: Button, tooltip: '暂停面板-重新开始战斗按钮' })
  pausePanelRestartButton: Button | null = null;

  // 2.1 战斗前/战斗后根节点（通过 active 切换显示）
  @property({ type: Node, tooltip: '战斗前根节点（进入关卡页面显示）' })
  preBattleRoot: Node | null = null;

  @property({ type: Node, tooltip: '战斗后/战斗中根节点（开始战斗后显示）' })
  postBattleRoot: Node | null = null;

  // 4. 下方 layout 节点（用于承载人物头像项）
  @property({ type: Node })
  bottomLayout!: Node;

  // 5. 人物头像项的预制体（根节点带 Sprite；其下有名为 mask 的子节点用作选择遮罩）
  @property({ type: Prefab })
  avatarItemPrefab!: Prefab;

  @property({ tooltip: '头像遮罩子节点名称（默认：mask）' })
  avatarMaskName: string = 'mask';

  // 6. 左、右位置节点（1~5 个）
  @property({ type: [Node] })
  leftPositions: Node[] = [];

  @property({ type: [Node] })
  rightPositions: Node[] = [];

  // 7. 英雄资源注册表（通过英雄名字解析头像 & 预制体）
  @property({ type: HeroRegistry })
  registry: HeroRegistry | null = null;

  @property({ tooltip: '最多可选择的英雄数量' })
  maxSelectCount: number = 5;

  // 8. 战斗中头像布局与预制体（开始战斗后将所选角色放入此 Layout）
  @property({ type: Node, tooltip: '战斗中头像布局 Layout 节点' })
  battleLayout: Node | null = null;

  @property({ type: Prefab, tooltip: '战斗头像预制体（根节点带 Sprite）' })
  battleAvatarPrefab: Prefab | null = null;

  private _selectedTags: string[] = [];
  private _avatarNodes: Node[] = [];
  private _enemyConfigs: StageEnemy[] = [];
  private _currentStageId: string = '';
  private _leftHeroNodes: Node[] = [];
  private _rightHeroNodes: Node[] = [];
  private _allyProgressMap: Map<string, { level: number; ascend: number }> = new Map();
  private _controllers: HeroController[] = [];
  private _damageManager: DamageManager | null = null;

  // 全局速度与暂停状态
  private _currentSpeed: number = 1; // 1 或 2
  private _prePauseSpeed: number = 1; // 进入暂停面板前的速度
  private _isPaused: boolean = false;
  
  // 首页传入的返回回调；战斗页面点击返回时调用
  onBack: (() => void) | null = null;

  onLoad() {
    this.bindButtonEvents();
    // 默认进入页面展示战斗前、隐藏战斗后
    this.showPreBattle();
    // 初始化伤害管理器
    this._damageManager = new DamageManager();
  }

  private bindButtonEvents() {
    this.ensureButtonBinding(this.backButton, this.onClickBack);
    this.ensureButtonBinding(this.startButton, this.onClickStart);
    this.ensureButtonBinding(this.pauseButton, this.onClickPauseButton);
    this.ensureButtonBinding(this.speedButton, this.onClickSpeedToggle);
    this.ensureButtonBinding(this.pausePanelContinueButton, this.onClickPanelContinue);
    this.ensureButtonBinding(this.pausePanelRestartButton, this.onClickPanelRestart);
    this.ensureButtonBinding(this.pausePanelExitButton, this.onClickPanelExit);
  }

  private ensureButtonBinding(btn: Button | null, handler: (event?: any) => void) {
    if (!btn || !btn.node) return;
    // 清空编辑器中可能配置的 clickEvents，避免重复触发
    btn.clickEvents = [];
    // 先解绑同名回调，再绑定一次，确保唯一性
    btn.node.off(Button.EventType.CLICK, handler, this);
    btn.node.on(Button.EventType.CLICK, handler, this);
  }

  // 基本 UI 设置接口
  setBackground(frame: SpriteFrame) {
    if (this.background) this.background.spriteFrame = frame;
  }

  setPowers(left: number, right: number) {
    if (this.leftPower) this.leftPower.string = String(left);
    if (this.rightPower) this.rightPower.string = String(right);
  }

  setStageProgress(text: string) {
    if (this.stageProgress) this.stageProgress.string = text;
  }

  // 传入关卡信息与敌人数据，设置标题并布置右侧敌人阵容
  setStageAndEnemies(stageId: string, enemies: StageEnemy[]) {
    this._enemyConfigs = Array.isArray(enemies) ? enemies : [];
    this._currentStageId = stageId;
    const label = stageId && stageId.trim().length > 0 ? `${stageId}` : '';
    this.setStageProgress(label);
    const names = this._enemyConfigs
      .map(e => (e?.['名字'] || '').trim())
      .filter(n => n.length > 0);
    this.configureRightByStage(stageId, names);
    // 进入关卡时确保显示战斗前态
    this.showPreBattle();
  }

  // —— 新增：由首页传入我方角色等级/进阶 ——
  setAllyProgress(entries: HeroLevelEntry[]) {
    this._allyProgressMap.clear();
    const arr = Array.isArray(entries) ? entries : [];
    for (const e of arr) {
      const name = (e?.name || '').trim();
      if (!name) continue;
      const level = typeof e.level === 'number' ? e.level : 0;
      const ascend = typeof (e as any).ascendLevel === 'number' ? (e as any).ascendLevel : 0;
      this._allyProgressMap.set(name, { level, ascend });
    }
  }

  // 生成底部头像（根据传入的英雄名字数组）
  setHeroCandidates(names: string[]) {
    if (!this.bottomLayout || !this.avatarItemPrefab) return;

    // 清理旧项
    this._avatarNodes.forEach(n => n.removeFromParent());
    this._avatarNodes = [];
    this._selectedTags = [];

    names.forEach(name => {
      const item = instantiate(this.avatarItemPrefab);
      const sp = item.getComponent(Sprite) || item.getComponentInChildren(Sprite);
      const assets = this.registry ? this.registry.resolveAssetsByName(name) : undefined;
      const sf = assets?.avatar || null;
      if (sp && sf) sp.spriteFrame = sf;

      // 默认遮罩隐藏
      const maskNode = this.findNodeByName(item, this.avatarMaskName);
      if (maskNode) maskNode.active = false;

      // 点击选择/取消
      item.on(Node.EventType.TOUCH_END, () => this.toggleAvatarSelection(item, name), this);

      this.bottomLayout.addChild(item);
      this._avatarNodes.push(item);
    });

    // 清空并刷新左侧布阵（当前无选择）
    this.placeHeroesOnLeftFromSelection();
  }

  // 选择逻辑与遮罩控制
  private toggleAvatarSelection(item: Node, name: string) {
    const isSelected = this._selectedTags.includes(name);
    if (isSelected) {
      this._selectedTags = this._selectedTags.filter(t => t !== name);
      this.setMaskActive(item, false);
    } else {
      if (this._selectedTags.length >= this.maxSelectCount) return;
      this._selectedTags.push(name);
      this.setMaskActive(item, true);
    }

    // 选择变化后，实时刷新左侧布阵
    this.placeHeroesOnLeftFromSelection();
  }

  private setMaskActive(item: Node, active: boolean) {
    const maskNode = this.findNodeByName(item, this.avatarMaskName);
    if (maskNode) maskNode.active = active;
  }

  private findNodeByName(root: Node, name: string): Node | null {
    if (!root) return null;
    if (root.name === name) return root;
    for (const c of root.children) {
      const found = this.findNodeByName(c, name);
      if (found) return found;
    }
    return null;
  }

  getSelectedHeroTags(): string[] {
    return [...this._selectedTags];
  }

  // 清空玩家选择：去除所有选中遮罩并清空左侧布阵
  private clearSelection() {
    this._selectedTags = [];
    for (const item of this._avatarNodes) {
      this.setMaskActive(item, false);
    }
    this.placeHeroesOnLeftFromSelection();
  }

  // 7. 左侧布阵：按所选头像人数放置
  placeHeroesOnLeftFromSelection() {
    this.placeHeroesOnSide(this.leftPositions, this._selectedTags, false);
  }

  // 8. 右侧按关卡配置
  configureRightByStage(stageId: string, enemyTags: string[]) {
    // stageId 预留用于业务侧记录/查询
    this.placeHeroesOnSide(this.rightPositions, enemyTags, true);
  }

  private placeHeroesOnSide(slots: Node[], names: string[], isEnemy: boolean = false) {
    const count = Math.min(slots.length, names.length);
    // 清空所有槽位
    for (const s of slots) s.removeAllChildren();
    // 逐个实例化英雄预制体并挂到槽位
    for (let i = 0; i < count; i++) {
      const slot = slots[i];
      const name = names[i];
      const assets = this.registry ? this.registry.resolveAssetsByName(name) : undefined;
      const prefab = assets?.prefab || null;
      if (slot && prefab) {
        const heroNode = instantiate(prefab);
        if (name && name.trim().length > 0) heroNode.name = name.trim();
        slot.addChild(heroNode);
        // 敌方水平翻转（scaleX 取反，保留原始 Y/Z）
        if (isEnemy) {
          const sc = heroNode.scale;
          heroNode.setScale(-Math.abs(sc.x), sc.y, sc.z);
        }
      }
    }
  }

  // 战斗态显示控制
  private showPreBattle() {
    if (this.preBattleRoot) this.preBattleRoot.active = true;
    if (this.postBattleRoot) this.postBattleRoot.active = false;
    // 退出战斗态时，关闭暂停面板并重置速度
    if (this.pausePanel) this.pausePanel.active = false;
    this._isPaused = false;
    this._currentSpeed = 1;
    this.applyGlobalSpeed();
  }

  private showPostBattle() {
    if (this.preBattleRoot) this.preBattleRoot.active = false;
    if (this.postBattleRoot) this.postBattleRoot.active = true;
    // 进入战斗态默认运行当前速度
    if (this.pausePanel) this.pausePanel.active = false;
    this.applyGlobalSpeed();
  }

  // 将选择的角色以战斗头像预制体放入战斗中 Layout
  private populateBattleAvatars() {
    if (!this.battleLayout || !this.battleAvatarPrefab) return;
    // 清空旧的战斗头像
    this.battleLayout.removeAllChildren();
    const tags = this.getSelectedHeroTags();
    for (const name of tags) {
      const node = this.createBattleAvatarNode(name);
      if (node) this.battleLayout.addChild(node);
    }
  }

  private createBattleAvatarNode(name: string): Node | null {
    if (!this.battleAvatarPrefab) return null;
    const item = instantiate(this.battleAvatarPrefab);
    const sp = item.getComponent(Sprite) || item.getComponentInChildren(Sprite);
    const assets = this.registry ? this.registry.resolveAssetsByName(name) : undefined;
    const sf = assets?.avatar || null;
    if (sp && sf) sp.spriteFrame = sf;
    // 为头像命名为英雄名，便于后续绑定
    if (name && name.trim().length > 0) item.name = name.trim();
    return item;
  }

  // 按钮事件（在面板 Button 的点击事件中绑定即可）
  onClickBack() {
    // 返回主页面前，统一重置到战斗前状态并清空选择
    this._isPaused = false;
    this._currentSpeed = 1;
    this.applyGlobalSpeed();
    if (this.pausePanel) this.pausePanel.active = false;
    this.clearSelection();
    this.showPreBattle();
    if (this.onBack) this.onBack();
  }

  onClickStart() {
    this.placeHeroesOnLeftFromSelection();
    // 开始战斗：填充战斗头像并切换至战斗后界面
    this.populateBattleAvatars();
    this.showPostBattle();
    this.attachHeroControllers();
    // 其他战斗逻辑可在页面内继续处理
  }

  private applyGlobalSpeed() {
    this.applyPauseStateToControllers();
  }

  onClickPauseButton() {
    // 打开暂停面板并立即进入暂停
    if (this.pausePanel) this.pausePanel.active = true;
    this._prePauseSpeed = this._currentSpeed;
    this._isPaused = true;
    this.applyGlobalSpeed();
  }

  onClickSpeedToggle() {
    // 在未暂停时切换 1/2；若已暂停，仅记录切换，继续时恢复
    this._currentSpeed = this._currentSpeed === 1 ? 2 : 1;
    if (!this._isPaused) this.applyGlobalSpeed();
  }

  onClickPanelContinue() {
    // 退出暂停，恢复到进入面板前的速度
    this._isPaused = false;
    this._currentSpeed = this._prePauseSpeed;
    this.applyGlobalSpeed();
    if (this.pausePanel) this.pausePanel.active = false;
  }

  onClickPanelRestart() {
    // 重新开始战斗：回到战斗前界面，速度重置为 1
    this._isPaused = false;
    this._currentSpeed = 1;
    this.applyGlobalSpeed();
    if (this.pausePanel) this.pausePanel.active = false;
    // 清空玩家选择
    this.clearSelection();
    this.showPreBattle();
    // 重新生成关卡敌人，确保敌人上的 HeroController 被重置
    const names = this._enemyConfigs.map(e => (e?.['名字'] || '').trim()).filter(n => n.length > 0);
    this.configureRightByStage(this._currentStageId, names);
  }

  onClickPanelExit() {
    // 退出战斗：复用返回主页面逻辑
    this.onClickBack();
  }

  // —— 生命值进度条更新接口 ——
  setLeftHp(current: number, max: number) {
    if (!this.leftHpBar) return;
    const p = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    this.leftHpBar.progress = p;
  }

  setRightHp(current: number, max: number) {
    if (!this.rightHpBar) return;
    const p = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    this.rightHpBar.progress = p;
  }
  
  // —— 新增：挂载 HeroController 并设置上下文/属性/位移 ——
  private collectHeroNodesFromSlots(slots: Node[]): Node[] {
    const res: Node[] = [];
    for (const s of slots) {
      for (const c of s.children) res.push(c);
    }
    return res;
  }

  private attachHeroControllers() {
    this._controllers = [];
    // 收集左右角色节点列表
    this._leftHeroNodes = this.collectHeroNodesFromSlots(this.leftPositions);
    this._rightHeroNodes = this.collectHeroNodesFromSlots(this.rightPositions);

    const allyNodes = this._leftHeroNodes;
    const enemyNodes = this._rightHeroNodes;

    // 构建战斗头像映射（名字 -> 头像节点）
    const avatarMap = new Map<string, Node>();
    if (this.battleLayout) {
      for (const c of this.battleLayout.children) {
        const key = (c?.name || '').trim();
        if (key) avatarMap.set(key, c);
      }
    }

    // 敌人配置映射（用于等级/进阶）
    const enemyCfgMap = new Map<string, StageEnemy>();
    for (const e of this._enemyConfigs) {
      const n = (e?.['名字'] || '').trim();
      if (n) enemyCfgMap.set(n, e);
    }

    // 辅助：从节点名解析英雄配置
    const getHeroConfig = (node: Node) => {
      const tag = (node?.name || '').trim();
      return this.registry ? this.registry.getConfig(tag) : undefined;
    };

    // 我方：从首页传入的玩家信息读取等级与进阶
    for (const n of allyNodes) {
      if (!n) continue;
      let ctrl = n.getComponent(HeroController);
      if (!ctrl) ctrl = n.addComponent(HeroController);
      ctrl.isAlly = true;
      ctrl.heroName = (n.name || '').trim();
      ctrl.setContext(allyNodes, enemyNodes);
      const cfg = getHeroConfig(n);
      const tag = (n.name || '').trim();
      const p = this._allyProgressMap.get(tag);
      const lv = p ? Math.max(1, p.level) : 1;
      const asc = p ? Math.max(0, p.ascend) : 0;
      ctrl.initializeFinalAttributes(cfg, lv, asc);
      ctrl.applyStartOffset();
      ctrl.setGlobalTimeScale(this._isPaused ? 0 : this._currentSpeed);
      // 绑定对应战斗头像
      const av = avatarMap.get(tag);
      if (av) ctrl.bindBattleAvatar(av);
      // 注入伤害回调
      if (this._damageManager) {
        ctrl.setDamageHandler((src, tgt, type) => {
          this._damageManager!.applyDamage(src, tgt, type);
        });
      }
      this._controllers.push(ctrl);
    }

    // 敌方：按关卡配置设置等级/进阶
    for (const n of enemyNodes) {
      if (!n) continue;
      let ctrl = n.getComponent(HeroController);
      if (!ctrl) ctrl = n.addComponent(HeroController);
      ctrl.isAlly = false;
      ctrl.heroName = (n.name || '').trim();
      ctrl.setContext(enemyNodes, allyNodes);
      const cfg = getHeroConfig(n);
      const tag = (n.name || '').trim();
      const ec = enemyCfgMap.get(tag);
      const lv = ec ? (ec['等级'] || 1) : 1;
      const asc = ec ? (ec['进阶等级'] || 0) : 0;
      ctrl.initializeFinalAttributes(cfg, lv, asc);
      ctrl.applyStartOffset();
      ctrl.setGlobalTimeScale(this._isPaused ? 0 : this._currentSpeed);
      // 敌方当前不绑定战斗头像（无敌方头像布局）；如需可在此扩展
      // 注入伤害回调
      if (this._damageManager) {
        ctrl.setDamageHandler((src, tgt, type) => {
          this._damageManager!.applyDamage(src, tgt, type);
        });
      }
      this._controllers.push(ctrl);
    }
  }

  private applyPauseStateToControllers() {
    const s = this._isPaused ? 0 : this._currentSpeed;
    for (const c of this._controllers) {
      if (c && c.node && c.node.isValid) c.setGlobalTimeScale(s);
    }
  }
}

export default BattlePageManager;