import { _decorator, Component, Node, Vec3, Animation, AnimationClip } from 'cc';
import type { HeroConfig, HeroAscend } from '../data/HeroRegistry';
const { ccclass, property } = _decorator;

/**
 * Hero 控制器：
 * - 接收队友/敌人的节点数组
 * - 在战斗中根据攻击距离移动、并播放 run/idle 动画
 * - 在可攻击时按攻速触发攻击动画，技能条满优先放技能
 * - 公共字段暴露最终属性（基础/战斗），无需保留成长配置
 */
@ccclass('HeroController')
export class HeroController extends Component {
  // —— 上下文（由 BattlePageManager 设置） ——
  @property({ tooltip: '是否为我方' })
  isAlly: boolean = true;

  @property({ tooltip: '英雄名字（用于计算属性/日志）' })
  heroName: string = '';

  // 场上角色引用（包含自己）
  @property({ type: [Node], tooltip: '队友（包含自己）预览' })
  public editorAllies: Node[] = [];

  @property({ type: [Node], tooltip: '敌人预览' })
  public editorEnemies: Node[] = [];

  public allies: Node[] = [];
  public enemies: Node[] = [];

  // —— 最终属性（计算后只保留数值） ——
  public finalBasic: Record<string, number> = {};
  public finalCombat: Record<string, number> = {};

  // —— 编辑器可视化预览 ——
  @property({ tooltip: '最终基础属性（JSON 预览）' })
  public editorFinalBasicJSON: string = '';

  @property({ tooltip: '最终战斗属性（JSON 预览）' })
  public editorFinalCombatJSON: string = '';

  @property({ tooltip: '最终-攻击距离(px)' })
  public editorAttackRange: number = 0;

  @property({ tooltip: '最终-移速(px/s)' })
  public editorMoveSpeed: number = 0;

  @property({ tooltip: '最终-攻速(次/秒)' })
  public editorAttackSpeed: number = 0;

  @property({ tooltip: '当前技能条(0~100)' })
  public editorSkillGauge: number = 0;

  @property({ tooltip: '当前目标名称（空为无目标）' })
  public editorCurrentTarget: string = '';

  // 提取常用字段的数值缓存
  private _attackRange = 0; // px
  private _moveSpeed = 0;   // px/s
  private _attackSpeed = 0; // 次/秒

  // —— 战斗状态 ——
  private _anim: Animation | null = null;
  private _currentTarget: Node | null = null;
  private _isMoving = false;
  private _actionLock = 0; // 动作播放期间锁定（秒）

  // 攻击/技能控制
  public skillGauge: number = 0; // 0~100
  private _attackCdRemain = 0;   // 攻击冷却剩余（秒）

  onLoad() {
    this._anim = this.findAnimation(this.node);
  }

  // 供管理器调用：设置队友/敌人上下文
  setContext(allies: Node[], enemies: Node[]) {
    this.allies = allies || [];
    this.enemies = enemies || [];
    // 同步到编辑器预览
    this.editorAllies = this.allies;
    this.editorEnemies = this.enemies;
  }

  // 供管理器调用：初始化最终属性
  initializeFinalAttributes(config: HeroConfig | undefined, level: number, ascendLevel: number) {
    const cfg = config;
    const basic: Record<string, number> = {};
    const combat: Record<string, number> = {};

    if (cfg) {
      const baseBasic = cfg['基础属性'] || {};
      const baseCombat = cfg['战斗属性'] || {};
      const growth = cfg['成长配置'] || { '每级': {}, '每10级': {} };
      const perLevel: Record<string, number> = growth['每级'] || {};
      const per10: Record<string, number> = growth['每10级'] || {};

      // 合并所有属性名
      const names = new Set<string>([
        ...Object.keys(baseBasic),
        ...Object.keys(baseCombat),
        ...Object.keys(perLevel),
        ...Object.keys(per10),
      ]);

      for (const n of names) {
        const base = (n in baseBasic) ? (baseBasic[n] || 0) : (baseCombat[n] || 0);
        const incX = perLevel[n] || 0;
        const incY = per10[n] || 0;
        const inc = totalIncrement(level, incX, incY);
        const val = base + inc;
        if (n in baseBasic || (!((n in baseCombat)) && isBasicAttrName(n))) {
          basic[n] = val;
        } else {
          combat[n] = val;
        }
      }

      // 升阶加成（按顺序应用前 ascendLevel 条）
      const asc: HeroAscend[] = Array.isArray(cfg['升阶配置']) ? cfg['升阶配置'] : [];
      for (let i = 0; i < Math.min(ascendLevel, asc.length); i++) {
        const item = asc[i];
        const key = item?.['属性'];
        const type = item?.['类型'];
        const val = item?.['数值'] || 0;
        if (!key) continue;
        const map = (key in basic || isBasicAttrName(key)) ? basic : combat;
        const cur = map[key] || 0;
        if (type === '固定') map[key] = cur + val;
        else map[key] = cur * (1 + val / 100);
      }
    }

    // 写入公共字段
    this.finalBasic = basic;
    this.finalCombat = combat;

    // 提取常用数值
    this._attackRange = numberOrZero(basic['攻击距离']);
    this._moveSpeed = numberOrZero(basic['移速']);
    this._attackSpeed = numberOrZero(combat['攻速']);

    // 同步编辑器预览
    this.editorFinalBasicJSON = safeStringify(this.finalBasic);
    this.editorFinalCombatJSON = safeStringify(this.finalCombat);
    this.editorAttackRange = this._attackRange;
    this.editorMoveSpeed = this._moveSpeed;
    this.editorAttackSpeed = this._attackSpeed;
  }

  // 战斗开始时位移：左侧向左 200px，右侧向右 200px
  applyStartOffset() {
    const p = this.node.position.clone();
    const dx = this.isAlly ? -200 : 200;
    this.node.setPosition(new Vec3(p.x + dx, p.y, p.z));
  }

  update(dt: number) {
    // 动作锁
    if (this._actionLock > 0) {
      this._actionLock -= dt;
      if (this._actionLock < 0) this._actionLock = 0;
    }

    // 冷却计时
    if (this._attackCdRemain > 0) {
      this._attackCdRemain -= dt;
      if (this._attackCdRemain < 0) this._attackCdRemain = 0;
    }

    // 确定最近对手
    this._currentTarget = this.findNearestEnemy();
    const target = this._currentTarget;
    if (!target) {
      // 没有对手，保持 idle
      this.playIdle();
      return;
    }

    const dist = this.distanceTo(target);
    const inRange = dist <= Math.max(0, this._attackRange);

    if (!inRange) {
      // 移动中
      this.moveTowards(target, dt);
      this.playRun();
      return;
    }

    // 到达攻击范围：idle、尝试技能或攻击
    this.playIdle();

    // 动作锁下不触发攻击/技能
    if (this._actionLock > 0) return;

    if (this.skillGauge >= 100) {
      // 释放技能，优先级高于普攻
      if (this.playSkill()) {
        this.skillGauge = 0;
        return;
      }
    }

    // 普攻（冷却结束）
    if (this._attackCdRemain <= 0 && this._attackSpeed > 0) {
      if (this.playAttack()) {
        // 攻击后进入冷却；技能条+10
        this._attackCdRemain = 1 / this._attackSpeed;
        this.skillGauge = Math.min(100, this.skillGauge + 10);
      }
    }
  }

  // —— 移动与距离 ——
  private findNearestEnemy(): Node | null {
    let best: Node | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const n of this.enemies) {
      if (!n || !n.isValid) continue;
      const d = this.distanceTo(n);
      if (d < bestDist) {
        best = n;
        bestDist = d;
      }
    }
    // 更新编辑器当前目标名称
    this.editorCurrentTarget = best ? (best.name || '') : '';
    return best;
  }

  private distanceTo(other: Node): number {
    const a = this.node.worldPosition;
    const b = other.worldPosition;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private moveTowards(target: Node, dt: number) {
    const speed = Math.max(0, this._moveSpeed);
    if (speed <= 0) return;
    const from = this.node.worldPosition;
    const to = target.worldPosition;
    const dirX = to.x - from.x;
    const dirY = to.y - from.y;
    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    if (len <= 1e-6) return;
    const step = speed * dt;
    const nx = dirX / len;
    const ny = dirY / len;
    const dx = nx * step;
    const dy = ny * step;
    const lp = this.node.position;
    this.node.setPosition(new Vec3(lp.x + dx, lp.y + dy, lp.z));
    this._isMoving = true;
  }

  // —— 动画播放（允许缺失剪辑时跳过） ——
  private playRun() {
    if (!this._anim || this._actionLock > 0) return;
    if (this._isPlayingOneOf(['run'])) return;
    this._playCandidates(['run']);
    this._isMoving = true;
  }

  private playIdle() {
    if (!this._anim || this._actionLock > 0) return;
    if (this._isPlayingOneOf(['idle', 'daiji'])) return;
    if (this._playCandidates(['idle', 'daiji'])) {
      this._isMoving = false;
    }
  }

  private playAttack(): boolean {
    if (!this._anim) return false;
    return this._playCandidates(['attack', 'hit']);
  }

  private playSkill(): boolean {
    if (!this._anim) return false;
    return this._playCandidates(['skill', 'kill']);
  }

  private _isPlayingOneOf(names: string[]): boolean {
    if (!this._anim) return false;
    for (const n of names) {
      const st = this._anim.getState(n);
      if (st && st.isPlaying) return true;
      // 尝试忽略大小写匹配
      const exact = this._findClipNameCaseInsensitive(n);
      if (exact) {
        const st2 = this._anim.getState(exact);
        if (st2 && st2.isPlaying) return true;
      }
    }
    return false;
  }

  private _playCandidates(names: string[]): boolean {
    if (!this._anim) return false;
    for (const n of names) {
      const name = this._findClipNameCaseInsensitive(n) || n;
      const clip = this._findClipByName(name);
      if (clip) {
        try {
          this._anim.play(name);
          const dur = clip.duration || 0.5;
          // run/idle 不加锁；攻击/技能加锁避免被打断
          if (n === 'attack' || n === 'hit' || n === 'skill' || n === 'kill') {
            this._actionLock = dur;
            // 更新技能条预览以便观察（此处仅在攻击/技能后改变）
            this.editorSkillGauge = this.skillGauge;
          }
          return true;
        } catch { /* 忽略播放错误 */ }
      }
    }
    return false;
  }

  private _findClipByName(name: string): AnimationClip | null {
    if (!this._anim) return null;
    const clips = this._anim.clips || [];
    const match = clips.find(c => c && c.name === name) || clips.find(c => c && c.name.toLowerCase() === name.toLowerCase());
    return match || null;
  }

  private _findClipNameCaseInsensitive(name: string): string | null {
    const clip = this._findClipByName(name);
    return clip ? clip.name : null;
  }

  private findAnimation(root: Node): Animation | null {
    const q: Node[] = [root];
    while (q.length > 0) {
      const cur = q.shift()!;
      const a = cur.getComponent(Animation);
      if (a) return a;
      for (const c of cur.children) q.push(c);
    }
    return null;
  }
}

// —— 工具方法 ——
function numberOrZero(v: any): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v || ''));
  return Number.isFinite(n) ? n : 0;
}

function isBasicAttrName(n: string): boolean {
  return (
    n === '攻击力' || n === '法强' || n === '生命值' || n === '护甲' || n === '魔抗' || n === '攻击距离' || n === '移速'
  );
}

// 与 hero-config.html 中一致的成长累计公式
function totalIncrement(level: number, x: number, y: number): number {
  const lv = Math.floor(Number(level) || 0);
  if (lv === 0) return 0;
  const sign = lv > 0 ? 1 : -1;
  const L = Math.abs(lv);
  const k = L > 0 ? Math.floor((L - 1) / 10) : 0;
  const m = L - 10 * k;
  const yTimes = (10 * k * (k - 1)) / 2 + m * k;
  return sign * (x * L + y * yTimes);
}

function safeStringify(obj: any): string {
  try { return JSON.stringify(obj); } catch { return ''; }
}

export default HeroController;