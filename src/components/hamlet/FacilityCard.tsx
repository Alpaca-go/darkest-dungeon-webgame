/**
 * FacilityCard — 单个设施服务卡
 *
 * 显示:
 * - 设施名 + 等级
 * - 服务列表(每服务 1 个按钮)
 * - 当前占用 (slot 进度)
 * - 升级选项
 */

import { useGameStore, makeCommandId } from '../../store/game-store.js';
import type { FacilityId, FacilityState, FacilityServiceId, HeirloomWallet } from '../../game-engine/campaign/types.js';

interface ServiceOption {
  serviceId: FacilityServiceId;
  label: string;
  costGold: number;
  costHeirlooms?: Partial<HeirloomWallet>;
  weeksRequired: number;
  effectPreview: string;
}

const FACILITY_SERVICES: Record<FacilityId, ServiceOption[]> = {
  tavern: [
    { serviceId: 'stress-tavern', label: '酒馆减压', costGold: 650, weeksRequired: 1, effectPreview: '压力 -35~-55(可复现 40% 副作用:丢 100~300 金币)' },
  ],
  abbey: [
    { serviceId: 'stress-abbey', label: '修道院冥想', costGold: 900, weeksRequired: 1, effectPreview: '压力 -45~-60(稳定)' },
  ],
  sanitarium: [
    { serviceId: 'quirk-removal', label: '移除负向怪癖', costGold: 500, weeksRequired: 1, effectPreview: '移除 1 个负向怪癖' },
    { serviceId: 'disease-treatment', label: '治疗疾病', costGold: 750, weeksRequired: 1, effectPreview: '治疗 1 个疾病' },
  ],
  guild: [
    { serviceId: 'skill-upgrade', label: '升级技能', costGold: 800, weeksRequired: 1, effectPreview: '技能等级 +1(最多 2)' },
  ],
  blacksmith: [
    { serviceId: 'weapon-upgrade', label: '强化武器', costGold: 750, weeksRequired: 1, effectPreview: '武器等级 +1(最多 2)' },
    { serviceId: 'armor-upgrade', label: '强化护甲', costGold: 750, weeksRequired: 1, effectPreview: '护甲等级 +1(最多 2)' },
  ],
  wagon: [],
  'provision-shop': [],
};

const FACILITY_NAMES: Record<FacilityId, string> = {
  tavern: '酒馆',
  abbey: '修道院',
  sanitarium: '疗养院',
  guild: '冒险者公会',
  blacksmith: '铁匠铺',
  wagon: '马车',
  'provision-shop': '商店',
};

export function FacilityCard({
  facilityId,
  facility,
  selectedHeroId,
}: {
  facilityId: FacilityId;
  facility: FacilityState;
  selectedHeroId: string | null;
}) {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const gold = state.campaign?.gold ?? 0;
  const services = FACILITY_SERVICES[facilityId];

  const onAssign = (serviceId: FacilityServiceId) => {
    if (!selectedHeroId) return;
    dispatch({
      type: 'ASSIGN_HERO_TO_FACILITY',
      heroId: selectedHeroId,
      facilityId,
      serviceId,
      commandId: makeCommandId('assign'),
    });
  };

  const onUpgrade = (upgradeOptionId: string) => {
    dispatch({
      type: 'UPGRADE_FACILITY',
      facilityId,
      upgradeOptionId,
      commandId: makeCommandId('upgrade'),
    });
  };

  return (
    <div className="facility-card">
      <div className="facility-header">
        <span className="facility-name">{FACILITY_NAMES[facilityId]}</span>
        <span className="facility-level">Lv.{facility.level}</span>
        <span className="facility-slots">
          {facility.occupiedSlots.length}/{facility.slotCount}
        </span>
      </div>
      {/* 占用列表 */}
      {facility.occupiedSlots.length > 0 && (
        <ul className="facility-occupants">
          {facility.occupiedSlots.map((s) => {
            const hero = state.party[s.heroId];
            return (
              <li key={s.heroId}>
                {hero?.name ?? s.heroId} · {s.serviceId}({s.weeksRemaining}w)
              </li>
            );
          })}
        </ul>
      )}
      {/* 服务列表 */}
      {services.length > 0 && (
        <div className="facility-services">
          {services.map((s) => {
            const affordable = gold >= s.costGold && selectedHeroId != null;
            return (
              <div key={s.serviceId} className="service-row">
                <div className="service-info">
                  <strong>{s.label}</strong>
                  <div className="muted" style={{ fontSize: 11 }}>{s.effectPreview}</div>
                  <div className="service-cost">
                    🪙 {s.costGold} · ⏱ {s.weeksRequired}周
                  </div>
                </div>
                <button
                  disabled={!affordable}
                  onClick={() => onAssign(s.serviceId)}
                  style={{ minWidth: 64 }}
                >
                  分配
                </button>
              </div>
            );
          })}
        </div>
      )}
      {/* 升级 */}
      {facility.upgradeOptions.length > 0 && (
        <div className="facility-upgrade">
          {facility.upgradeOptions.map((u) => (
            <div key={u.id} className="upgrade-row">
              <div className="upgrade-info">
                <strong>{u.title}</strong>
                <div className="muted" style={{ fontSize: 11 }}>{u.description}</div>
                <div className="upgrade-cost">🪙 {u.goldCost}</div>
              </div>
              <button
                disabled={gold < u.goldCost}
                onClick={() => onUpgrade(u.id)}
                style={{ minWidth: 64 }}
              >
                升级
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
