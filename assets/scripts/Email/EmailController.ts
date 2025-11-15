import { _decorator, Component, Node, find, Button, Label, ScrollView, Prefab, instantiate, resources } from 'cc';
import { MailItem } from './MailItem';
import { getEmails, claimAllUnclaimed, checkUnclaimedEmails, EmailItem } from './EmailManager';
import { EmailPanel } from './EmailPanel';
const { ccclass, property } = _decorator;

export interface EmailControllerOptions {
  getCurrentLevel: () => number;
  onBack: (currentLevel: number) => void;
}

@ccclass('EmailController')
export class EmailController extends Component {
  private options: EmailControllerOptions | null = null;
  public callbacks: { onBack?: (currentLevel: number) => void } = {};

  // 装饰器：场景节点与资源引用（可在编辑器中拖拽赋值）
  @property(Node)
  emailRoot: Node | null = null; // Canvas/Email

  @property(Node)
  closeButtonNode: Node | null = null; // Canvas/Email/CloseBtn

  @property(Node)
  buttonsRoot: Node | null = null; // Canvas/Email/Buttons

  @property(Button)
  deleteButton: Button | null = null; // Canvas/Email/Buttons/Delete

  @property(Button)
  gainAllButton: Button | null = null; // Canvas/Email/Buttons/GainAll

  @property(ScrollView)
  emailScrollView: ScrollView | null = null; // Canvas/Email/ScrollView

  @property(Node)
  contentNode: Node | null = null; // Canvas/Email/ScrollView/view/content

  @property(Node)
  emailPanelNode: Node | null = null; // Canvas/EmailPanel

  @property(Prefab)
  mailPrefab: Prefab | null = null; // resources/prefabs/mail.prefab

  // 渲染列表与状态（与 EmailManager 的持久化数据对应）
  private mails: { id: string; claimed: boolean; node: Node }[] = [];

  initialize(options: EmailControllerOptions): void {
    this.options = options;
    // 允许外部以 callbacks 方式传入回调，保持与其它面板一致的风格
    this.callbacks.onBack = options.onBack;
  }

  start(): void {
    this.bindCloseButton();

    // 可选：显示未读邮件数量或简单列表（如果 UI 中存在对应节点）
    const titleLabelNode = find('Canvas/Email/Title/TitleName');
    const titleLabel = titleLabelNode?.getComponent(Label);
    if (titleLabel) {
      titleLabel.string = '邮件';
    }

    // 如果未来需要，ScrollView 可用于渲染邮件列表
    if (!this.emailScrollView) {
      const svNode = find('Canvas/Email/ScrollView');
      this.emailScrollView = svNode?.getComponent(ScrollView) ?? null;
    }

    // 绑定“领取全部”和“删除已读”
    this.bindActionButtons();

    // 初始化列表：从 EmailManager 的持久化数据渲染
    this.setupInitialMails();
  }

  private handleClose(): void {
    const level = this.options?.getCurrentLevel?.() ?? 0;
    try {
      // 使用外部回调（与 Diamond/BlackShop 的 onBack 风格保持一致）
      this.callbacks?.onBack?.(level);
    } catch (e) {
      console.warn('[EmailController] onBack error:', e);
    }
  }

  private bindCloseButton(): void {
    if (!this.closeButtonNode) {
      this.closeButtonNode = find('Canvas/Email/CloseBtn');
    }
    this.closeButtonNode?.on(Node.EventType.TOUCH_END, this.handleClose, this);
  }

  private bindActionButtons(): void {
    if (!this.deleteButton) {
      const deleteBtnNode = find('Canvas/Email/Buttons/Delete');
      this.deleteButton = deleteBtnNode?.getComponent(Button) ?? null;
    }
    if (!this.gainAllButton) {
      const gainAllBtnNode = find('Canvas/Email/Buttons/GainAll');
      this.gainAllButton = gainAllBtnNode?.getComponent(Button) ?? null;
    }

    // 删除已读：暂不实现，仅提示
    this.deleteButton?.node.on(Node.EventType.TOUCH_END, () => {
      console.log('[EmailController] 删除已读：暂不实现');
    });

    // 领取全部：遍历所有邮件并标记为已领取
    this.gainAllButton?.node.on(Node.EventType.TOUCH_END, () => {
      this.claimAllRewards();
    });
  }

  private async setupInitialMails(): Promise<void> {
    const content = this.getContentNode();
    if (!content) return;

    // 加载预制体
    const prefab = await this.loadMailPrefab();
    
    // 确保触发必要邮件（欢迎/章节），然后从持久化列表渲染
    const level = this.options?.getCurrentLevel?.() ?? 0;
    try {
      checkUnclaimedEmails(level);
    } catch {}

    const emails = getEmails();
    // 清空旧节点
    content.removeAllChildren();
    this.mails = [];

    for (const e of emails) {
      const mailNode = instantiate(prefab);

      // 设置标题
      const titleLabel = mailNode
        .getChildByName('text')
        ?.getChildByName('Title')
        ?.getComponent(Label);
      if (titleLabel) {
        titleLabel.string = e.title;
      }

      // 组件控制显示与奖励数
      const comp = mailNode.addComponent(MailItem);
      comp.setAmounts(e.coinAmount ?? 0, e.diamondAmount ?? 0);
      comp.setClaimed(e.claimed);

      // 点击打开详情：传递该邮件数据与节点
      mailNode.on(Node.EventType.TOUCH_END, () => this.openEmailPanelForEmail(e, mailNode), this);

      content.addChild(mailNode);
      this.mails.push({ id: e.id, claimed: e.claimed, node: mailNode });
    }
  }

  private getContentNode(): Node | null {
    if (this.contentNode) return this.contentNode;
    const node = find('Canvas/Email/ScrollView/view/content');
    this.contentNode = node ?? null;
    return this.contentNode;
  }

  private loadMailPrefab(): Promise<Prefab> {
    if (this.mailPrefab) return Promise.resolve(this.mailPrefab);
    return new Promise((resolve, reject) => {
      resources.load('prefabs/mail', Prefab, (err, prefab) => {
        if (err || !prefab) {
          console.error('[EmailController] 加载 mail.prefab 失败:', err);
          reject(err ?? new Error('mail.prefab not found'));
          return;
        }
        this.mailPrefab = prefab;
        resolve(prefab);
      });
    });
  }

  // 旧的 addMail 逻辑已改为通过 EmailManager 数据渲染，不再使用

  private openEmailPanel(type: 'welcome' | 'chapter1'): void {
    if (!this.emailPanelNode) {
      this.emailPanelNode = find('Canvas/EmailPanel');
    }
    if (this.emailPanelNode) {
      // 不再切换 active，由 EmailPanel 在展示时自行定位到中心
      console.log('[EmailController] 打开邮件详情面板：', type);
    }
  }

  private openEmailPanelForEmail(email: EmailItem, mailNode: Node): void {
    if (!this.emailPanelNode) {
      this.emailPanelNode = find('Canvas/EmailPanel');
    }
    if (!this.emailPanelNode) return;
    const panelComp = this.emailPanelNode.getComponent(EmailPanel);
    if (panelComp) {
      panelComp.showEmail(email, mailNode);
    }
    // 不再切换 active
  }

  private claimAllRewards(): void {
    // 先执行业务逻辑：持久化并触发奖励回调
    const result = claimAllUnclaimed();

    // 再刷新当前渲染的 UI 状态
    this.mails.forEach((m) => {
      // 使用挂载在预制体上的组件控制显示
      const comp = m.node.getComponent(MailItem);
      if (comp) {
        comp.claim();
      } else {
        const rightNode = m.node.getChildByName('Right');
        if (rightNode) rightNode.active = true;
      }
      m.claimed = true;
    });
    console.log('[EmailController] 已领取全部邮件奖励：', result);
  }
}