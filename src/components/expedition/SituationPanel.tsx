import { useGameStore } from '../../store/game-store.js';
import { getEventDef } from '../../content/events.js';
import { getEncounterDef } from '../../content/encounters.js';

export function SituationPanel() {
  const state = useGameStore((s) => s.state);
  const decision = state.pendingDecision;
  if (!decision) {
    return (
      <div className="situation-panel">
        <div className="situation-title">无选择</div>
        <div className="situation-description muted">系统正在结算…</div>
      </div>
    );
  }

  // route-choice: 描述来自当前 node + 上下文
  // event-choice: 来自 event
  // encounter-choice: 来自 encounter
  let title = '';
  let description = '';

  if (decision.type === 'route') {
    const node = state.expedition.route.nodes[state.expedition.currentNodeId];
    const fork = state.expedition.route.forks.find((f) => f.id === decision.contextId);
    title = fork?.description ?? node?.title ?? '选择方向';
    description = node?.description ?? '';
  } else if (decision.type === 'event') {
    const def = getEventDef(decision.contextId);
    title = def?.title ?? '事件';
    description = def?.description ?? '';
  } else if (decision.type === 'encounter') {
    const enc = state.encounter;
    const def = enc ? getEncounterDef(enc.encounterDefId) : undefined;
    title = def?.name ?? '遭遇';
    description = def?.description ?? '';
  } else if (decision.type === 'travel') {
    title = '选择行进方式';
    description = '不同方式影响火把、时间与风险。';
  } else if (decision.type === 'inventory') {
    title = '背包管理';
    description = '整理一下队伍携带的物资。';
  } else if (decision.type === 'retreat') {
    title = '撤退确认';
    description = '放弃当前任务,返回地表。';
  }

  return (
    <div className="situation-panel">
      <div className="situation-title">{title}</div>
      <div className="situation-description">{description}</div>
    </div>
  );
}
