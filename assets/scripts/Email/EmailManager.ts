import { director, find, Node, sys } from 'cc';

export type OnBackToMainHandler = (currentLevel: number) => void;

export interface EmailItem {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  claimed: boolean;
  level?: number;
}

const STORAGE_KEYS = {
  emails: 'LLYX_EMAIL_LIST',
  welcomeSent: 'LLYX_EMAIL_WELCOME_SENT',
  chapter1Sent: 'LLYX_EMAIL_CHAPTER1_SENT',
};

let onBackToMainHandler: OnBackToMainHandler | null = null;
let currentLevelProvider: (() => number) | null = null;

/**
 * 设置外部传入的参数与方法（回调、关卡提供者等）
 */
export function setupEmailModule(options?: {
  onBackToMain?: OnBackToMainHandler;
  currentLevel?: number | (() => number);
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

function addEmail(title: string, body: string, level?: number): void {
  const list = loadEmails();
  const email: EmailItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title,
    body,
    createdAt: Date.now(),
    claimed: false,
    level,
  };
  list.push(email);
  saveEmails(list);
}

function triggerWelcome(currentLevel: number): void {
  if (!sys.localStorage.getItem(STORAGE_KEYS.welcomeSent)) {
    addEmail('欢迎来到流浪英雄', '祝你冒险顺利！', currentLevel);
    sys.localStorage.setItem(STORAGE_KEYS.welcomeSent, '1');
  }
}

function triggerChapter1Complete(currentLevel: number): void {
  // 当完成第一章（示例：关卡>=1）时发送邮件
  if (currentLevel >= 1 && !sys.localStorage.getItem(STORAGE_KEYS.chapter1Sent)) {
    addEmail('第一章完成奖励', '恭喜通关第一章，领取你的奖励！', currentLevel);
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
    // 运行时新增控制器组件，避免编辑器手动挂载
    try {
      // 动态引入以避免循环依赖
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Controller = require('./EmailController');
      const CompClass = Controller?.EmailController;
      if (CompClass) {
        const comp = emailNode.addComponent(CompClass) as InstanceType<typeof CompClass>;
        comp.initialize({
          getCurrentLevel: currentLevelProvider ?? (() => level),
          onBack: (lv: number) => onBackToMain(lv),
        });
      }
    } catch (e) {
      console.warn('[Email] addComponent EmailController failed:', e);
    }
  });
}