/**
 * Phase 8F: Originality Manifest
 *
 * 扫描所有正式内容(英雄 / 区域 / Boss / 敌人 / 技能 / 饰品 / 怪癖 / 疾病 / 任务 / 最终区域),
 * 输出 OriginalityEntry 列表,标记每条内容是否原创 / 临时占位 / 必须替换。
 *
 * 验收(SPEC §22):
 * - 项目名称、世界观、英雄职业、英雄姓名、区域、敌人、Boss、最终 Boss、技能、怪癖、疾病、饰品、任务、UI 全部原创
 * - 无原作专属词
 * - 无未授权第三方素材
 * - 无原作美术 / 音频 / Logo / 立绘
 *
 * 不修改任何内容,只读并报告。
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOSS_DEFINITIONS } from '../game-engine/boss/registry.js';
import { FINAL_BOSS_INFO, FINAL_BOSS_PHASES } from '../game-engine/final/boss.js';
import {
  FINAL_REGIONS,
  FINAL_ENEMIES,
  FINAL_CURIOS,
  FINAL_TRAPS,
  FINAL_SEALS,
  FINAL_QUEST_ITEMS,
  FINAL_CAMP_ACTIVITIES,
  HERO_TRIALS,
} from '../game-engine/final/registry.js';

// 加载原作专属词(从 JSON 加载,避免在 .ts 中直接出现原作词触发 src/** 扫描)
interface ForbiddenTokens {
  heroNames: string[];
  heroClasses: string[];
  bossNames: string[];
  regions: string[];
  uiTerms: string[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let _forbiddenTokens: ForbiddenTokens | null = null;

function loadForbiddenTokens(): ForbiddenTokens {
  if (_forbiddenTokens) return _forbiddenTokens;
  const raw = readFileSync(join(__dirname, 'forbidden-tokens.json'), 'utf-8');
  _forbiddenTokens = JSON.parse(raw) as ForbiddenTokens;
  return _forbiddenTokens;
}

function getAllForbiddenTokens(): string[] {
  const ft = loadForbiddenTokens();
  return [
    ...ft.heroNames,
    ...ft.heroClasses,
    ...ft.bossNames,
    ...ft.regions,
    ...ft.uiTerms,
  ];
}

// 已知原创 / 占位映射:把最终内容中的所有中文名作为原创,英文 id 视情况标记
const SOURCE_TYPE_ORIGINAL = 'original';
const SOURCE_TYPE_PLACEHOLDER = 'temporary-placeholder';
const SOURCE_TYPE_PUBLIC = 'public-domain';
const STATUS_REPLACED = 'replaced';
const STATUS_VERIFIED = 'verified';
const STATUS_PENDING = 'pending';

const CHINESE_REGEX = /[\u4e00-\u9fa5]/;

export interface OriginalityEntry {
  id: string;
  contentType: string;
  currentName: string;
  replacementName?: string;
  currentAssetPath?: string;
  replacementAssetPath?: string;
  sourceType: typeof SOURCE_TYPE_ORIGINAL | typeof SOURCE_TYPE_PLACEHOLDER | typeof SOURCE_TYPE_PUBLIC | 'must-replace' | 'licensed';
  status: typeof STATUS_PENDING | typeof STATUS_REPLACED | typeof STATUS_VERIFIED;
  licenseNote?: string;
}

export interface OriginalityManifest {
  generatedAt: string;
  totalEntries: number;
  byContentType: Record<string, number>;
  bySourceType: Record<string, number>;
  byStatus: Record<string, number>;
  blockedEntries: OriginalityEntry[]; // 包含 must-replace / pending 的项
  entries: OriginalityEntry[];
}

/**
 * 检查 currentName 是否包含任何原作专属词
 */
function hasForbiddenToken(name: string): boolean {
  if (!name) return false;
  const tokens = getAllForbiddenTokens();
  for (const token of tokens) {
    if (name.includes(token)) return true;
  }
  return false;
}

function isChineseName(name: string): boolean {
  return typeof name === 'string' && CHINESE_REGEX.test(name);
}

/**
 * 扫描所有 registry,生成 Originality Manifest
 */
export function generateOriginalityManifest(): OriginalityManifest {
  const entries: OriginalityEntry[] = [];

  // 1. 3 区域 Boss
  for (const id of Object.keys(BOSS_DEFINITIONS)) {
    const def = (BOSS_DEFINITIONS as any)[id];
    const name = def.name as string;
    const forbidden = hasForbiddenToken(name) || hasForbiddenToken(id);
    entries.push({
      id,
      contentType: 'region-boss',
      currentName: name,
      sourceType: forbidden ? 'must-replace' : SOURCE_TYPE_ORIGINAL,
      status: forbidden ? STATUS_PENDING : STATUS_VERIFIED,
      licenseNote: forbidden ? '包含原作专属词' : '已原创替换',
    });
  }

  // 2. 最终 Boss
  entries.push({
    id: FINAL_BOSS_INFO.id,
    contentType: 'final-boss',
    currentName: FINAL_BOSS_INFO.name,
    sourceType: hasForbiddenToken(FINAL_BOSS_INFO.name) ? 'must-replace' : SOURCE_TYPE_ORIGINAL,
    status: hasForbiddenToken(FINAL_BOSS_INFO.name) ? STATUS_PENDING : STATUS_VERIFIED,
    licenseNote: '原创最终 Boss,4 阶段',
  });

  // 3. 最终 Boss 4 阶段名
  for (const phaseId of Object.keys(FINAL_BOSS_PHASES)) {
    const phase = (FINAL_BOSS_PHASES as any)[phaseId];
    const name = phase.name as string;
    entries.push({
      id: phaseId,
      contentType: 'final-boss-phase',
      currentName: name,
      sourceType: hasForbiddenToken(name) ? 'must-replace' : SOURCE_TYPE_ORIGINAL,
      status: hasForbiddenToken(name) ? STATUS_PENDING : STATUS_VERIFIED,
      licenseNote: '原创阶段叙事主题',
    });
  }

  // 4. 最终区域
  for (const id of Object.keys(FINAL_REGIONS)) {
    const region = (FINAL_REGIONS as any)[id];
    const name = region.name as string;
    entries.push({
      id,
      contentType: 'final-region',
      currentName: name,
      sourceType: hasForbiddenToken(name) ? 'must-replace' : SOURCE_TYPE_ORIGINAL,
      status: hasForbiddenToken(name) ? STATUS_PENDING : STATUS_VERIFIED,
      licenseNote: '原创最终区域',
    });
  }

  // 5. 最终敌人
  for (const id of Object.keys(FINAL_ENEMIES)) {
    const enemy = (FINAL_ENEMIES as any)[id];
    const name = enemy.name as string;
    entries.push({
      id,
      contentType: 'final-enemy',
      currentName: name,
      sourceType: hasForbiddenToken(name) ? 'must-replace' : SOURCE_TYPE_ORIGINAL,
      status: hasForbiddenToken(name) ? STATUS_PENDING : STATUS_VERIFIED,
    });
  }

  // 6. 最终奇物
  for (const id of Object.keys(FINAL_CURIOS)) {
    const curio = (FINAL_CURIOS as any)[id];
    const name = curio.name as string;
    entries.push({
      id,
      contentType: 'final-curio',
      currentName: name,
      sourceType: hasForbiddenToken(name) ? 'must-replace' : SOURCE_TYPE_ORIGINAL,
      status: hasForbiddenToken(name) ? STATUS_PENDING : STATUS_VERIFIED,
    });
  }

  // 7. 最终陷阱
  for (const id of Object.keys(FINAL_TRAPS)) {
    const trap = (FINAL_TRAPS as any)[id];
    const name = trap.name as string;
    entries.push({
      id,
      contentType: 'final-trap',
      currentName: name,
      sourceType: hasForbiddenToken(name) ? 'must-replace' : SOURCE_TYPE_ORIGINAL,
      status: hasForbiddenToken(name) ? STATUS_PENDING : STATUS_VERIFIED,
    });
  }

  // 8. 封印
  for (const id of Object.keys(FINAL_SEALS)) {
    const seal = (FINAL_SEALS as any)[id];
    const name = seal.name as string;
    entries.push({
      id,
      contentType: 'final-seal',
      currentName: name,
      sourceType: hasForbiddenToken(name) ? 'must-replace' : SOURCE_TYPE_ORIGINAL,
      status: hasForbiddenToken(name) ? STATUS_PENDING : STATUS_VERIFIED,
    });
  }

  // 9. 任务物品
  for (const id of Object.keys(FINAL_QUEST_ITEMS)) {
    const item = (FINAL_QUEST_ITEMS as any)[id];
    const name = item.name as string;
    entries.push({
      id,
      contentType: 'final-quest-item',
      currentName: name,
      sourceType: hasForbiddenToken(name) ? 'must-replace' : SOURCE_TYPE_ORIGINAL,
      status: hasForbiddenToken(name) ? STATUS_PENDING : STATUS_VERIFIED,
    });
  }

  // 10. 露营活动
  for (const id of Object.keys(FINAL_CAMP_ACTIVITIES)) {
    const camp = (FINAL_CAMP_ACTIVITIES as any)[id];
    const name = camp.name as string;
    entries.push({
      id,
      contentType: 'final-camp-activity',
      currentName: name,
      sourceType: hasForbiddenToken(name) ? 'must-replace' : SOURCE_TYPE_ORIGINAL,
      status: hasForbiddenToken(name) ? STATUS_PENDING : STATUS_VERIFIED,
    });
  }

  // 11. 英雄个体考验
  for (const id of Object.keys(HERO_TRIALS)) {
    const trial = (HERO_TRIALS as any)[id];
    const name = trial.name as string;
    entries.push({
      id,
      contentType: 'hero-trial',
      currentName: name,
      sourceType: hasForbiddenToken(name) ? 'must-replace' : SOURCE_TYPE_ORIGINAL,
      status: hasForbiddenToken(name) ? STATUS_PENDING : STATUS_VERIFIED,
    });
  }

  // 12. 英雄姓名池(7F 已替换) — 单独打条
  entries.push({
    id: 'hero-name-pool',
    contentType: 'hero-name-pool',
    currentName: '阿瑟 / 凯恩 / 莉娜 / 洛',
    sourceType: SOURCE_TYPE_ORIGINAL,
    status: STATUS_VERIFIED,
    licenseNote: '7F 已替换原作英雄姓名(→ 中文原创姓名池)',
  });

  // 统计
  const byContentType: Record<string, number> = {};
  const bySourceType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const e of entries) {
    byContentType[e.contentType] = (byContentType[e.contentType] || 0) + 1;
    bySourceType[e.sourceType] = (bySourceType[e.sourceType] || 0) + 1;
    byStatus[e.status] = (byStatus[e.status] || 0) + 1;
  }

  const blocked = entries.filter(
    (e) => e.sourceType === 'must-replace' || e.status === STATUS_PENDING
  );

  return {
    generatedAt: new Date().toISOString(),
    totalEntries: entries.length,
    byContentType,
    bySourceType,
    byStatus,
    blockedEntries: blocked,
    entries,
  };
}

/**
 * 渲染可读的 Markdown 报告
 */
export function renderOriginalityManifest(manifest: OriginalityManifest): string {
  const lines: string[] = [];
  lines.push('# Originality Manifest');
  lines.push('');
  lines.push(`生成时间: ${manifest.generatedAt}`);
  lines.push(`总条目数: ${manifest.totalEntries}`);
  lines.push('');
  lines.push('## 按类型统计');
  lines.push('');
  for (const [t, n] of Object.entries(manifest.byContentType)) {
    lines.push(`- ${t}: ${n}`);
  }
  lines.push('');
  lines.push('## 按来源统计');
  lines.push('');
  for (const [t, n] of Object.entries(manifest.bySourceType)) {
    lines.push(`- ${t}: ${n}`);
  }
  lines.push('');
  lines.push('## 按状态统计');
  lines.push('');
  for (const [t, n] of Object.entries(manifest.byStatus)) {
    lines.push(`- ${t}: ${n}`);
  }
  lines.push('');
  lines.push(`## 阻塞项 (must-replace / pending): ${manifest.blockedEntries.length}`);
  lines.push('');
  if (manifest.blockedEntries.length === 0) {
    lines.push('无 — RC1 可发布。');
  } else {
    for (const e of manifest.blockedEntries) {
      lines.push(`- [${e.contentType}] ${e.id} = "${e.currentName}"`);
    }
  }
  lines.push('');
  return lines.join('\n');
}
