import { _decorator, Component, Node, Button, Label, find, Vec3, v3 } from 'cc';
import { EmailItem, claimEmail, getEmails } from './EmailManager';
import { MailItem } from './MailItem';
const { ccclass, property } = _decorator;

@ccclass('EmailPanel')
export class EmailPanel extends Component {
  @property(Node)
  panelRoot: Node | null = null; // Canvas/EmailPanel（默认即为 this.node）

  @property(Button)
  gainButton: Button | null = null; // Canvas/EmailPanel/Layout/Rewards/Gain

  @property(Node)
  closeButtonNode: Node | null = null; // Canvas/EmailPanel/CloseBtn（可选）

  // 新标题装饰器：Canvas/EmailPanel/Layout/TextTitle
  @property(Label)
  textTitleLabel: Label | null = null;

  @property(Label)
  bodyLabel: Label | null = null; // Canvas/EmailPanel/Layout/Body（具体路径依UI而定，可选）

  // 面板奖励数字：确保与列表项中的数字一致
  @property(Label)
  panelCoinNumberLabel: Label | null = null; // Canvas/EmailPanel/Layout/Rewards/Reward/CoinBlock/Number

  @property(Label)
  panelDiamondNumberLabel: Label | null = null; // Canvas/EmailPanel/Layout/Rewards/Reward/DiamondBlock/Number

  private currentEmail: EmailItem | null = null;
  private currentMailNode: Node | null = null;
  @property(Node)
  emailRoot: Node | null = null; // Canvas/Email，用于定位到页面中心
  private originalPos: Vec3 | null = null; // 记录初始位置（左侧位置）

  onLoad(): void {
    if (!this.panelRoot) this.panelRoot = this.node;
    this.originalPos = this.node.position.clone();
    if (!this.emailRoot) {
      this.emailRoot = find('Canvas/Email') ?? this.node.parent?.getChildByName('Email') ?? null;
    }

    // 自动查找 Gain 按钮
    if (!this.gainButton) {
      const btnNode = this.node
        .getChildByName('Layout')
        ?.getChildByName('Rewards')
        ?.getChildByName('Gain');
      this.gainButton = btnNode?.getComponent(Button) ?? null;
    }

    // 自动查找关闭按钮
    if (!this.closeButtonNode) {
      this.closeButtonNode = this.node.getChildByName('CloseBtn') ?? null;
    }

    // 自动查找标题与正文（容错，不强制要求存在）
    if (!this.textTitleLabel) {
      const tl = this.node.getChildByName('Layout')?.getChildByName('TextTitle')?.getComponent(Label);
      this.textTitleLabel = tl ?? null;
    }
    if (!this.bodyLabel) {
      const bl = this.node.getChildByName('Layout')?.getChildByName('Body')?.getComponent(Label);
      this.bodyLabel = bl ?? null;
    }

    // 自动查找面板奖励数字
    if (!this.panelCoinNumberLabel) {
      const cl = this.node
        .getChildByName('Layout')
        ?.getChildByName('Rewards')
        ?.getChildByName('Reward')
        ?.getChildByName('CoinBlock')
        ?.getChildByName('Number')
        ?.getComponent(Label);
      this.panelCoinNumberLabel = cl ?? null;
    }
    if (!this.panelDiamondNumberLabel) {
      const dl = this.node
        .getChildByName('Layout')
        ?.getChildByName('Rewards')
        ?.getChildByName('Reward')
        ?.getChildByName('DiamondBlock')
        ?.getChildByName('Number')
        ?.getComponent(Label);
      this.panelDiamondNumberLabel = dl ?? null;
    }

    // 绑定事件
    this.gainButton?.node.on(Node.EventType.TOUCH_END, this.onGainClicked, this);
    this.closeButtonNode?.on(Node.EventType.TOUCH_END, this.hidePanel, this);
  }

  /**
   * 由 EmailController 调用：展示指定邮件详情，并准备单封领取
   */
  showEmail(email: EmailItem, mailNode: Node): void {
    this.currentEmail = email;
    this.currentMailNode = mailNode;

    // 标题与正文填充（若存在对应节点）
    const mailTitleLabel = mailNode
      .getChildByName('text')
      ?.getChildByName('Title')
      ?.getComponent(Label);
    const titleStr = mailTitleLabel?.string ?? email.title ?? '邮件详情';
    if (this.textTitleLabel) this.textTitleLabel.string = titleStr;
    if (this.bodyLabel) this.bodyLabel.string = email.body ?? '';

    // 奖励数字一致：读取列表项的数字并填入面板
    const mailCoinLabel = mailNode
      .getChildByName('text')
      ?.getChildByName('Reward')
      ?.getChildByName('CoinBlock')
      ?.getChildByName('Number')
      ?.getComponent(Label);
    const mailDiamondLabel = mailNode
      .getChildByName('text')
      ?.getChildByName('Reward')
      ?.getChildByName('DiamondBlock')
      ?.getChildByName('Number')
      ?.getComponent(Label);
    if (this.panelCoinNumberLabel && mailCoinLabel) {
      this.panelCoinNumberLabel.string = mailCoinLabel.string;
    }
    if (this.panelDiamondNumberLabel && mailDiamondLabel) {
      this.panelDiamondNumberLabel.string = mailDiamondLabel.string;
    }

    // 根据持久化状态决定是否禁用领取按钮（支持“领取全部”后）
    const stored = getEmails().find((e) => e.id === email.id);
    const alreadyClaimed = stored?.claimed ?? !!email.claimed;
    this.setGainButtonDisabled(alreadyClaimed);

    // 将面板移动到 Canvas/Email 的中心位置
    this.moveToEmailCenter();
  }

  private onGainClicked(): void {
    if (!this.currentEmail) return;
    const ok = claimEmail(this.currentEmail.id);
    if (!ok) return;

    // 禁用或隐藏按钮，避免重复领取
    this.setGainButtonDisabled(true);

    // 更新列表中的勾选显示
    if (this.currentMailNode) {
      const mailComp = this.currentMailNode.getComponent(MailItem);
      if (mailComp) {
        mailComp.setClaimed(true);
      } else {
        const rightNode = this.currentMailNode.getChildByName('Right');
        if (rightNode) rightNode.active = true;
      }
    }

    // 本地状态更新
    this.currentEmail.claimed = true;
  }

  private hidePanel(): void {
    // 关闭时恢复到初始（左侧）位置，不再隐藏
    if (this.originalPos) this.node.setPosition(this.originalPos);
  }

  private setGainButtonDisabled(disabled: boolean): void {
    if (!this.gainButton) return;
    this.gainButton.interactable = !disabled;
  }

  private moveToEmailCenter(): void {
    if (!this.emailRoot) return;
    // 若与 Email 节点同父节点，直接使用其局部坐标对齐
    if (this.node.parent === this.emailRoot.parent) {
      this.node.setPosition(this.emailRoot.position);
      return;
    }
    // 否则使用世界坐标对齐
    const target = this.emailRoot.worldPosition;
    this.node.setWorldPosition(v3(target.x, target.y, target.z));
  }
}