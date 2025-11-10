import { _decorator, Component, Node, Label, Button, Sprite, SpriteFrame, Prefab, instantiate } from 'cc';
import { HeroInfoManager } from './HeroInfoManager';
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

  // 7. 英雄信息管理器（通过标签取头像 & 预制体）
  @property({ type: HeroInfoManager })
  heroInfo!: HeroInfoManager;

  @property({ tooltip: '最多可选择的英雄数量' })
  maxSelectCount: number = 5;

  private _selectedTags: string[] = [];
  private _avatarNodes: Node[] = [];

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

  // 生成底部头像（根据传入标签数组）
  setHeroCandidates(tags: string[]) {
    if (!this.bottomLayout || !this.avatarItemPrefab) return;

    // 清理旧项
    this._avatarNodes.forEach(n => n.removeFromParent());
    this._avatarNodes = [];
    this._selectedTags = [];

    tags.forEach(tag => {
      const item = instantiate(this.avatarItemPrefab);
      const sp = item.getComponent(Sprite) || item.getComponentInChildren(Sprite);
      const sf = this.heroInfo ? this.heroInfo.getAvatar(tag) : null;
      if (sp && sf) sp.spriteFrame = sf;

      // 默认遮罩隐藏
      const maskNode = this.findNodeByName(item, this.avatarMaskName);
      if (maskNode) maskNode.active = false;

      // 点击选择/取消
      item.on(Node.EventType.TOUCH_END, () => this.toggleAvatarSelection(item, tag), this);

      this.bottomLayout.addChild(item);
      this._avatarNodes.push(item);
    });

    // 清空并刷新左侧布阵（当前无选择）
    this.placeHeroesOnLeftFromSelection();
  }

  // 选择逻辑与遮罩控制
  private toggleAvatarSelection(item: Node, tag: string) {
    const isSelected = this._selectedTags.includes(tag);
    if (isSelected) {
      this._selectedTags = this._selectedTags.filter(t => t !== tag);
      this.setMaskActive(item, false);
    } else {
      if (this._selectedTags.length >= this.maxSelectCount) return;
      this._selectedTags.push(tag);
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

  // 7. 左侧布阵：按所选头像人数放置
  placeHeroesOnLeftFromSelection() {
    this.placeHeroesOnSide(this.leftPositions, this._selectedTags);
  }

  // 8. 右侧按关卡配置
  configureRightByStage(stageId: string, enemyTags: string[]) {
    // stageId 预留用于业务侧记录/查询
    this.placeHeroesOnSide(this.rightPositions, enemyTags);
  }

  private placeHeroesOnSide(slots: Node[], tags: string[]) {
    const count = Math.min(slots.length, tags.length);
    // 清空所有槽位
    for (const s of slots) s.removeAllChildren();
    // 逐个实例化英雄预制体并挂到槽位
    for (let i = 0; i < count; i++) {
      const slot = slots[i];
      const tag = tags[i];
      const prefab = this.heroInfo ? this.heroInfo.getPrefab(tag) : null;
      if (slot && prefab) {
        const heroNode = instantiate(prefab);
        slot.addChild(heroNode);
      }
    }
  }

  // 按钮事件（在面板 Button 的点击事件中绑定即可）
  onClickBack() {
    this.node.emit('back');
  }

  onClickStart() {
    this.placeHeroesOnLeftFromSelection();
    this.node.emit('start', this.getSelectedHeroTags());
  }
}

export default BattlePageManager;