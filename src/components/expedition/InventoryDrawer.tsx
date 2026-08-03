import { useGameStore, makeCommandId } from '../../store/game-store.js';
import { ITEM_REGISTRY } from '../../content/items.js';
import type { ItemId, ItemDefinition } from '../../game-engine/expedition/types.js';

export function InventoryDrawer({ onClose }: { onClose: () => void }) {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const capacity = state.inventory.capacity;
  const slots: (ItemId | null)[] = Array.from({ length: capacity }, (_, i) => {
    return state.inventory.stacks[i]?.itemId ?? null;
  });
  return (
    <div className="drawer" onClick={onClose}>
      <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-title">
          <span>背包 ({state.inventory.stacks.length}/{capacity})</span>
          <button onClick={onClose}>关闭</button>
        </div>
        <div className="inventory-list">
          {slots.map((itemId, i) => {
            const stack = state.inventory.stacks[i];
            const def: ItemDefinition | undefined = itemId ? ITEM_REGISTRY[itemId] : undefined;
            return (
              <div key={i} className={`inventory-slot ${itemId ? '' : 'empty'}`}>
                {def ? (
                  <>
                    <div className="item-name">{def.name}</div>
                    <div className="item-count">×{stack?.count ?? 0}</div>
                  </>
                ) : (
                  <div className="muted">—</div>
                )}
              </div>
            );
          })}
        </div>
        <div className="divider" />
        <div className="flex-col">
          {state.inventory.stacks.length > 0 && (
            <>
              <div className="muted" style={{ fontSize: 11 }}>操作</div>
              {state.inventory.stacks.map((s) => (
                <div key={s.id} className="flex-row" style={{ justifyContent: 'space-between' }}>
                  <span>{ITEM_REGISTRY[s.itemId].name} ×{s.count}</span>
                  <button
                    style={{ padding: '4px 8px', fontSize: 11, minHeight: 28 }}
                    onClick={() => {
                      dispatch({
                        type: 'DISCARD_INVENTORY_ITEM',
                        decisionId: state.pendingDecision?.id ?? 'no-decision',
                        stackId: s.id,
                        count: 1,
                        commandId: makeCommandId('discard'),
                      });
                    }}
                  >丢弃 1</button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
