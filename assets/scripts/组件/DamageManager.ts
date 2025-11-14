import { Node } from 'cc';
import { HeroController, DamageType } from './HeroController';

/**
 * 伤害管理系统：
 * - 接收来源/目标节点与伤害类型（普攻/技能）
 * - 读取双方属性，计算伤害（包含可选暴击）
 * - 调用目标 HeroController 的 takeDamage 执行伤害
 */
export class DamageManager {
  applyDamage(source: Node, target: Node, type: DamageType): number {
    if (!source || !target) return 0;
    const attacker = source.getComponent(HeroController);
    const defender = target.getComponent(HeroController);
    if (!attacker || !defender) return 0;

    const atk = readAttr(attacker.finalBasic, attacker.finalCombat, '攻击力', 0);
    // 优先读取“防御”，否则退化为“护甲”作为物理防御
    const def = readAttr(defender.finalBasic, defender.finalCombat, '防御', readAttr(defender.finalBasic, defender.finalCombat, '护甲', 0));

    let base = type === '技能' ? 2 * atk - def : atk - def;
    base = Math.max(0, base);

    // 暴击判断（支持 0~1 或 0~100 的表达方式）
    const critRateRaw = readAttr(attacker.finalCombat, attacker.finalBasic, '暴击率', 0);
    const critMulRaw = readAttr(attacker.finalCombat, attacker.finalBasic, '暴击倍率', 1);
    const critRate = normalizeRate(critRateRaw);
    const critMul = normalizeMultiplier(critMulRaw);

    if (critRate > 0 && Math.random() < critRate) {
      base = base * critMul;
    }

    const dmg = Math.floor(base);
    if (dmg > 0) defender.takeDamage(dmg, source, type);
    const percent = defender.maxHp > 0 ? Math.max(0, Math.min(1, defender.currentHp / defender.maxHp)) : 0;
    return percent;
  }
}

function readAttr(
  primary: Record<string, number>,
  secondary: Record<string, number>,
  key: string,
  defaultVal: number = 0,
): number {
  if (primary && key in primary) return toNumber(primary[key], defaultVal);
  if (secondary && key in secondary) return toNumber(secondary[key], defaultVal);
  return defaultVal;
}

function toNumber(v: any, fallback: number = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

// 0~100
function normalizeRate(v: number): number {
  const n = toNumber(v, 0);
  const f =  n / 100 ;
  return Math.max(0, Math.min(1, f));
}

// 倍率支持“2”表示 2 倍
function normalizeMultiplier(v: number): number {
  const n = toNumber(v, 1);
  if (n <= 0) return 1;
  return n;
}

export default DamageManager;
