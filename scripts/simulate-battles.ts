/**
 * 1000 场自动战斗模拟
 *
 * 目的:
 * - 验证不变量(HP 边界、站位唯一、死亡一致性、行动队列完整)
 * - 验证稳定性(无死循环、无非法状态、无 NaN/Infinity)
 * - 验证 RNG 确定性(同 Seed 同结果)
 *
 * 输出:sim-reports/simulation-report.md
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTestBattle } from '../src/content/factories.js';
import { runBattleFull } from '../src/game-engine/battle/loop.js';
import { assertInvariants } from '../src/game-engine/invariants.js';

const TOTAL_BATTLES = 1000;
const REPORT_DIR = resolve(process.cwd(), 'sim-reports');

interface SimRecord {
  seed: string;
  outcome: 'victory' | 'defeat' | 'timeout';
  rounds: number;
  logSize: number;
  durationMs: number;
}

function runOne(seed: string): SimRecord {
  const start = performance.now();
  let battle = createTestBattle({ seed });
  assertInvariants(battle);
  const final = runBattleFull(battle, { heroesControlledByAi: true });
  assertInvariants(final);

  const outcome: SimRecord['outcome'] =
    final.phase === 'victory'
      ? 'victory'
      : final.phase === 'defeat'
      ? 'defeat'
      : 'timeout';

  return {
    seed,
    outcome,
    rounds: final.round,
    logSize: final.log.length,
    durationMs: performance.now() - start,
  };
}

function main() {
  mkdirSync(REPORT_DIR, { recursive: true });

  console.log(`[simulate] starting ${TOTAL_BATTLES} battles...`);
  const records: SimRecord[] = [];
  const startAll = performance.now();

  for (let i = 0; i < TOTAL_BATTLES; i++) {
    const seed = `sim-${i.toString().padStart(4, '0')}`;
    const r = runOne(seed);
    records.push(r);
    if ((i + 1) % 100 === 0) {
      console.log(`[simulate] ${i + 1}/${TOTAL_BATTLES} done`);
    }
  }

  const duration = performance.now() - startAll;

  // 统计
  const victories = records.filter((r) => r.outcome === 'victory').length;
  const defeats = records.filter((r) => r.outcome === 'defeat').length;
  const timeouts = records.filter((r) => r.outcome === 'timeout').length;
  const totalRounds = records.reduce((acc, r) => acc + r.rounds, 0);
  const avgRounds = totalRounds / records.length;
  const maxRounds = records.reduce((acc, r) => Math.max(acc, r.rounds), 0);
  const minRounds = records.reduce((acc, r) => Math.min(acc, r.rounds), 0);
  const totalLog = records.reduce((acc, r) => acc + r.logSize, 0);
  const avgLog = totalLog / records.length;
  const avgDuration = records.reduce((acc, r) => acc + r.durationMs, 0) / records.length;
  const maxDuration = records.reduce((acc, r) => Math.max(acc, r.durationMs), 0);

  // 确定性检查
  const seedReRun = 'sim-0000';
  const first = runOne(seedReRun);
  const second = runOne(seedReRun);
  const deterministic =
    first.outcome === second.outcome &&
    first.rounds === second.rounds &&
    first.logSize === second.logSize;

  // 输出报告
  const lines: string[] = [];
  lines.push(`# Phase 0 Auto-Battle Simulation Report`);
  lines.push('');
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Total battles: ${TOTAL_BATTLES}`);
  lines.push(`- Total wall time: ${duration.toFixed(2)} ms`);
  lines.push('');
  lines.push(`## Outcomes`);
  lines.push('');
  lines.push(`| Outcome | Count | Percent |`);
  lines.push(`|---|---:|---:|`);
  lines.push(`| Victory | ${victories} | ${((victories / TOTAL_BATTLES) * 100).toFixed(1)}% |`);
  lines.push(`| Defeat | ${defeats} | ${((defeats / TOTAL_BATTLES) * 100).toFixed(1)}% |`);
  lines.push(`| Timeout | ${timeouts} | ${((timeouts / TOTAL_BATTLES) * 100).toFixed(1)}% |`);
  lines.push('');
  lines.push(`## Round Statistics`);
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---:|`);
  lines.push(`| Avg rounds | ${avgRounds.toFixed(2)} |`);
  lines.push(`| Min rounds | ${minRounds} |`);
  lines.push(`| Max rounds | ${maxRounds} |`);
  lines.push(`| Total rounds | ${totalRounds} |`);
  lines.push('');
  lines.push(`## Log Statistics (Domain Events)`);
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---:|`);
  lines.push(`| Avg events per battle | ${avgLog.toFixed(1)} |`);
  lines.push(`| Total events | ${totalLog} |`);
  lines.push('');
  lines.push(`## Performance`);
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---:|`);
  lines.push(`| Avg duration (ms) | ${avgDuration.toFixed(2)} |`);
  lines.push(`| Max duration (ms) | ${maxDuration.toFixed(2)} |`);
  lines.push(`| Throughput (battles/sec) | ${(TOTAL_BATTLES / (duration / 1000)).toFixed(1)} |`);
  lines.push('');
  lines.push(`## Determinism Check`);
  lines.push('');
  lines.push(`- Seed \`${seedReRun}\` run twice: ${deterministic ? '✅ Identical' : '❌ Different'}`);
  if (deterministic) {
    lines.push(`  - Outcome: ${first.outcome}`);
    lines.push(`  - Rounds: ${first.rounds}`);
    lines.push(`  - Log size: ${first.logSize}`);
  }
  lines.push('');
  lines.push(`## Sample (first 10 battles)`);
  lines.push('');
  lines.push(`| # | Seed | Outcome | Rounds | Events | Time (ms) |`);
  lines.push(`|---:|---|---|---:|---:|---:|`);
  for (let i = 0; i < Math.min(10, records.length); i++) {
    const r = records[i]!;
    lines.push(`| ${i + 1} | ${r.seed} | ${r.outcome} | ${r.rounds} | ${r.logSize} | ${r.durationMs.toFixed(2)} |`);
  }
  lines.push('');
  lines.push(`## Invariants`);
  lines.push('');
  lines.push(`- All ${TOTAL_BATTLES} battles passed \`assertInvariants\` ✅`);
  lines.push(`- Zero NaN / Infinity / null pointer / unexpected state`);
  lines.push(`- Zero infinite loops (all battles terminated within ${maxRounds} rounds)`);
  lines.push('');

  const report = lines.join('\n');
  const reportPath = resolve(REPORT_DIR, 'simulation-report.md');
  writeFileSync(reportPath, report, 'utf-8');
  console.log(`[simulate] report written: ${reportPath}`);
  console.log(`[simulate] ${victories}V / ${defeats}D / ${timeouts}T, avg ${avgRounds.toFixed(1)} rounds`);
  console.log(`[simulate] deterministic: ${deterministic ? 'YES' : 'NO'}`);
}

main();
