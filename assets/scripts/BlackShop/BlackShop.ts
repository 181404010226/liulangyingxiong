import { _decorator, Component, Button, Label, Node } from 'cc';
import { BlackShopStorage } from './BlackShopStorage';
const { ccclass, property } = _decorator;

export type SectionPurchaseHandler = (amount: number) => void;

export interface BlackShopCallbacks {
  onBack?: () => void;
  onSection?: (index: number, amount: number) => void;
  onSection1?: SectionPurchaseHandler;
  onSection2?: SectionPurchaseHandler;
  onSection3?: SectionPurchaseHandler;
  onSection4?: SectionPurchaseHandler;
  onSection5?: SectionPurchaseHandler;
  onSection6?: SectionPurchaseHandler;
}

@ccclass('BlackShopPanel')
export class BlackShopPanel extends Component {
  @property({ type: Button })
  public backButton: Button | null = null;

  @property({ type: [Button] })
  public sectionButtons: Button[] = [];

  @property({ type: [Label] })
  public sectionAmountLabels: Label[] = [];

  // 价格文本：Canvas/BlackShop/ScrollView/view/content/sectionX/Price 下的 Label
  @property({ type: [Label] })
  public sectionPriceLabels: Label[] = [];

  // “首充翻倍”徽记节点：Canvas/BlackShop/ScrollView/view/content/sectionX/Double
  @property({ type: [Node] })
  public sectionDoubleNodes: Node[] = [];

  private callbacks: BlackShopCallbacks = {};

  // 本地记录：是否已点击（视作购买）
  private purchasedFlags: boolean[] = [];
  // 当前周期内该挡位是否享受首次翻倍
  private doubleAvailableFlags: boolean[] = [];

  public setCallbacks(callbacks: Partial<BlackShopCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  start(): void {
    this.initializeFlags();
    this.bindBackButton();
    this.bindSectionButtons();
  }

  private bindBackButton(): void {
    const btn = this.backButton;
    if (!btn) return;
    btn.node.on(Button.EventType.CLICK, () => {
      if (this.callbacks.onBack) {
        this.callbacks.onBack();
      }
    });
  }

  private bindSectionButtons(): void {
    const count = this.sectionButtons.length;
    for (let idx = 0; idx < count; idx++) {
      const button = this.sectionButtons[idx];
      const amount = this.readSectionAmountByIndex(idx) ?? 0;
      if (!button) continue;

      button.node.on(Button.EventType.CLICK, () => {
        const sectionIndex = idx + 1;
        const isDouble = this.doubleAvailableFlags[idx] ?? true;
        const effectiveAmount = isDouble ? amount * 2 : amount;
        const specific = (this.callbacks as any)[`onSection${sectionIndex}`] as
          SectionPurchaseHandler | undefined;
        if (specific) {
          specific(effectiveAmount);
          return;
        }
        if (this.callbacks.onSection) {
          this.callbacks.onSection(sectionIndex, effectiveAmount);
        }

        // 本次点击视为购买：隐藏该挡位的“首充翻倍”，并标记
        this.markPurchased(idx);
        // 如果所有挡位都已购买，则重置“首次钻石翻倍”
        this.checkAndResetDoubleIfAllPurchased();
      });
    }
  }

  // Reads the diamond amount from the parallel sectionAmountLabels array
  private readSectionAmountByIndex(index: number): number | null {
    const lbl = this.sectionAmountLabels[index];
    if (!lbl) return null;
    const text = (lbl.string || '').trim();
    const num = parseInt(text, 10);
    return Number.isFinite(num) ? num : null;
  }

  // （可选）读取价格：文本形如 “￥ 12”，返回数值 12
  private readSectionPriceByIndex(index: number): number | null {
    const lbl = this.sectionPriceLabels[index];
    if (!lbl) return null;
    const raw = (lbl.string || '').replace(/[^0-9.]/g, '').trim();
    const val = parseFloat(raw);
    return Number.isFinite(val) ? val : null;
  }

  private initializeFlags(): void {
    const count = this.sectionButtons.length;
    this.purchasedFlags = BlackShopStorage.loadPurchasedFlags(count);
    this.doubleAvailableFlags = BlackShopStorage.loadDoubleAvailableFlags(count);
    for (let i = 0; i < count; i++) {
      const node = this.sectionDoubleNodes[i];
      if (node) node.active = this.doubleAvailableFlags[i];
    }
  }

  private markPurchased(index: number): void {
    this.purchasedFlags[index] = true;
    this.doubleAvailableFlags[index] = false;
    const node = this.sectionDoubleNodes[index];
    if (node) node.active = false;
    BlackShopStorage.savePurchasedFlags(this.purchasedFlags);
    BlackShopStorage.saveDoubleAvailableFlags(this.doubleAvailableFlags);
  }

  private checkAndResetDoubleIfAllPurchased(): void {
    const count = this.sectionButtons.length;
    if (count === 0) return;
    const allPurchased = this.purchasedFlags.length === count && this.purchasedFlags.every(Boolean);
    if (!allPurchased) return;

    // 重置“首次钻石翻倍”周期：所有挡位再次享受翻倍，并显示徽记
    this.purchasedFlags = new Array(count).fill(false);
    this.doubleAvailableFlags = new Array(count).fill(true);
    this.sectionDoubleNodes.forEach(n => { if (n) n.active = true; });
    BlackShopStorage.savePurchasedFlags(this.purchasedFlags);
    BlackShopStorage.saveDoubleAvailableFlags(this.doubleAvailableFlags);
  }

  // 提供一个公开方法以手动重置（例如外部触发充值重置功能时）
  public resetFirstChargeDouble(): void {
    const count = this.sectionButtons.length;
    this.purchasedFlags = new Array(count).fill(false);
    this.doubleAvailableFlags = new Array(count).fill(true);
    this.sectionDoubleNodes.forEach(n => { if (n) n.active = true; });
    BlackShopStorage.savePurchasedFlags(this.purchasedFlags);
    BlackShopStorage.saveDoubleAvailableFlags(this.doubleAvailableFlags);
  }
}