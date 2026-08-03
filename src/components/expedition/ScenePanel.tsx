import { useGameStore } from '../../store/game-store.js';

const SCENE_GLYPHS: Record<string, string> = {
  'scene.ruins.entry': '⛩',
  'scene.ruins.corridor_fork': '⇋',
  'scene.ruins.trapped_chest': '☠',
  'scene.ruins.skeleton_patrol': '⚔',
  'scene.ruins.empty_hall': '▢',
  'scene.ruins.torch_fork': '⫷⫸',
  'scene.ruins.tomb_ambush': '✦',
  'scene.ruins.altar': '✝',
  'scene.ruins.exit': '↗',
  'scene.ruins.unknown': '?',
};

export function ScenePanel({ sceneId, title, description }: { sceneId: string; title: string; description: string }) {
  const state = useGameStore((s) => s.state);
  const torch = state.expedition.torch;
  const torchLevel = torch < 1 ? 'black' : torch < 26 ? 'dark' : torch < 51 ? 'dim' : '';
  const glyph = SCENE_GLYPHS[sceneId] ?? '?';

  return (
    <div className="scene-panel">
      <div className="scene-image">{glyph}</div>
      <div className="torch-overlay" data-level={torchLevel} />
      <div className="scene-caption">{title} — {description}</div>
    </div>
  );
}
