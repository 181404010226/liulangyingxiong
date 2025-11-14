import { _decorator, Component, Node, find, Button, Label, ScrollView } from 'cc';
const { ccclass } = _decorator;

export interface EmailControllerOptions {
  getCurrentLevel: () => number;
  onBack: (currentLevel: number) => void;
}

@ccclass('EmailController')
export class EmailController extends Component {
  private options: EmailControllerOptions | null = null;

  initialize(options: EmailControllerOptions): void {
    this.options = options;
  }

  start(): void {
    // 绑定关闭按钮
    const closeBtnNode = find('Canvas/Email/CloseBtn');
    if (closeBtnNode) {
      closeBtnNode.on(Node.EventType.TOUCH_END, this.handleClose, this);
    }

    // 可选：显示未读邮件数量或简单列表（如果 UI 中存在对应节点）
    const titleLabelNode = find('Canvas/Email/Title/TitleName');
    const titleLabel = titleLabelNode?.getComponent(Label);
    if (titleLabel) {
      titleLabel.string = '邮件';
    }

    // 如果未来需要，ScrollView 可用于渲染邮件列表
    const svNode = find('Canvas/Email/ScrollView');
    const sv = svNode?.getComponent(ScrollView);
    if (sv) {
      // 目前不做具体渲染，保留占位以便后续扩展
    }
  }

  private handleClose(): void {
    const level = this.options?.getCurrentLevel?.() ?? 0;
    try {
      this.options?.onBack(level);
    } catch (e) {
      console.warn('[EmailController] onBack error:', e);
    }
  }
}