import { _decorator, Component, Node, Label, Button, UITransform } from 'cc';
const { ccclass, property } = _decorator;

// 物品类型定义（碎片类型改为外部传入）
export enum BlackShopItemType {
  AdvancedStone = 'advancedStone',
  ChallengeTicket = 'challengeTicket',
  RecruitTicket = 'recruitTicket',
}

// 支持外部自定义的动态物品类型（例如 r/sr/ssr 碎片）
export type ShopItemType = BlackShopItemType | string;

// 对外接口：由游戏外部传入资源读写与发奖逻辑
export interface BlackShopExternalAPI {
  getDiamond: () => number | Promise<number>;
  getCoin: () => number | Promise<number>;
  spendDiamond: (amount: number) => boolean | Promise<boolean>;
  spendCoin: (amount: number) => boolean | Promise<boolean>;
  grantItem: (type: ShopItemType, quantity: number) => void | Promise<void>;
  // 可选：下一次自动刷新时间（毫秒时间戳）
  getNextRefreshEpochMs?: () => number | Promise<number>;
}

export interface BlackShopCallbacks {
  onBack?: () => void;
  // 每次内部更新后回调最新数值，保证外部同步
  onDiamondUpdate?: (newTotal: number) => void;
  onCoinUpdate?: (newTotal: number) => void;
}

type DiscountRate = 0.75 | 0.5 | null;

interface SectionUI {
  sectionIndex: number; // 1..6
  itemType: ShopItemType;
  quantity: number; // 固定数量
  saleNode: Node | null;
  saleLabel: Label | null;
  priceLabel: Label | null;
  numberLabel: Label | null; // 物品数量的文本
  basePrice: number; // 未打折的基础金币价格（默认读取场景里的 12）
  discount: DiscountRate; // 当前折扣
}

function getLabelText(label: Label | null): string {
  return (label?.string ?? '').trim();
}

function parseIntOr(text: string, fallback: number): number {
  const n = parseInt(text, 10);
  return Number.isFinite(n) ? n : fallback;
}

function formatHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const dd = Math.floor(s / 86400);
  const hh = Math.floor((s % 86400) / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (v: number) => (v < 10 ? `0${v}` : `${v}`);
  return dd > 0 ? `${dd}天${pad(hh)}:${pad(mm)}:${pad(ss)}` : `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

@ccclass('BlackShopPanel')
export class BlackShopPanel extends Component {
  // 基础未打折价格（若无法从场景读取价格时兜底）
  @property
  public defaultBasePrice = 12;

  // 刷新初始消耗与倍增
  @property
  public refreshBaseCost = 10; // 第一次 10 钻

  // 当没有外部提供下一次刷新时间时，默认周期（秒）
  @property
  public defaultRefreshPeriodSeconds = 10 * 60; // 10 分钟

  private refreshCount = 0; // 已刷新次数
  private nextRefreshEpochMs = 0; // 下一次自动刷新时间戳
  private api: BlackShopExternalAPI | null = null;

  private sections: SectionUI[] = [];
  private callbacks: BlackShopCallbacks = {};

  // 外部传入的碎片类型列表（依次对应 r、sr、ssr），若未提供则使用占位字符串
  private fragmentTypeList: string[] = [];
  // 外部传入的每个格子的数量（长度为 6），未提供则走默认
  private externalSectionQuantities: number[] = [];

  // ================= 标题与货币显示（通过装饰器注入） =================
  @property(Node)
  public titleDiamondContainer: Node | null = null;

  @property(Node)
  public titleDiamondIcon: Node | null = null;

  @property(Label)
  public titleDiamondNumberLabel: Label | null = null;

  @property(Label)
  public titleCoinNumberLabel: Label | null = null;

  @property(Node)
  public titleCoinContainer: Node | null = null;

  @property(Node)
  public titleCoinIcon: Node | null = null;

  @property(Label)
  public refreshTimeLabel: Label | null = null;

  // 关闭按钮（Canvas/BlackShop/CloseBtn）
  @property(Node)
  public closeButtonNode: Node | null = null;

  // ================= 刷新按钮 =================
  @property(Node)
  public refreshButtonNode: Node | null = null;

  @property(Label)
  public refreshCostLabel: Label | null = null;

  // ================= 六个板块：通过数组顺序对应 section1..section6 =================
  @property({ type: [Node] })
  public sectionSaleNodes: Node[] = [];

  @property({ type: [Label] })
  public sectionSaleLabels: Label[] = [];

  @property({ type: [Label] })
  public sectionPriceLabels: Label[] = [];

  @property({ type: [Label] })
  public sectionNumberLabels: Label[] = [];

  // 每个格子的点击节点（可指向 sectionX 或其 Price 区域）
  @property({ type: [Node] })
  public sectionClickNodes: Node[] = [];

  onLoad(): void {
    // 构建 UI 引用
    this.buildSectionsFromProps();
    this.updateCurrencies();
    this.refreshSections();
    this.bindRefreshButton();
    this.bindSectionButtons();
    this.bindCloseButton();
    this.initRefreshTimer();
    this.adjustAllCurrencyWidths();
  }

  // 外部设置回调接口
  public setExternalAPI(api: BlackShopExternalAPI): void {
    this.api = api;
    this.updateCurrencies();
    this.initRefreshTimer();
  }

  public setCallbacks(callbacks: Partial<BlackShopCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // 外部设置 r/sr/ssr 的物品类型（字符串即可，例如 'rFragment'）
  public setFragmentTypes(types: string[]): void {
    this.fragmentTypeList = Array.isArray(types) ? types.slice(0, 3) : [];
    this.buildSectionsFromProps();
  }

  // 外部设置六个格子的物品数量（长度建议为 6）
  public setSectionQuantities(quantities: number[]): void {
    this.externalSectionQuantities = Array.isArray(quantities) ? quantities.slice(0, 6) : [];
    this.buildSectionsFromProps();
  }

  // 购买接口：外部可调用，或你可在按钮事件里调用
  public async buySection(index1to6: number): Promise<boolean> {
    const sec = this.sections.find(s => s.sectionIndex === index1to6);
    if (!sec || !sec.priceLabel) return false;
    const price = parseIntOr(getLabelText(sec.priceLabel), sec.basePrice);
    const ok = await this.trySpendCoin(price);
    if (!ok) return false;
    // 发放物品
    await this.api?.grantItem(sec.itemType, sec.quantity);
    // 扣费成功后，内部已更新金币显示并通过回调告知外部
    return true;
  }

  // =============== UI/节点收集 ===============
  private buildSectionsFromProps(): void {
    const baseTypes: ShopItemType[] = [
      BlackShopItemType.AdvancedStone,
      BlackShopItemType.ChallengeTicket,
      BlackShopItemType.RecruitTicket,
    ];
    // 若外部传入不足 3 项，使用占位字符串补齐；完全未传则使用默认占位
    const fragmentTypes: ShopItemType[] =
      this.fragmentTypeList.length >= 3
        ? this.fragmentTypeList.slice(0, 3)
        : this.fragmentTypeList.length > 0
          ? [
              ...this.fragmentTypeList,
              ...Array(Math.max(0, 3 - this.fragmentTypeList.length)).fill('fragment'),
            ]
          : ['rFragment', 'srFragment', 'ssrFragment'];
    const types: ShopItemType[] = [...baseTypes, ...fragmentTypes];

    const quantities =
      this.externalSectionQuantities.length === 6
        ? this.externalSectionQuantities.slice(0, 6)
        : [20, 10, 5, 10, 8, 5];

    this.sections = [];
    for (let i = 0; i < 6; i++) {
      const saleNode = this.sectionSaleNodes[i] ?? null;
      const saleLabel = this.sectionSaleLabels[i] ?? null;
      const priceLabel = this.sectionPriceLabels[i] ?? null;
      const numberLabel = this.sectionNumberLabels[i] ?? null;
      const basePrice = parseIntOr(getLabelText(priceLabel ?? null), this.defaultBasePrice);
      this.sections.push({
        sectionIndex: i + 1,
        itemType: types[i],
        quantity: quantities[i],
        saleNode,
        saleLabel,
        priceLabel,
        numberLabel,
        basePrice,
        discount: null,
      });
    }
  }

  // =============== 货币显示与宽度自适应 ===============
  private async updateCurrencies(): Promise<void> {
    const diamondLabel = this.titleDiamondNumberLabel;
    const coinLabel = this.titleCoinNumberLabel;
    if (this.api) {
      try {
        const [d, c] = await Promise.all([
          Promise.resolve(this.api.getDiamond()),
          Promise.resolve(this.api.getCoin()),
        ]);
        if (diamondLabel) diamondLabel.string = `${Math.max(0, Math.floor(d ?? 0))}`;
        if (coinLabel) coinLabel.string = `${Math.max(0, Math.floor(c ?? 0))}`;
      } catch {
        // 若外部接口异常，保留现有显示
      }
    }
    // 钻石/金币容器宽度自适应
    this.adjustAllCurrencyWidths();
  }

  private adjustCurrencyContainerWidth(
    container: Node | null,
    iconNode: Node | null,
    numberLabel: Label | null,
    padding = 12,
    minWidth = 60,
  ): void {
    const ui = container?.getComponent(UITransform);
    if (!ui || !numberLabel) return;
    const iconUI = iconNode?.getComponent(UITransform) ?? null;
    const iconScaleX = iconNode ? iconNode.scale.x : 1;
    const iconWidth = iconUI ? iconUI.contentSize.width * iconScaleX : 0;
    const numUI = numberLabel.node.getComponent(UITransform);
    const text = numberLabel.string ?? '';
    const approx = (text.length || 1) * (numberLabel.fontSize || 20) * 0.6;
    const numWidth = numUI ? Math.min(numUI.contentSize.width, approx * 1.15) : approx;
    const newWidth = Math.max(minWidth, Math.floor(iconWidth + numWidth + padding));
    ui.setContentSize(newWidth, ui.contentSize.height);
  }

  private adjustAllCurrencyWidths(): void {
    this.adjustCurrencyContainerWidth(this.titleDiamondContainer, this.titleDiamondIcon, this.titleDiamondNumberLabel);
    this.adjustCurrencyContainerWidth(this.titleCoinContainer, this.titleCoinIcon, this.titleCoinNumberLabel);
  }

  // =============== 刷新时间显示 ===============
  private computeNext5amEpochMs(fromMs?: number): number {
    const nowMs = typeof fromMs === 'number' ? fromMs : Date.now();
    const d = new Date(nowMs);
    const next = new Date(d);
    next.setHours(5, 0, 0, 0);
    if (next.getTime() <= nowMs) {
      next.setDate(next.getDate() + 1);
      next.setHours(5, 0, 0, 0);
    }
    return next.getTime();
  }

  private async initRefreshTimer(): Promise<void> {
    try {
      if (this.api?.getNextRefreshEpochMs) {
        const ts = await Promise.resolve(this.api.getNextRefreshEpochMs());
        const validTs = Number.isFinite(ts as number) ? (ts as number) : 0;
        this.nextRefreshEpochMs = validTs > Date.now() ? validTs : this.computeNext5amEpochMs();
      } else {
        this.nextRefreshEpochMs = this.computeNext5amEpochMs();
      }
    } catch {
      this.nextRefreshEpochMs = Date.now() + this.defaultRefreshPeriodSeconds * 1000;
    }
    this.updateRefreshTimeLabel();
    this.unschedule(this.tickRefreshTime);
    this.schedule(this.tickRefreshTime, 1);
  }

  private tickRefreshTime = (): void => {
    const remainMs = this.nextRefreshEpochMs - Date.now();
    if (remainMs <= 0) {
      // 到点自动刷新一轮，重置到下一次凌晨 5 点
      this.refreshSections();
      this.nextRefreshEpochMs = this.computeNext5amEpochMs();
    }
    this.updateRefreshTimeLabel();
  };

  private updateRefreshTimeLabel(): void {
    const label = this.refreshTimeLabel;
    if (!label) return;
    const remainSec = Math.max(0, Math.floor((this.nextRefreshEpochMs - Date.now()) / 1000));
    label.string = `刷新剩余时间${formatHMS(remainSec)}`;
  }

  // =============== 折扣与价格 ===============
  private refreshSections(): void {
    // 15% 概率打折；打折后 70% => 7.5折，30% => 5折；保底至少一个打折
    let anyDiscount = false;
    for (const s of this.sections) {
      const roll = Math.random();
      if (roll < 0.15) {
        s.discount = Math.random() < 0.7 ? 0.75 : 0.5;
        anyDiscount = true;
      } else {
        s.discount = null;
      }
    }
    if (!anyDiscount && this.sections.length > 0) {
      const i = Math.floor(Math.random() * this.sections.length);
      this.sections[i].discount = Math.random() < 0.7 ? 0.75 : 0.5;
    }

    // 应用到 UI：Sale 标签显示与价格折算；数量显示
    for (const s of this.sections) {
      if (s.saleNode) s.saleNode.active = !!s.discount;
      if (s.saleLabel) {
        s.saleLabel.string = s.discount === 0.5 ? '5折' : s.discount === 0.75 ? '7.5折' : '';
      }
      // 数量文本
      if (s.numberLabel) s.numberLabel.string = `${s.quantity}`;

      // 价格折算：读取基础价格（若已有）
      const base = s.basePrice ?? this.defaultBasePrice;
      const finalPrice = s.discount ? Math.max(1, Math.round(base * s.discount)) : base;
      if (s.priceLabel) s.priceLabel.string = `${finalPrice}`;
    }
  }

  // =============== 刷新按钮（递增钻石消耗） ===============
  private bindRefreshButton(): void {
    const node = this.refreshButtonNode;
    if (!node) return;
    // 直接监听触摸事件；若场景后期加了 Button 也可兼容
    node.on(Node.EventType.TOUCH_END, () => { this.handleRefreshClick(); });
    this.updateRefreshCostLabel();
  }

  // =============== 购买按钮绑定（每个格子） ===============
  private bindSectionButtons(): void {
    for (let i = 0; i < this.sectionClickNodes.length; i++) {
      const node = this.sectionClickNodes[i];
      if (!node) continue;
      const index = i + 1;
      node.off(Node.EventType.TOUCH_END); // 防止重复绑定
      node.on(Node.EventType.TOUCH_END, () => { this.buySection(index); });
    }
  }

  private updateRefreshCostLabel(): void {
    const lbl = this.refreshCostLabel;
    if (!lbl) return;
    const cost = this.getCurrentRefreshCost();
    lbl.string = `×${cost}`;
  }

  private getCurrentRefreshCost(): number {
    // 第一次 10，第二次 20，第三次 40，之后继续 *2
    return this.refreshBaseCost * Math.pow(2, this.refreshCount);
  }

  private async handleRefreshClick(): Promise<void> {
    const cost = this.getCurrentRefreshCost();
    const ok = await this.trySpendDiamond(cost);
    if (!ok) return; // 钻石不足
    this.refreshCount++;
    this.refreshSections();
    this.updateRefreshCostLabel();
    // 手动刷新后，同步将下一次自动刷新时间设为下一次凌晨 5 点
    this.nextRefreshEpochMs = this.computeNext5amEpochMs();
    this.updateRefreshTimeLabel();
    // 内部扣减已完成，并已通过回调告知外部；不再主动拉取外部数值
  }

  // =============== 关闭按钮绑定 ===============
  private bindCloseButton(): void {
    const node = this.closeButtonNode;
    if (!node) return;
    const btn = node.getComponent(Button);
    const handler = () => {
      if (this.callbacks.onBack) {
        try { this.callbacks.onBack(); } catch {}
      }
    };
    if (btn) {
      node.on(Button.EventType.CLICK, handler);
    } else {
      node.on(Node.EventType.TOUCH_END, handler);
    }
  }

  // =============== 货币扣除（外部回调优先） ===============
  private async trySpendDiamond(amount: number): Promise<boolean> {
    try {
      // 本地扣减：读取标题钻石数字，足够则扣除并更新显示
      const diamondLabel = this.titleDiamondNumberLabel;
      const cur = parseIntOr(getLabelText(diamondLabel ?? null), 0);
      if (cur < amount) return false;
      const next = Math.max(0, cur - amount);
      if (diamondLabel) diamondLabel.string = `${next}`;
      this.adjustAllCurrencyWidths();
      // 回调外部最新数值，保证外部同步
      if (this.callbacks.onDiamondUpdate) {
        try { this.callbacks.onDiamondUpdate(next); } catch {}
      }
      return true;
    } catch {
      return false;
    }
  }

  private async trySpendCoin(amount: number): Promise<boolean> {
    try {
      const coinLabel = this.titleCoinNumberLabel;
      const cur = parseIntOr(getLabelText(coinLabel ?? null), 0);
      if (cur < amount) return false;
      const next = Math.max(0, cur - amount);
      if (coinLabel) coinLabel.string = `${next}`;
      this.adjustAllCurrencyWidths();
      if (this.callbacks.onCoinUpdate) {
        try { this.callbacks.onCoinUpdate(next); } catch {}
      }
      return true;
    } catch {
      return false;
    }
  }
}