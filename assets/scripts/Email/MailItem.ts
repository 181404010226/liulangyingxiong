import { _decorator, Component, Node, Label } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MailItem')
export class MailItem extends Component {
  // should_hide_in_hierarchy/mail/text/Reward/CoinBlock/Number
  @property(Label)
  coinNumberLabel: Label | null = null;

  // should_hide_in_hierarchy/mail/text/Reward/DiamondBlock/Number
  @property(Label)
  diamondNumberLabel: Label | null = null;

  // should_hide_in_hierarchy/mail/Right
  @property(Node)
  rightNode: Node | null = null;

  // should_hide_in_hierarchy/mail/Unreceived
  @property(Node)
  unreceivedNode: Node | null = null;

  @property({ tooltip: '是否已领取(显示右侧勾)' })
  claimed = false;

  onLoad(): void {
    // 自动查找并绑定：允许不在编辑器拖拽时运行
    if (!this.coinNumberLabel) {
      this.coinNumberLabel = this.node
        .getChildByName('text')
        ?.getChildByName('Reward')
        ?.getChildByName('CoinBlock')
        ?.getChildByName('Number')
        ?.getComponent(Label) ?? null;
    }

    if (!this.diamondNumberLabel) {
      this.diamondNumberLabel = this.node
        .getChildByName('text')
        ?.getChildByName('Reward')
        ?.getChildByName('DiamondBlock')
        ?.getChildByName('Number')
        ?.getComponent(Label) ?? null;
    }

    if (!this.rightNode) {
      this.rightNode = this.node.getChildByName('Right') ?? null;
    }

    if (!this.unreceivedNode) {
      this.unreceivedNode = this.node.getChildByName('Unreceived') ?? null;
    }

    // 默认未领取时隐藏右侧勾
    if (this.rightNode) {
      this.rightNode.active = this.claimed;
    }
    // 未领取标志默认显示（与已领取互斥）
    if (this.unreceivedNode) {
      this.unreceivedNode.active = !this.claimed;
    }
  }

  setAmounts(coin?: number, diamond?: number): void {
    if (coin !== undefined && this.coinNumberLabel) {
      this.coinNumberLabel.string = String(coin);
    }
    if (diamond !== undefined && this.diamondNumberLabel) {
      this.diamondNumberLabel.string = String(diamond);
    }
  }

  setClaimed(claimed: boolean): void {
    this.claimed = claimed;
    if (this.rightNode) {
      this.rightNode.active = claimed;
    }
    if (this.unreceivedNode) {
      this.unreceivedNode.active = !claimed;
    }
  }

  claim(): void {
    this.setClaimed(true);
  }
}