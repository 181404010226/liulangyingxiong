import { director, find, Node, sys } from 'cc';
import { EmailController } from './EmailController';

export type OnBackToMainHandler = (currentLevel: number) => void;
export type AddCoinsHandler = (amount: number) => void;
export type AddDiamondsHandler = (amount: number) => void;

export interface EmailItem {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  claimed: boolean;
  level?: number;
  coinAmount?: number;
  diamondAmount?: number;
}

const STORAGE_KEYS = {
  emails: 'LLYX_EMAIL_LIST',
  welcomeSent: 'LLYX_EMAIL_WELCOME_SENT',
  chapter1Sent: 'LLYX_EMAIL_CHAPTER1_SENT',
};

let onBackToMainHandler: OnBackToMainHandler | null = null;
let currentLevelProvider: (() => number) | null = null;
let addCoinsHandler: AddCoinsHandler | null = null;
let addDiamondsHandler: AddDiamondsHandler | null = null;

/**
 * 设置外部传入的参数与方法（回调、关卡提供者等）
 */
export function setupEmailModule(options?: {
  onBackToMain?: OnBackToMainHandler;
  currentLevel?: number | (() => number);
  addCoins?: AddCoinsHandler;
  addDiamonds?: AddDiamondsHandler;
}): void {
  if (options?.onBackToMain) {
    onBackToMainHandler = options.onBackToMain;
  }
  if (typeof options?.currentLevel === 'number') {
    const fixedLevel = options.currentLevel;
    currentLevelProvider = () => fixedLevel;
  } else if (typeof options?.currentLevel === 'function') {
    currentLevelProvider = options.currentLevel as () => number;
  }
  if (options?.addCoins) {
    addCoinsHandler = options.addCoins;
  }
  if (options?.addDiamonds) {
    addDiamondsHandler = options.addDiamonds;
  }
}

function loadEmails(): EmailItem[] {
  try {
    const raw = sys.localStorage.getItem(STORAGE_KEYS.emails);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error('[Email] loadEmails error:', e);
    return [];
  }
}

function saveEmails(list: EmailItem[]): void {
  try {
    sys.localStorage.setItem(STORAGE_KEYS.emails, JSON.stringify(list));
  } catch (e) {
    console.error('[Email] saveEmails error:', e);
  }
}

function addEmail(title: string, body: string, level?: number, coinAmount: number = 0, diamondAmount: number = 0): void {
  const list = loadEmails();
  const email: EmailItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title,
    body,
    createdAt: Date.now(),
    claimed: false,
    level,
    coinAmount,
    diamondAmount,
  };
  list.push(email);
  saveEmails(list);
}

function triggerWelcome(currentLevel: number): void {
  if (!sys.localStorage.getItem(STORAGE_KEYS.welcomeSent)) {
    // 默认欢迎奖励：金币100，钻石3（可按需调整）
    addEmail('欢迎来到流浪英雄', '祝你冒险顺利！', currentLevel, 100, 3);
    sys.localStorage.setItem(STORAGE_KEYS.welcomeSent, '1');
  }
}

function triggerChapter1Complete(currentLevel: number): void {
  // 当完成第一章（示例：关卡>=1）时发送邮件
  if (currentLevel >= 1 && !sys.localStorage.getItem(STORAGE_KEYS.chapter1Sent)) {
    // 默认第一章奖励：金币200，钻石2（可按需调整）
    addEmail('第一章完成奖励', '恭喜通关第一章，领取你的奖励！', currentLevel, 200, 2);
    sys.localStorage.setItem(STORAGE_KEYS.chapter1Sent, '1');
  }
}

/**
 * 检查是否存在未领取的邮件
 * @param currentLevel 当前关卡进度
 * @returns 是否存在未领取邮件
 */
export function checkUnclaimedEmails(currentLevel: number): boolean {
  // 触发配置中的邮件
  try {
    triggerWelcome(currentLevel);
    triggerChapter1Complete(currentLevel);
  } catch (e) {
    console.warn('[Email] trigger error:', e);
  }

  const list = loadEmails();
  return list.some((e) => !e.claimed);
}

/**
 * 返回主界面回调（Email 内部触发，外部可注册自定义实现）
 */
export function onBackToMain(currentLevel: number): void {
  if (onBackToMainHandler) {
    try {
      onBackToMainHandler(currentLevel);
      return;
    } catch (e) {
      console.error('[Email] onBackToMain handler error:', e);
    }
  }
  // 默认降级：尝试返回名为"shop"的场景
  try {
    director.loadScene('shop');
  } catch (e) {
    console.warn('[Email] fallback loadScene("shop") failed:', e);
  }
}

export function getEmails(): EmailItem[] {
  return loadEmails();
}

export function markEmailClaimed(id: string): boolean {
  const list = loadEmails();
  const idx = list.findIndex((e) => e.id === id);
  if (idx >= 0) {
    list[idx].claimed = true;
    saveEmails(list);
    return true;
  }
  return false;
}

function grantRewards(coin: number = 0, diamond: number = 0): void {
  try {
    if (coin && addCoinsHandler) {
      addCoinsHandler(coin);
    }
    if (diamond && addDiamondsHandler) {
      addDiamondsHandler(diamond);
    }
  } catch (e) {
    console.warn('[Email] grantRewards handler error:', e);
  }
}

/**
 * 按ID领取单封邮件：持久化并调用奖励回调
 */
export function claimEmail(id: string): boolean {
  const list = loadEmails();
  const idx = list.findIndex((e) => e.id === id);
  if (idx < 0) return false;
  const item = list[idx];
  if (item.claimed) return false;
  item.claimed = true;
  saveEmails(list);
  const coin = item.coinAmount ?? 0;
  const diamond = item.diamondAmount ?? 0;
  grantRewards(coin, diamond);
  return true;
}

/**
 * 领取全部未领取邮件：逐封调用奖励回调并持久化
 */
export function claimAllUnclaimed(): { claimedCount: number; totalCoins: number; totalDiamonds: number } {
  const list = loadEmails();
  let claimedCount = 0;
  let totalCoins = 0;
  let totalDiamonds = 0;
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item.claimed) {
      item.claimed = true;
      const c = item.coinAmount ?? 0;
      const d = item.diamondAmount ?? 0;
      totalCoins += c;
      totalDiamonds += d;
      grantRewards(c, d);
      claimedCount++;
    }
  }
  saveEmails(list);
  return { claimedCount, totalCoins, totalDiamonds };
}

/**
 * 打开并初始化邮件场景：在场景加载后为 Canvas/Email 绑定控制器
 */
export function openEmailScene(): void {
  const level = currentLevelProvider ? currentLevelProvider() : 0;
  director.loadScene('Email', () => {
    const emailNode = find('Canvas/Email');
    if (!emailNode) {
      console.warn('[Email] Canvas/Email node not found.');
      return;
    }
    // 已静态挂载：仅获取并初始化控制器，避免重复挂载
    try {
      const comp = emailNode.getComponent(EmailController);
      if (!comp) {
        console.warn('[Email] EmailController not found on Canvas/Email. 请确认已在编辑器静态挂载');
        return;
      }
      comp.initialize({
        getCurrentLevel: currentLevelProvider ?? (() => level),
        onBack: (lv: number) => onBackToMain(lv),
      });
    } catch (e) {
      console.warn('[Email] initialize EmailController failed:', e);
    }
  });
}