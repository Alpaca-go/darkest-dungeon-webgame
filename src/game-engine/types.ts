/**
 * 核心类型定义
 *
 * 设计原则:
 * - 所有规则所需的字段都集中在 Actor / Skill 上,避免数据散落
 * - 站位用 1-4 的字面量联合,保证类型安全
 * - 状态(DOT/眩晕/标记)独立建模,便于扩展
 * - 不写 React 无关的逻辑(纯数据结构)
 */

/** 1-4 号站位 */
export type Rank = 1 | 2 | 3 | 4;

/** 阵营 */
export type Side = 'ally' | 'enemy';

/** 战斗角色种类 */
export type ActorKind = 'hero' | 'enemy' | 'corpse';

/** 持续伤害 */
export interface DamageOverTime {
  /** 用于防堆叠去重 */
  id: string;
  type: 'bleed' | 'blight';
  damagePerTurn: number;
  remainingTurns: number;
  sourceId: string;
}

/** 眩晕状态 */
export interface StunState {
  remaining: number;
  /** 眩晕结束后的抗性(剩余回合) */
  resistRemaining: number;
}

/** 标记(增加受暴击率 / 受伤害) */
export interface MarkState {
  sourceId: string;
  remaining: number;
}

/** 护甲 Buff(减少受伤害百分比) */
export interface ProtectionBuff {
  amount: number;
  remaining: number;
  sourceId: string;
}

/** 一个战斗角色的运行时状态(英雄/敌人/尸体通用) */
export interface BattleActor {
  id: string;
  kind: ActorKind;
  side: Side;
  rank: Rank;
  /** 显示名(日志/UI 用) */
  name: string;
  /** 职业/类型(日志用) */
  archetype: string;

  // 战斗属性
  hp: number;
  maxHp: number;
  dodge: number;
  protection: number;
  speed: number;
  accuracy: number;
  crit: number;
  bleedResist: number;
  blightResist: number;
  stunResist: number;
  moveResist: number;
  deathblowResist: number;

  // 状态
  bleed: DamageOverTime[];
  blight: DamageOverTime[];
  stun: StunState | null;
  mark: MarkState | null;
  protBuff: ProtectionBuff | null;

  // 技能冷却
  cooldowns: Record<string, number>;

  // 死亡
  isDead: boolean;

  // 仅 corpse 使用:尸体来源的敌人 id(用于追溯)
  corpseOfActorId?: string;
}

/** 技能基础伤害区间 */
export interface DamageRange {
  min: number;
  max: number;
}

/** 技能效果 */
export type SkillEffect =
  | { type: 'damage' }
  | { type: 'heal'; flat: number }
  | { type: 'bleed'; baseDamage: number; duration: number; resistTarget: 'bleedResist' }
  | { type: 'blight'; baseDamage: number; duration: number; resistTarget: 'blightResist' }
  | { type: 'stun'; duration: number; resistTarget: 'stunResist' }
  | { type: 'mark'; duration: number }
  | { type: 'prot_buff'; amount: number; duration: number };

/** 技能定义 */
export interface SkillDefinition {
  id: string;
  name: string;
  /** 所属职业/敌人(可选,有些技能跨职业) */
  ownerArchetype?: string;

  /** 施法方合法站位 */
  usableFromRanks: Rank[];
  /** 目标合法站位(对单时) */
  targetRanks: Rank[];
  /** 目标阵营 */
  targetSide: Side | 'self';
  /** 目标模式 */
  targetMode: 'single' | 'all' | 'adjacent' | 'self';

  /** 技能基础命中(0-100) */
  accuracy: number;
  /** 伤害修正(如 +0.25 表示 +25% 基础伤害) */
  damageModifier: number;
  /** 暴击修正 */
  critModifier: number;
  /** 基础伤害区间 */
  baseDamage: DamageRange;

  /** 位移:自身向前(+)或向后(-) */
  moveSelf?: number;
  /** 位移:目标向前(+)或向后(-) */
  moveTarget?: number;

  /** 附加效果 */
  effects: SkillEffect[];

  /** 技能冷却(默认 0 = 无冷却) */
  cooldown: number;
}

/** 一个 actor 装备的技能槽(指向 SkillDefinition.id) */
export interface EquippedSkill {
  skillId: string;
}

/** 战斗全局状态 */
export interface BattleState {
  id: string;
  round: number;
  phase:
    | 'setup'
    | 'round-start'
    | 'actor-turn'
    | 'resolution'
    | 'round-end'
    | 'victory'
    | 'defeat';

  heroes: BattleActor[];
  enemies: BattleActor[];
  /** 尸体(由死亡敌人产生) */
  corpses: BattleActor[];

  /** 当前轮次的行动顺序(actor id 数组) */
  initiativeQueue: string[];
  /** 队列中下一个要行动的角色 id(可能是英雄) */
  activeActorId: string | null;

  /** 技能槽(每个 actor 装备 4 个技能) */
  loadouts: Record<string, EquippedSkill[]>;
  /** 技能注册表(本战斗涉及的技能定义) */
  skillRegistry: Record<string, SkillDefinition>;

  /** 当前事务 id(由事务分配) */
  transactionId: string;
  /** 序列号(域事件) */
  sequence: number;

  /** RNG 状态 */
  rng: import('./rng/types.js').RngState;

  /** 战斗日志(域事件) */
  log: import('./domain-events.js').DomainEvent[];
}
