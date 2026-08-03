/**
 * MediumQuestCard — 中型任务卡(Phase 4 P4.4)
 *
 * 显示 12-15 节点任务,标注 length: 'short' | 'medium'(>= 12 节点算 medium)
 * + 主要威胁 / 推荐职业 / 预期补给 / 奖励 / 失败惩罚
 */

import type { QuestDefinition } from '../../game-engine/campaign/types.js';
import type { ItemId } from '../../game-engine/expedition/types.js';

const ITEM_LABEL: Partial<Record<ItemId, string>> = {
  food: '食物',
  torch: '火把',
  shovel: '铁锹',
  'skeleton-key': '骷髅钥匙',
  'holy-water': '圣水',
  bandage: '绷带',
  antivenom: '解毒剂',
  gold: '金币',
  'torch-fuel': '火把燃料',
};

export function MediumQuestCard({
  quest,
  onSelect,
  disabled = false,
}: {
  quest: QuestDefinition;
  onSelect?: () => void;
  disabled?: boolean;
}) {
  const isMedium = quest.nodeCount >= 12;
  const lengthLabel = isMedium ? '中型' : '短型';
  return (
    <div className={`medium-quest-card ${isMedium ? 'medium' : 'short'} ${disabled ? 'disabled' : ''}`}>
      <div className="quest-card-header">
        <h4>{quest.title}</h4>
        <span className={`quest-length-tag ${isMedium ? 'tag-medium' : 'tag-short'}`}>
          {lengthLabel}
        </span>
      </div>
      <div className="quest-card-desc">{quest.description}</div>
      <div className="quest-card-stats">
        <div className="stat-row">
          <span>节点数</span>
          <span>{quest.nodeCount}</span>
        </div>
        <div className="stat-row">
          <span>难度</span>
          <span>{quest.difficulty}</span>
        </div>
        <div className="stat-row">
          <span>威胁</span>
          <span>{quest.threat}</span>
        </div>
        {quest.recommendedClassTags.length > 0 && (
          <div className="stat-row">
            <span>推荐职业</span>
            <span className="quest-class-tags">
              {quest.recommendedClassTags.map((c) => (
                <span key={c} className="class-tag">{c}</span>
              ))}
            </span>
          </div>
        )}
        {Object.keys(quest.expectedProvisions).length > 0 && (
          <div className="stat-row">
            <span>预期补给</span>
            <span className="quest-provision-tags">
              {Object.entries(quest.expectedProvisions).map(([k, v]) => (
                <span key={k} className="provision-tag">
                  {ITEM_LABEL[k as ItemId] ?? k} {v as number}
                </span>
              ))}
            </span>
          </div>
        )}
        <div className="stat-row">
          <span>奖励</span>
          <span className="quest-reward-tags">
            {quest.rewards.gold > 0 && <span className="reward-tag">{quest.rewards.gold}g</span>}
            {quest.rewards.portraits > 0 && <span className="reward-tag">肖像 ×{quest.rewards.portraits}</span>}
            {quest.rewards.crests > 0 && <span className="reward-tag">纹章 ×{quest.rewards.crests}</span>}
            {quest.rewards.heroXp > 0 && <span className="reward-tag">XP +{quest.rewards.heroXp}</span>}
          </span>
        </div>
        {quest.failPenalty && (
          <div className="stat-row">
            <span>失败惩罚</span>
            <span className="quest-fail">-{quest.failPenalty.goldLost}g</span>
          </div>
        )}
      </div>
      {onSelect && (
        <button
          type="button"
          className="quest-select-btn primary"
          onClick={onSelect}
          disabled={disabled}
        >
          选择任务
        </button>
      )}
    </div>
  );
}
