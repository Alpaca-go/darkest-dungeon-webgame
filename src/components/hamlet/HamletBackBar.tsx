/**
 * HamletBackBar — 顶部返回条
 * 显示当前面板标题 + 返回上一级按钮
 */

import { useGameStore, makeCommandId } from '../../store/game-store.js';

export function HamletBackBar({ title }: { title: string }) {
  const dispatch = useGameStore((s) => s.dispatch);
  return (
    <div className="hamlet-back-bar">
      <button
        onClick={() => dispatch({ type: 'SET_HAMLET_MODE', mode: 'weekly-summary', commandId: makeCommandId('back') })}
        style={{ padding: '4px 8px', minHeight: 32, minWidth: 32, fontSize: 12 }}
      >
        ← 返回
      </button>
      <span className="back-bar-title">{title}</span>
    </div>
  );
}
