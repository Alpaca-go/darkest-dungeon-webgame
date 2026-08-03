import type { ActorViewModel } from '../../game-engine/selectors.js';

interface ActiveActorPanelProps {
  actor: ActorViewModel | null;
  selectedSkillName?: string;
  validTargetCount: number;
}

export function ActiveActorPanel({ actor, selectedSkillName, validTargetCount }: ActiveActorPanelProps) {
  if (!actor) {
    return (
      <div className="active-panel">
        <div className="active-panel__title">当前行动者</div>
        <div className="active-panel__hint">等待中...</div>
      </div>
    );
  }

  return (
    <div className="active-panel">
      <div className="active-panel__title">当前行动者</div>
      <div className="active-panel__name">
        {actor.name} ({actor.rank}号位)
      </div>
      <div className="active-panel__stats">
        <span className="active-panel__stat">HP {actor.hp}/{actor.maxHp}</span>
        <span className="active-panel__stat">速 {actor.archetype}</span>
      </div>
      {selectedSkillName && (
        <div className="active-panel__hint">
          已选技能「{selectedSkillName}」 · {validTargetCount > 0 ? `请选择目标 (${validTargetCount} 个合法)` : '没有合法目标,请取消重选'}
        </div>
      )}
      {!selectedSkillName && (
        <div className="active-panel__hint">请选择一个技能</div>
      )}
    </div>
  );
}
